# Val OS — Engineering Handoff

Target: ship the MVP with real Claude API calls replacing the heuristic stubs in `brain.py`, keep the typed pipeline and critic gate intact, deploy on Vercel + Neon.

Estimated effort: **3–5 days for one engineer**, assuming they already know FastAPI and have used the Anthropic SDK. The ~1500 lines of existing code are scaffolding — the real work is prompt engineering for the 11 stages and making the critic honest.

---

## What you're inheriting

```
val-os-vercel/
├── api/index.py            # Vercel serverless entrypoint — imports orchestrator.main.app
├── orchestrator/
│   ├── main.py             # FastAPI, 5 routes under /api/*
│   ├── brain.py            # 11 stage functions — HEURISTIC STUBS, you'll replace these
│   ├── schemas.py          # Pydantic 2 boundaries for every stage (DO NOT break these)
│   ├── memory.py           # asyncpg pool, typed retrieval, writebacks
│   ├── workers.py          # Manus/OpenClaw clients, inline + http modes
│   └── config.py           # env-driven settings
├── sql/
│   ├── schema.sql          # 6 typed memory tables + plan_runs
│   ├── seeds.sql           # demo rows
│   └── neon-bootstrap.sql  # combined, paste-into-Neon-in-one-shot
├── val-os.html             # frontend, auto-detects same-origin /api
├── vercel.json             # routes /api/* to python, statics at root
└── requirements.txt
```

Key files you'll touch:
- `orchestrator/brain.py` — **primary work**. 11 functions, each becomes a Claude call.
- `orchestrator/schemas.py` — **read-only boundary**. Don't change shapes; use them to validate Claude's JSON.
- `orchestrator/main.py` — **leave alone** unless adding auth or rate-limiting.
- `orchestrator/memory.py` — **leave alone** unless you want to swap tag overlap for pgvector embeddings (optional stretch).

---

## The pipeline shape (read this before touching code)

```
intake → intent → reframe → memory.retrieve → scope → architect → research
                                                                       ↓
             ← (revise up to MAX_REVISIONS) ← critic ← router ← execution
                                                                       ↓
                                                          dispatch_routes (async)
                                                                       ↓
                               if any worker needs_revision → re-critic
                                                                       ↓
                                                    output → memwb → plan_runs
```

Every stage returns a **Pydantic model defined in `schemas.py`**. That's the contract. Claude must produce JSON that parses into these models — validation on parse failure, retry once with "JSON only" reminder, then raise.

The critic sits between **router** and **dispatch**. If critic returns `{status: "revise"}`, the pipeline re-runs `scope → architect → research → execution → router → critic` with the critic's fixes injected into context. Capped at `MAX_REVISIONS` (default 2).

---

## Primary task: swap brain.py stubs for real Claude calls

Today each function in `brain.py` does naive token-matching. You'll replace each with an Anthropic API call that returns a Pydantic-parseable JSON object.

### 1. Add the Anthropic client

```python
# orchestrator/brain.py
from anthropic import Anthropic
from .config import get_settings

_client: Anthropic | None = None

def _claude() -> Anthropic:
    global _client
    if _client is None:
        s = get_settings()
        if not s.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        _client = Anthropic(api_key=s.anthropic_api_key)
    return _client
```

### 2. Add a typed call helper

