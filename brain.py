"""Local judgment engine (shape-correct typed JSON) — server-side port of the HTML DEMO module.

This is the same contract as the LLM prompts from the PRD, but implemented as
pure Python so the backend runs end-to-end without an API key. Swap any stage
for a real LLM call by plugging into brain.intent/reframe/... with the same
return shapes.
"""
from __future__ import annotations

import re
from typing import Any

from . import schemas as S

_STOP = {
    "a","an","the","and","or","to","for","of","in","on","with","by","me","my",
    "our","from","that","which","is","are","be","being","it","its","as","so",
    "into","onto","up","down","just",
}


def _tokens(s: str) -> list[str]:
    return re.findall(r"[a-zA-Z0-9_]+", (s or "").lower())


def _title_of(raw: str) -> str:
    m = re.search(
        r"\b(?:build|make|create|design|develop|ship|launch)\s+(?:me\s+)?(?:a|an|the)?\s*([^.!?\n]+?)(?:\s+(?:that|which|for|to|so|from)\b|[.!?\n]|$)",
        raw, flags=re.IGNORECASE,
    )
    t = (m.group(1) if m else raw[:80]).strip()
    return re.sub(r"\s+", " ", t)


def _keywords(raw: str, n: int = 6) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for t in _tokens(raw):
        if t in _STOP or len(t) <= 2 or t in seen:
            continue
        seen.add(t)
        out.append(t)
        if len(out) >= n:
            break
    return out


def categorize(raw: str, ctx: str | None = None) -> str:
    t = set(_tokens(f"{raw} {ctx or ''}"))
    def has(*ks: str) -> bool: return any(k in t for k in ks)
    if has("founder","os","operating","orchestrator","judgment","specs","spec","planning","wedge"):
        return "founder_os"
    if has("dashboard","analytics","metric","metrics","kpi","kpis","report","reports","chart","visualize"):
        return "dashboard"
    if has("sales","crm","deal","pipeline","outreach","lead","leads","prospect"):
        return "sales"
    if has("support","ticket","helpdesk","intercom","zendesk","customer"):
        return "support"
    if has("workflow","automation","automate","agent","agents"):
        return "automation"
    return "generic"


# --- Profiles (two filled, generic falls back to derived-from-prompt). ---

