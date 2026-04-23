"""FastAPI orchestrator for Val OS — Vercel-ready.

All routes live under /api/* so Vercel's static-first router leaves them to the
serverless function. The rest of the file mirrors val-os-backend, with two
changes:

- persist_run is gated on Settings.enable_persist_runs (off by default on
  Vercel: one connection per invocation is precious).
- CORS open for browsers, but same-origin calls from val-os.html don't need it.
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from . import brain, memory
from .config import get_settings
from .schemas import (
    CriticVerdict,
    Intake,
    MemoryContext,
    MemoryWriteback,
    PlanBundle,
    PlanRequest,
    ReviseRequest,
    RoutingPlan,
    WorkerResponse,
)
from .workers import dispatch_routes

log = logging.getLogger("valos.orchestrator")
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')

app = FastAPI(title="Val OS Orchestrator", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _apply_critic_fixes_to_context(base_ctx: str | None, critic: CriticVerdict) -> str:
    parts: list[str] = [base_ctx] if base_ctx else []
    if critic.failures:
        parts.append("Critic flagged the following failures: " + "; ".join(critic.failures))
    if critic.fixes:
        parts.append("Apply these fixes: " + "; ".join(critic.fixes))
    return "\n".join(parts)


async def _persist_run(raw_prompt: str, ctx: str | None, bundle: PlanBundle) -> None:
    s = get_settings()
    if not s.enable_persist_runs:
        return
    try:
        pool = await memory.get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO plan_runs
                  (id, raw_prompt, context, bundle, critic, revisions, worker_feedback, latency_ms)
                VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb,$8)
                """,
                uuid.UUID(bundle.request_id),
                raw_prompt,
                ctx,
                json.dumps(bundle.model_dump(mode="json")),
                json.dumps(bundle.critic.model_dump(mode="json")),
                bundle.revisions,
                json.dumps([w.model_dump(mode="json") for w in bundle.worker_feedback]),
                bundle.latency_ms,
            )
    except Exception as e:
        log.warning("plan_runs insert failed: %s", e)


async def _run_pipeline(
    raw_prompt: str,
    ctx: str | None,
    *,
    auto_revise: bool,
    dispatch: bool,
    starting_revisions: int = 0,
) -> PlanBundle:
    s = get_settings()
    t0 = time.monotonic()
    run_id = uuid.uuid4()
    intake = Intake(request_id=str(run_id), timestamp=_now_iso())

    try:
        mem_ctx: MemoryContext = await memory.retrieve(raw_prompt, ctx)
    except Exception as e:
        log.warning("memory retrieve failed: %s (continuing with empty context)", e)
        mem_ctx = MemoryContext(rows=[])

    intent_ = brain.intent(raw_prompt, ctx)
    reframe_ = brain.reframe(raw_prompt, ctx, intent_)
    scope_ = brain.scope(raw_prompt, ctx, intent_, reframe_)
    arch = brain.architect(raw_prompt, ctx, intent_, reframe_, scope_)
    research_ = brain.research(raw_prompt, ctx, reframe_, scope_, arch)
    execution_ = brain.execution(raw_prompt, ctx, scope_, arch)
    routing: RoutingPlan = brain.router(scope_, arch, research_, execution_, min_confidence=s.router_min_confidence)

    bundle_for_critic = {
        "architecture": arch.model_dump(), "scope": scope_.model_dump(),
        "research": research_.model_dump(), "execution": execution_.model_dump(),
        "reframe": reframe_.model_dump(), "routing": routing.model_dump(),
    }
    critic_ = brain.critic(raw_prompt, ctx, bundle_for_critic)

    revisions = starting_revisions
    while auto_revise and critic_.status == "revise" and revisions < s.max_revisions:
        revisions += 1
        new_ctx = _apply_critic_fixes_to_context(ctx, critic_)
        log.info("revision %d/%d — re-running with critic fixes", revisions, s.max_revisions)
        scope_ = brain.scope(raw_prompt, new_ctx, intent_, reframe_)
        arch = brain.architect(raw_prompt, new_ctx, intent_, reframe_, scope_)
        research_ = brain.research(raw_prompt, new_ctx, reframe_, scope_, arch)
        execution_ = brain.execution(raw_prompt, new_ctx, scope_, arch)
        routing = brain.router(scope_, arch, research_, execution_, min_confidence=s.router_min_confidence)
        critic_ = brain.critic(raw_prompt, new_ctx, {
            "architecture": arch.model_dump(), "scope": scope_.model_dump(),
            "research": research_.model_dump(), "execution": execution_.model_dump(),
            "reframe": reframe_.model_dump(), "routing": routing.model_dump(),
        })

    worker_feedback: list[WorkerResponse] = []
    if dispatch and critic_.status in ("approve", "revise"):
        routes_json = [r.model_dump() for r in routing.routes]
        worker_feedback = await dispatch_routes(routes_json, ctx)
        needs_rev = [w for w in worker_feedback if w.status == "needs_revision"]
        if needs_rev:
            notes = "; ".join(f"{w.worker}: {w.logs[0] if w.logs else 'needs_revision'}" for w in needs_rev)
            critic_ = brain.critic(raw_prompt, f"{ctx or ''}\nWorker feedback: {notes}", {
                "architecture": arch.model_dump(), "scope": scope_.model_dump(),
                "research": research_.model_dump(), "execution": execution_.model_dump(),
                "reframe": reframe_.model_dump(), "routing": routing.model_dump(),
            })

    output_ = brain.output(raw_prompt, ctx, intent_, reframe_, scope_, arch)
    memwb = brain.memwb(critic_)

    bundle = PlanBundle(
        request_id=str(run_id),
        intake=intake,
        memory=mem_ctx,
        intent=intent_, reframe=reframe_, scope=scope_, architecture=arch,
        research=research_, execution=execution_, routing=routing, critic=critic_,
        worker_feedback=worker_feedback,
        output=output_,
        memory_writeback=memwb,
        revisions=revisions,
        latency_ms=int((time.monotonic() - t0) * 1000),
    )
    await _persist_run(raw_prompt, ctx, bundle)
    return bundle