```python
# orchestrator/brain.py
import json
from pydantic import BaseModel, ValidationError

def _call_stage(
    system: str,
    user: str,
    schema: type[BaseModel],
    *,
    max_tokens: int = 1200,
    temperature: float = 0.3,
    retries: int = 1,
) -> BaseModel:
    """Call Claude, parse JSON into the given schema, retry on parse failure."""
    s = get_settings()
    last_err: Exception | None = None
    attempts = retries + 1
    for i in range(attempts):
        try:
            msg = _claude().messages.create(
                model=s.anthropic_model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system + ("\n\nRespond ONLY with valid JSON matching the schema. No prose." if i > 0 else ""),
                messages=[{"role": "user", "content": user}],
            )
            text = msg.content[0].text if msg.content else ""
            # strip fences if present
            if "```" in text:
                text = text.split("```", 2)[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip("` \n")
            data = json.loads(text.strip())
            return schema.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as e:
            last_err = e
            continue
    raise RuntimeError(f"Claude call failed {attempts}x: {last_err}")
```

### 3. Rewrite each stage function

Pattern for each of the 11 stages — the schema is the contract, the prompt is the only thing that changes:

```python
def intent(raw_prompt: str, context: str | None) -> Intent:
    system = """You are the Intent stage of Val OS. Given a founder's raw prompt,
    extract what they actually want. Return JSON matching this schema:
    { "goal": str, "user_type": str, "urgency": "low"|"med"|"high",
      "clarity_score": float (0..1), "missing_signals": list[str] }"""
    user = f"PROMPT:\n{raw_prompt}\n\nCONTEXT:\n{context or '(none)'}"
    return _call_stage(system, user, Intent)
```

Repeat for each of: `intent`, `reframe`, `scope`, `architect`, `research`, `execution`, `router`, `critic`, `output`, `memwb`. (Intake is trivial — just timestamps + id, no Claude call needed.)

### 4. The critic is the most important stage

The critic decides whether the pipeline revises or approves. Prompt it carefully:

```python
def critic(raw_prompt: str, context: str | None, bundle: dict) -> CriticVerdict:
    system = """You are the Critic stage of Val OS. You review the architecture,
    scope, research, execution, and routing of a plan and decide whether it's
    ready to execute OR needs revision.

    Scoring rubric (0..1):
    - Specificity: does the plan address the actual prompt, or is it generic?
    - Feasibility: can the routes be executed with the provided workers?
    - Completeness: does scope cover the main concerns, or is something obvious missing?
    - Routing quality: are routes confident enough (>0.75)?

    Return JSON:
    { "status": "approve"|"revise"|"reject",
      "score": float (0..1),
      "strongest_part": str,
      "failures": list[str],
      "fixes": list[str] }

    Decision rule:
    - score >= 0.75 and no P0 failures → approve
    - score < 0.40 OR prompt is too shallow to act on → reject
    - otherwise → revise with specific fixes"""
    user = f"PROMPT:\n{raw_prompt}\n\nCONTEXT:\n{context or '(none)'}\n\nBUNDLE:\n{json.dumps(bundle, indent=2)}"
    return _call_stage(system, user, CriticVerdict, temperature=0.1)
```

Low temperature on the critic is important — you want it boring and consistent, not creative.

### 5. Drop the heuristics

Once every function calls Claude, delete the helper functions at the top of `brain.py` that tokenize prompts and score "shallowness" — they're demo scaffolding.

---

## What NOT to change

- **`schemas.py`**. Every stage's output shape is load-bearing — the frontend, the critic, the revision loop, and `plan_runs` all depend on these.
- **The APIRouter prefix `/api`**. Vercel routes `/api/*` to `api/index.py`; moving the prefix breaks the deploy.
- **The inline worker mode default on Vercel.** Keep `WORKER_MODE=inline` until real workers exist. The feedback loop still exercises, just with synthetic responses.
- **`asyncpg` pool sizing (min=0, max=2).** Serverless-safe; a bigger pool wastes cold-start budget.

---

## Testing strategy

### Unit tests for each stage

Create `orchestrator/tests/test_brain.py`:

```python
import pytest
from orchestrator import brain
from orchestrator.schemas import Intent, CriticVerdict

@pytest.mark.live  # requires ANTHROPIC_API_KEY
def test_intent_meta_prompt():
    got = brain.intent("Build a judgment-first OS for founders", None)
    assert isinstance(got, Intent)
    assert got.clarity_score > 0.5
    assert "founder" in got.user_type.lower() or got.user_type != ""

@pytest.mark.live
def test_critic_shallow_prompt_rejects():
    bundle = {...}  # minimal bundle
    v = brain.critic("build a thing", None, bundle)
    assert v.status in ("reject", "revise")
    assert v.score < 0.75
```

Run with `pytest -m live` — mark them `live` so CI can skip them by default.

### Integration test

The existing smoke test (hitting `/api/plan` with a meta-prompt and expecting `critic.status == "approve"`) becomes the integration test. Cassette the Anthropic responses with `vcrpy` so it's deterministic in CI.

### Eval corpus

Turn on `ENABLE_PERSIST_RUNS=true` for a day or two. Every `/api/plan` invocation writes to `plan_runs`. After ~50 runs, you have a regression test set: any change to a prompt should be re-run against the corpus and compared on critic score distribution + revision rate.

---

## Deploy checklist

Follow `DEPLOY.md` for the full Neon + Vercel walkthrough. Quick version:

1. **Neon:** new project `val-os`, database `valos`, paste `sql/neon-bootstrap.sql` into the SQL editor. Grab the **pooled** DSN.
2. **GitHub:** push this repo. `./push.sh` does it if `gh` is installed.
3. **Vercel:** Import Git Repository → set env vars:
   - `DATABASE_URL` = the Neon pooled DSN
   - `DATABASE_URL_REQUIRES_SSL=true`
   - `WORKER_MODE=inline`
   - `ANTHROPIC_API_KEY=sk-ant-...`
   - `ANTHROPIC_MODEL=claude-sonnet-4-5` (or opus for higher quality, slower/more expensive)
   - `ROUTER_MIN_CONFIDENCE=0.75`
   - `MAX_REVISIONS=2`
   - `MEMWB_MIN_CONFIDENCE=0.75`
   - `ENABLE_PERSIST_RUNS=true` (for the eval corpus — off once traffic is high enough)

4. **Smoke test:**
   ```bash
   curl https://<url>.vercel.app/api/healthz | jq
   # expect: {"ok": true, "postgres": true, "worker_mode": "inline", ...}

   curl -X POST https://<url>.vercel.app/api/plan \
     -H 'content-type: application/json' \
     -d '{"raw_prompt":"Build a judgment-first OS","auto_revise":true,"dispatch_workers":true}' \
     | jq '.critic.status, .critic.score, .revisions'
   # expect: "approve" 0.8+ 0
   ```

---

## Cost + latency budget

Each `/api/plan` invocation with real Claude calls runs ~11 API calls (one per stage, plus extras on revision). With Sonnet-4.5 at ~$3/M input + $15/M output:

- Avg input per stage: ~800 tokens × 11 = ~8.8k
- Avg output per stage: ~400 tokens × 11 = ~4.4k
- Cost per plan: ~$0.09 (no revision), ~$0.14 (one revision)
- Latency: ~2–4s per stage × 11 = 22–44s serial

**Optimization priorities (in order):**
1. **Parallelize independent stages.** `research` and `execution` can run in parallel after `architect` — `asyncio.gather`. Saves ~4s.
2. **Haiku for cheap stages.** `intent`, `reframe`, `memwb` don't need Sonnet. Swap model per-stage for ~40% cost cut.
3. **Prompt caching.** The system prompts for each stage are static — use Anthropic's prompt caching for ~50% input cost reduction.
4. **Streaming.** If the frontend wants to show stages arriving one-at-a-time, switch `/api/plan` to SSE and stream each stage's result as it completes.

---

## Known gotchas

1. **Neon cold starts.** Neon's free tier suspends compute after ~5min idle; first request after idle takes ~3s to wake. Hobby plan removes this. For MVP demos, ping `/api/healthz` every 4 min from a cron.
2. **Vercel function timeout.** Hobby plan caps at 10s, Pro at 60s. A serial 11-stage pipeline with Claude may exceed 10s. **Mitigation:** upgrade to Pro OR stream results via SSE and let the frontend stitch them together.
3. **Vercel Python bundle size.** `anthropic` + `fastapi` + `asyncpg` + deps is ~35MB. Under the 50MB limit, but slim imports if you add more libs.
4. **Model strings.** `anthropic_model` in config defaults to `claude-sonnet-4-5` — verify this string is current for your account before deploying.
5. **CORS.** The `val-os.html` playground is same-origin with `/api`, so CORS is a no-op in production. If you expose the API to other domains, tighten `allow_origins` in `main.py` from `["*"]` to your allowlist.

---

## What ships v1 vs v2

**v1 (MVP — the engineer's scope):**
- Real Claude calls in `brain.py`
- Tag-overlap memory retrieval (no embeddings)
- `inline` worker mode (synthetic responses)
- Deployed on Vercel + Neon
- Critic gate + revision loop working end-to-end

**v2 (post-MVP, not on the critical path):**
- Real workers (Manus + OpenClaw — or your internal `val_clone_internal`) deployed separately, `WORKER_MODE=http`
- pgvector embeddings on top of tag overlap (co-score, don't replace)
- Prompt caching + per-stage model tiering for cost
- Eval harness + regression tests on `plan_runs` corpus
- Auth on `/app` (Clerk / Cloudflare Access)

---

## Questions that'll come up

**Q: Can I swap asyncpg for something simpler?**
Only if you're willing to rewrite `memory.py`. asyncpg is fastest in asyncio context and handles the pool correctly on serverless. Don't use psycopg2.

**Q: Why not just use a vector DB?**
Val OS's thesis is that typed memory + judgment > retrieval augmentation. Six typed tables with tag overlap is specific, auditable, and easy to debug. Embeddings can come later as a co-score.

**Q: The critic is rejecting valid prompts.**
Lower `ROUTER_MIN_CONFIDENCE` or raise `MAX_REVISIONS`. Or — more likely — tune the critic system prompt to be less trigger-happy. Start permissive, tighten as you get a corpus.

**Q: Deployment is slow / timing out.**
See "Cost + latency budget" above. The fix is parallelizing independent stages, not more compute.

---

**Contact for architecture questions:** Val (val@valsea.app). The design decisions are in the PRD (not in this repo — reach out if you need it).