_PROFILE_FOUNDER_OS = {
    "core_goal": "turn raw founder prompts into production-grade specs, architecture, routing, and execution plans through a judgment-first pipeline",
    "user_type": "startup founders and 0\u21921 builders",
    "domain": "founder tooling / AI orchestration",
    "build_category": "platform / operating system",
    "ambiguities": [
        "execution autonomy level for v1",
        "which worker surfaces are wired (Manus, OpenClaw, code builder)",
        "memory persistence target (local vs managed DB)",
        "whether the critic can hard-block execution",
    ],
    "assumptions": [
        "single-user v1",
        "typed JSON at every module boundary",
        "memory stored as typed tables, not a free-form vector blob",
    ],
    "problem_statement": "founders lose weeks translating vague prompts into production-grade plans; existing tools either act as personality chatbots or execute too early without wedge/scope discipline",
    "wedge": "prompt \u2192 structured founder-grade plan, with a critic gate before any execution",
    "success_definition": "user enters a vague build prompt and receives typed intent, reframed problem, scoped MVP, architecture, routing plan, execution queue, critic verdict, and output bundle in a single run",
    "non_goals": [
        "full autonomous build loop",
        "multi-user collaboration",
        "production deployment engine in v1",
        "IDE / code-builder execution in v1",
    ],
    "must_have": [
        "prompt-to-spec pipeline","problem reframing","MVP scoping","architecture generation",
        "research + execution task generation","router with confidence + fallback","critic quality gate",
        "typed memory retrieval","output bundle (PRD + system + routing + QA + deploy)",
    ],
    "should_have": ["memory writeback recommendations","editable routing decisions","revision loop after critic 'revise'"],
    "defer": ["autonomous iteration loop","multi-project graph memory","real worker execution feedback","multi-user collaboration"],
    "mock_ok": ["Manus connector","OpenClaw connector","actual execution results","deployment logs"],
    "must_be_real": ["planning pipeline outputs","routing decisions","memory retrieval","critic evaluation","typed output bundle"],
    "modules": ["Prompt Intake","Intent Interpreter","Problem Reframer","Scope Engine","Architecture Engine","Research Planner","Execution Planner","Router","Critic","Output Generator","Memory Manager"],
    "module_resp": {
        "Prompt Intake": "normalize raw prompt, assign request id, detect request type",
        "Intent Interpreter": "convert raw prompt into structured intent with ambiguities + assumptions",
        "Problem Reframer": "sharpen into problem / wedge / success / non-goals",
        "Scope Engine": "produce must-have, should-have, defer, mock_ok, must_be_real",
        "Architecture Engine": "modules, data flow, dependencies, failure points, memory vs runtime split",
        "Research Planner": "emit specific, deliverable-keyed Manus research tasks",
        "Execution Planner": "emit typed execution queue with owner_type, deps, acceptance criteria",
        "Router": "route each work item with reason, confidence, fallback",
        "Critic": "return approve | revise | reject + failures + fixes + strongest_part",
        "Output Generator": "assemble founder-grade PRD + system spec + QA + deployment checklists",
        "Memory Manager": "tag-scored retrieval; durable writeback recommendations only",
    },
    "data_flow": [
        "raw_prompt \u2192 intake","intake + memory \u2192 intent","intent \u2192 reframed problem",
        "reframed problem \u2192 scope","scope + reframed \u2192 architecture","architecture + scope \u2192 research plan",
        "architecture + scope \u2192 execution plan","all prior \u2192 router","bundle \u2192 critic",
        "critic approve \u2192 output generator","output \u2192 memory writeback recommendations",
    ],
    "dependencies": ["LLM provider (Claude Sonnet 4.6)","Postgres (typed memory)","optional: Manus API (discovery)","optional: OpenClaw shell (execution)"],
    "failure_points": [
        "prompt ambiguity","over-scoped MVP","bad routing decision (e.g., Manus for judgment)",
        "low-quality worker output","memory contamination with transient details","critic gate bypassed",
        "JSON extraction failure at module boundary",
    ],
    "memory_vs_runtime": {
        "memory": ["founder_principles","routing_rules","approved_patterns","product_preferences","failure_lessons","project_state"],
        "runtime": ["current request_id","stage outputs in-flight","critic verdict for this run","per-run retrieved context block"],
    },
    "research_seeds": [
        ["catalogue 10 production-grade AI build-planning tools and surface their core loop","know what credible competitors look like so the wedge is defensible","web/product","comparison table with core flow, strengths, weaknesses, positioning"],
        ["collect module patterns used by prompt-to-spec systems (Cursor Composer, Replit Agent, Anthropic Projects)","validate our module boundary choices against shipping systems","docs/architecture","typed module-pattern summary with diagrams"],
        ["identify how competing tools separate judgment from execution","verify our four-way role split (Val Clone / Manus / OpenClaw / Critic) is the right cut","product analysis","routing taxonomy with confidence-policy comparison"],
        ["survey typed-memory approaches in long-running agent systems","pick the right memory shape before writing any schema","docs/papers","trade-off matrix (typed tables vs vector vs graph) with recommendation"],
        ["find examples of critic / quality-gate patterns in agent pipelines","design a critic that actually rejects shallow output","repos/docs","critic-pattern catalog with rejection rationales"],
    ],
    "execution_seeds": [
        ["Scaffold Next.js app shell with dark theme and 11-stage pipeline UI","frontend",[],["app boots","route structure exists","theme tokens configured","pipeline visualization renders"],False],
        ["Build FastAPI orchestrator service with POST /plan endpoint","backend",["e1"],["accepts raw prompt","returns typed planning bundle","logs stage latency"],False],
        ["Implement Postgres schemas for 6 typed memory tables + seeds","data",[],["tables created","seed data loaded","retrieval queries indexed"],False],
        ["Wire intent / reframe / scope / architecture modules with strict JSON extraction","backend",["e2"],["each module returns shape-correct JSON","retry on malformed output","per-module timeout"],False],
        ["Implement router service with confidence + fallback policy","backend",["e4"],["routes emit confidence","routes < 0.75 fallback to val_clone_internal"],False],
        ["Implement critic service evaluating the full bundle","backend",["e4"],["returns approve | revise | reject","surfaces failures + fixes + strongest_part"],False],
        ["Stub Manus + OpenClaw connector services","backend",["e5"],["shape-correct fake responses","observable request/response logs"],True],
        ["Add memory retrieval + writeback recommendation endpoints","backend",["e3"],["tag-scored retrieval with per-category caps","writeback returns recommendations, not auto-commits"],False],
    ],
    "qa": [
        "every stage returns typed JSON matching its schema",
        "critic rejects a deliberately shallow prompt",
        "memory retrieval surfaces the right rows for a given prompt",
        "routing emits confidence + fallback for every item",
        "malformed LLM output triggers one retry with JSON-only reminder",
        "pipeline runs end-to-end under 30s on a standard prompt",
    ],
    "deploy": [
        "env config for LLM key + model","Postgres migrations applied","seed memory loaded",
        "rate-limit + timeout policies on LLM calls","structured logs for stage latency",
        "error reporting wired (Sentry or equivalent)","feature flag for demo vs real LLM mode",
    ],
    "critic_strong": "typed JSON at every module boundary with a real critic gate \u2014 judgment-first discipline is the moat",
}


