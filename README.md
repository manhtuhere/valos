# Val OS — Vercel

A judgment-first operating system that turns founder prompts into typed architecture, routing, and execution plans. This repo is the Vercel-deployable version: static HTML + Python serverless backend.

**Try it locally:** open `val-os.html` in a browser (demo mode runs fully client-side — no API key, no backend).

**Deploy it:** see [`DEPLOY.md`](./DEPLOY.md) for the Neon + GitHub + Vercel walkthrough.

---

## What you get

- `/` — landing page (`index.html`)
- `/app` — the interactive playground (`val-os.html`) — 11-stage pipeline, typed memory, critic gate, revision loop, worker dispatch
- `/pitch` — hackathon pitch artifact (`val-os-hackathon.html`)
- `/api/plan` — FastAPI orchestrator, same-origin
- `/api/plan/revise` — seeded revision with critic fixes applied
- `/api/memory` — typed memory retrieval (6 tables, tag-scored)
- `/api/memory/commit` — writeback endpoint
- `/api/healthz` — health + runtime + Postgres check

## Architecture

```
val-os-vercel/
├── api/
│   └── index.py            # Vercel serverless entrypoint — imports orchestrator.main.app
├── orchestrator/
│   ├── __init__.py
│   ├── main.py             # FastAPI app, routes under APIRouter(prefix="/api")
│   ├── brain.py            # 11 typed stages (intent → memwb)
│   ├── schemas.py          # Pydantic 2 boundaries
│   ├── memory.py           # Serverless-safe asyncpg (min=0, max=2, SSL for Neon)
│   ├── workers.py          # Manus + OpenClaw clients — inline or http mode
│   └── config.py           # Env-driven settings with serverless-friendly defaults
├── sql/
│   ├── schema.sql          # 6 typed memory tables + plan_runs audit
│   └── seeds.sql           # Seed rows for demo
├── index.html              # Landing page
├── val-os.html             # Interactive playground (auto-detects same-origin /api)
├── val-os-hackathon.html   # Pitch artifact
├── vercel.json             # Routes /api/* to the Python function, static for the rest
├── requirements.txt        # Python deps
└── .env.example            # Env vars for local dev + Vercel
```

## Why Vercel-ready looks different from the local backend

Two serverless realities shaped the design:

1. **Cold starts are cheap but connections aren't.** Each Vercel invocation gets its own process, so a giant asyncpg pool is wasted. The pool is sized `min=0, max=2` and SSL is auto-enabled when `DATABASE_URL` smells like Neon or when `VERCEL=1` is set.

2. **You shouldn't need worker processes to demo the product.** When `WORKER_MODE=inline` (the Vercel default), `workers.py` returns shape-correct synthetic `WorkerResponse` objects without any HTTP call. The execution feedback loop — parallel dispatch, re-critic on `needs_revision` — behaves identically. Swap to `WORKER_MODE=http` and point `MANUS_BASE_URL` / `OPENCLAW_BASE_URL` at real workers when you're ready.

## Two-minute tour

```bash
# 1. Clone + enter
git clone https://github.com/<you>/val-os-vercel
cd val-os-vercel

# 2. Install
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 3. Local dev (optional — or just open val-os.html in the browser)
export DATABASE_URL="postgresql://valos:valos@localhost:5433/valos"
export WORKER_MODE=inline
uvicorn orchestrator.main:app --reload --port 8080

# 4. Hit the orchestrator
curl http://localhost:8080/api/healthz | jq
curl -X POST http://localhost:8080/api/plan \
  -H 'content-type: application/json' \
  -d '{"raw_prompt":"Build a typed memory layer that beats RAG","auto_revise":true,"dispatch_workers":true}' | jq .critic
```

For the full Vercel deploy, see [`DEPLOY.md`](./DEPLOY.md).

## Tunables

| Env var | Default | What it does |
|---|---|---|
| `DATABASE_URL` | `postgresql://valos:valos@localhost:5433/valos` | Postgres DSN. Use Neon for Vercel. |
| `DATABASE_URL_REQUIRES_SSL` | auto | Force SSL. Auto-detects `neon` in DSN or `VERCEL=1`. |
| `WORKER_MODE` | `inline` on Vercel, `http` locally | `inline` = synthetic shape-correct workers, `http` = real worker calls. |
| `MANUS_BASE_URL` | `http://localhost:8081` | Only used when `WORKER_MODE=http`. |
| `OPENCLAW_BASE_URL` | `http://localhost:8082` | Only used when `WORKER_MODE=http`. |
| `ROUTER_MIN_CONFIDENCE` | `0.75` | Router drops steps below this. |
| `MAX_REVISIONS` | `2` | Critic revision cap. |
| `MEMWB_MIN_CONFIDENCE` | `0.75` | Memory writeback threshold. |
| `ENABLE_PERSIST_RUNS` | `false` on Vercel | Write every run to `plan_runs`. Off by default on serverless. |
| `ANTHROPIC_API_KEY` | — | Optional — needed if you wire `brain.py` to real Claude calls. |

## License

MIT. Built for the Straight Up! Hackathon — Ant International Foundation, Track 5.