# --- /api routes ------------------------------------------------------------

@api.get("/healthz")
async def healthz() -> dict[str, Any]:
    s = get_settings()
    pg_ok = True
    pg_err: str | None = None
    try:
        pool = await memory.get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
    except Exception as e:
        pg_ok = False
        pg_err = f"{type(e).__name__}: {e}"
    return {
        "ok": True,
        "version": app.version,
        "runtime": "vercel" if __import__("os").getenv("VERCEL") else "local",
        "postgres": pg_ok,
        "postgres_error": pg_err,
        "worker_mode": s.worker_mode,
        "router_min_confidence": s.router_min_confidence,
        "max_revisions": s.max_revisions,
    }


@api.post("/plan", response_model=PlanBundle)
async def plan(req: PlanRequest) -> PlanBundle:
    try:
        return await _run_pipeline(
            req.raw_prompt, req.context,
            auto_revise=req.auto_revise, dispatch=req.dispatch_workers,
        )
    except Exception as e:
        log.exception("plan failed")
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}") from e


@api.post("/plan/revise", response_model=PlanBundle)
async def plan_revise(req: ReviseRequest) -> PlanBundle:
    s = get_settings()
    try:
        critic_obj = CriticVerdict(**req.critic)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"invalid critic payload: {e}") from e
    seeded_ctx = _apply_critic_fixes_to_context(req.context, critic_obj)
    return await _run_pipeline(
        req.raw_prompt, seeded_ctx,
        auto_revise=(critic_obj.status == "revise"),
        dispatch=True,
    )


@api.get("/memory", response_model=MemoryContext)
async def get_memory(prompt: str, context: str | None = None) -> MemoryContext:
    return await memory.retrieve(prompt, context)


@api.post("/memory/commit")
async def commit_memory(wb: MemoryWriteback) -> dict[str, Any]:
    written = await memory.commit_writebacks(wb.recommendations)
    return {"written_ids": written, "committed": len(written), "submitted": len(wb.recommendations)}


app.include_router(api)


# Local dev entrypoint: `uvicorn orchestrator.main:app --host 0.0.0.0 --port 8080`