def _generic_profile(raw: str, ctx: str | None) -> dict[str, Any]:
    t = _title_of(raw)
    kws = _keywords(f"{raw} {ctx or ''}", 6)
    t_low = t.lower()
    return {
        "core_goal": f"ship a working v1 of {t_low} that proves a single user loop",
        "user_type": "internal operators / early users",
        "domain": kws[0] if kws else "general tooling",
        "build_category": "internal tool",
        "ambiguities": ["primary user not fully specified","data source(s) not named","success metric unclear"],
        "assumptions": ["single-user v1","mocked external data ok","dark web UI"],
        "problem_statement": f"user articulates a need around {t_low} but the wedge, scope, and success metric aren't yet sharp",
        "wedge": f"one clearly useful slice of {t_low} that a single user runs end-to-end",
        "success_definition": "a realistic user reaches the main action of the product in under 60s on a seeded demo",
        "non_goals": ["full platform generalization","multi-tenant admin in v1","enterprise SSO in v1"],
        "must_have": [f"core user flow for {t_low}","seeded / mock data source","primary action","result view"],
        "should_have": ["saved state","shareable URL","light analytics"],
        "defer": ["admin console","billing","multi-tenant"],
        "mock_ok": ["external integrations","downstream write-backs"],
        "must_be_real": ["core user action","persistent state of a single run"],
        "modules": ["Frontend App","Frontend State","API Service","Data Store","Integration Stubs","Observability"],
        "module_resp": {
            "Frontend App": "renders the user flow and primary action",
            "Frontend State": "holds run state and optimistic updates",
            "API Service": "exposes typed endpoints for the core action",
            "Data Store": "persists a single run; seeded with mock data",
            "Integration Stubs": "fake third-party calls with observable request/response",
            "Observability": "structured logs and latency per request",
        },
        "data_flow": ["user action \u2192 frontend","frontend \u2192 api","api \u2192 data store","api \u2192 integration stub","response \u2192 frontend"],
        "dependencies": ["web host","Postgres","LLM provider (optional)"],
        "failure_points": [
            "vague success metric","user cannot find primary action","integration stub diverges from real API",
            "state not persisted across refresh",
        ],
        "memory_vs_runtime": {
            "memory": ["product_preferences","approved_patterns"],
            "runtime": ["current request id","seeded dataset for the run"],
        },
        "research_seeds": [
            [f"catalogue 3-5 tools that solve {t_low} or adjacent","anchor the wedge against credible alternatives","web/product","comparison table + positioning cut"],
            [f"identify the one task a user does most often inside {t_low}","shape the primary action","user interviews","ranked task list with frequency"],
            [f"collect the top 2 data sources for {t_low}","decide mock vs real for v1","docs","source table with shape and refresh cadence"],
        ],
        "execution_seeds": [
            ["Scaffold app shell with primary action on home screen","frontend",[],["app boots","primary action visible"],False],
            ["Implement API endpoint for primary action","backend",["e1"],["returns typed response","logs latency"],False],
            ["Seed data store with realistic rows","data",[],["10+ seeded rows","indexed on primary key"],False],
            ["Wire frontend to API and persist a run","frontend",["e1","e2"],["submit \u2192 response round-trip","state persists on refresh"],False],
            ["Instrument structured logs","observability",["e2"],["logs carry request id, latency"],False],
            ["Stub one external integration","backend",["e2"],["shape-correct fake response","observable log"],True],
        ],
        "qa": [
            "primary action completes in under 3s on seed data",
            "malformed input is rejected with a typed error",
            "frontend handles empty-state gracefully",
            "logs include request id and latency",
            "no unhandled exception on the happy path",
        ],
        "deploy": ["env config loaded","database seeded","health check passes","structured logs exported","feature flag for demo vs real mode"],
        "critic_strong": "one clearly scoped user loop with typed JSON between frontend and backend",
    }


def _resolve_profile(raw: str, ctx: str | None) -> dict[str, Any]:
    cat = categorize(raw, ctx)
    if cat == "founder_os":
        p = dict(_PROFILE_FOUNDER_OS)
        p["__category"] = "founder_os"
        return p
    g = _generic_profile(raw, ctx)
    g["__category"] = cat
    return g


# --- Stage implementations. Signatures mirror the HTML DEMO module. ---

def intent(raw: str, ctx: str | None) -> S.Intent:
    p = _resolve_profile(raw, ctx)
    return S.Intent(
        core_goal=p["core_goal"], user_type=p["user_type"], domain=p["domain"],
        build_category=p["build_category"], ambiguities=p["ambiguities"], assumptions=p["assumptions"],
    )


def reframe(raw: str, ctx: str | None, intent_: S.Intent) -> S.Reframe:
    p = _resolve_profile(raw, ctx)
    return S.Reframe(
        problem_statement=p["problem_statement"], wedge=p["wedge"],
        success_definition=p["success_definition"], non_goals=p["non_goals"],
    )


def scope(raw: str, ctx: str | None, intent_: S.Intent, reframe_: S.Reframe) -> S.Scope:
    p = _resolve_profile(raw, ctx)
    return S.Scope(
        must_have=p["must_have"], should_have=p["should_have"], defer=p["defer"],
        mock_ok=p["mock_ok"], must_be_real=p["must_be_real"],
    )


def architect(raw: str, ctx: str | None, intent_: S.Intent, reframe_: S.Reframe, scope_: S.Scope) -> S.Architecture:
    p = _resolve_profile(raw, ctx)
    return S.Architecture(
        system_modules=p["modules"], module_responsibilities=p["module_resp"],
        data_flow=p["data_flow"], dependencies=p["dependencies"],
        failure_points=p["failure_points"], memory_vs_runtime=p["memory_vs_runtime"],
    )


def research(raw: str, ctx: str | None, reframe_: S.Reframe, scope_: S.Scope, arch: S.Architecture) -> S.Research:
    p = _resolve_profile(raw, ctx)
    tasks = [
        S.ResearchTask(
            task_id=f"r{i+1}", objective=row[0], why_it_matters=row[1],
            source_type=row[2], deliverable=row[3],
        )
        for i, row in enumerate(p.get("research_seeds", []))
    ]
    return S.Research(research_tasks=tasks)


def execution(raw: str, ctx: str | None, scope_: S.Scope, arch: S.Architecture) -> S.Execution:
    p = _resolve_profile(raw, ctx)
    tasks = [
        S.ExecutionTask(
            task_id=f"e{i+1}", title=row[0], owner_type=row[1],
            depends_on=list(row[2] or []), acceptance_criteria=list(row[3] or []),
            mockable=bool(row[4]),
        )
        for i, row in enumerate(p.get("execution_seeds", []))
    ]
    return S.Execution(execution_tasks=tasks)


def router(
    scope_: S.Scope,
    arch: S.Architecture,
    research_: S.Research,
    execution_: S.Execution,
    min_confidence: float = 0.75,
) -> S.RoutingPlan:
    routes: list[S.Route] = []
    # Research tasks -> manus
    for r in research_.research_tasks:
        routes.append(S.Route(
            work_item=r.objective, route_to="manus",
            reason="external discovery task", confidence=0.93, fallback=None,
        ))
    # Execution tasks -> code_builder or openclaw
    codey_re = re.compile(r"scaffold|implement|wire|build|endpoint|schema|integration", re.IGNORECASE)
    for e in execution_.execution_tasks:
        codey = bool(codey_re.search(e.title))
        route_to = "code_builder" if codey else "openclaw"
        conf = 0.9 if codey else 0.92
        routes.append(S.Route(
            work_item=e.title, route_to=route_to,  # type: ignore[arg-type]
            reason="multi-file real codebase change" if codey else "operational execution of approved task",
            confidence=conf,
            fallback="val_clone_internal" if conf < min_confidence else None,
        ))
    # Meta items
    routes.append(S.Route(work_item="define MVP wedge", route_to="val_clone_internal",
                         reason="judgment-heavy strategic decision", confidence=0.97, fallback=None))
    routes.append(S.Route(work_item="stress-test architecture", route_to="critic",
                         reason="quality gate before execution", confidence=0.94, fallback=None))
    routes.append(S.Route(work_item="write durable lesson to memory", route_to="memory_manager",
                         reason="durable continuity", confidence=0.9, fallback=None))
    return S.RoutingPlan(routes=routes)


def critic(raw: str, ctx: str | None, bundle: dict[str, Any]) -> S.CriticVerdict:
    """Heuristic quality gate.

    Scores the planning bundle on shape (module count, scope size, failure
    points, task counts, non-goals, routing) and then applies prompt-level
    penalties so a shallow prompt can't ride a well-shaped generic profile to
    an approve verdict.
    """
    p = _resolve_profile(raw, ctx)
    b = bundle or {}
    score = 0.55
    arch = b.get("architecture", {}) or {}
    sc = b.get("scope", {}) or {}
    rs = b.get("research", {}) or {}
    ex = b.get("execution", {}) or {}
    rf = b.get("reframe", {}) or {}
    rt = b.get("routing", {}) or {}
    if len(arch.get("system_modules", []) or []) >= 6: score += 0.08
    if 3 <= len(sc.get("must_have", []) or []) <= 7: score += 0.10
    if len(arch.get("failure_points", []) or []) >= 4: score += 0.05
    if len(ex.get("execution_tasks", []) or []) >= 5: score += 0.06
    if len(rs.get("research_tasks", []) or []) >= 3: score += 0.04
    if len(rf.get("non_goals", []) or []) >= 2: score += 0.03
    if any((r or {}).get("route_to") == "code_builder" for r in (rt.get("routes", []) or [])): score += 0.02

    # Prompt-level penalties: a well-shaped bundle built on top of a vague
    # prompt should not get an approve verdict.
    prompt_tokens = _tokens(raw)
    signal_tokens = [t for t in prompt_tokens if t not in _STOP and len(t) > 2]
    if len(signal_tokens) < 4:
        score -= 0.20  # "build a thing" territory
    elif len(signal_tokens) < 7:
        score -= 0.10
    if p.get("__category") == "generic":
        score -= 0.15  # couldn't infer domain at all

    score = max(0.0, min(0.96, score))

    failures: list[str] = []
    fixes: list[str] = []
    if len(sc.get("must_have", []) or []) > 7:
        failures.append("must-have is too broad for an MVP")
        fixes.append("cut must-have down to 4-6 items; move the rest to should-have or defer")
    if not (arch.get("failure_points") or []):
        failures.append("no explicit failure states")
        fixes.append("list failure points and how each is detected + handled")
    if p.get("__category") == "generic":
        failures.append("domain not clearly identified from prompt")
        fixes.append("add 1-2 context lines to tighten intent and narrow the domain")
    if len(signal_tokens) < 4:
        failures.append("prompt is too short to plan against")
        fixes.append("describe what the product does, who uses it, and what success looks like")
    if not failures:
        failures.append("memory writeback criteria could be tightened")
        fixes.append("add an explicit confidence threshold before writing memory")

    status = "approve" if score >= 0.82 else "revise" if score >= 0.60 else "reject"
    return S.CriticVerdict(
        status=status, score=round(score, 2), failures=failures, fixes=fixes,
        strongest_part=p.get("critic_strong", "typed module boundaries make the pipeline debuggable"),
    )


def output(
    raw: str,
    ctx: str | None,
    intent_: S.Intent,
    reframe_: S.Reframe,
    scope_: S.Scope,
    arch: S.Architecture,
) -> S.OutputBundle:
    p = _resolve_profile(raw, ctx)
    return S.OutputBundle(
        prd={
            "product_definition": f"MVP that solves: {reframe_.problem_statement}",
            "target_user": intent_.user_type,
            "wedge": reframe_.wedge,
            "success_criteria": [reframe_.success_definition, *scope_.must_have[:3]],
            "non_goals": reframe_.non_goals,
            "mvp_feature_set": scope_.must_have,
            "mocked_vs_real": {"mocked": scope_.mock_ok, "real": scope_.must_be_real},
        },
        system_spec={
            "modules": arch.system_modules,
            "data_flow": arch.data_flow,
            "dependencies": arch.dependencies,
            "failure_states": arch.failure_points,
        },
        qa_checklist=p["qa"],
        deployment_checklist=p["deploy"],
    )


def memwb(critic_: S.CriticVerdict) -> S.MemoryWriteback:
    recs: list[S.MemoryRecommendation] = []
    if critic_.status == "approve":
        recs.append(S.MemoryRecommendation(
            should_write=True, memory_type="approved_patterns",
            title="Judgment-first planning loop with typed module boundaries",
            content="Intent \u2192 Reframe \u2192 Scope \u2192 Architecture \u2192 Research/Execution \u2192 Router \u2192 Critic \u2192 Output. Typed JSON at every boundary. Critic must gate output assembly.",
            tags=["core_loop","planning","governance"], confidence=0.9,
            justification="Loop held up end-to-end for this prompt and aligns with multiple founder principles.",
        ))
    if critic_.failures:
        recs.append(S.MemoryRecommendation(
            should_write=True, memory_type="failure_lessons",
            title=critic_.failures[0],
            content=f"Observed during this run: {critic_.failures[0]}. Fix: {(critic_.fixes or ['review scope + failure states.'])[0]}",
            tags=["critic","quality"], confidence=0.75,
            justification="Critic surfaced a real weakness worth remembering.",
        ))
    recs.append(S.MemoryRecommendation(
        should_write=False, memory_type="product_preferences",
        title="Defer: personalize stack per run",
        content="Do not store per-run stack choices as preferences unless repeated across 3+ projects.",
        tags=["governance","memory"], confidence=0.6,
        justification="Transient details pollute memory; wait for a pattern before storing.",
    ))
    return S.MemoryWriteback(recommendations=recs)
