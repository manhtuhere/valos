"""FastAPI orchestrator for Val OS — Vercel-ready.

All routes live under /api/* so Vercel's static-first router leaves them to the
serverless function. The rest of the file mirrors val-os-backend, with two
changes:

- persist_run is gated on Settings.enable_persist_runs (off by default on
  Vercel: one connection per invocation is precious).
- CORS open for browsers, but same-origin calls from val-os.html don't need it.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

import brain, memory
from config import get_settings
from schemas import (
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
from workers import dispatch_routes

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


def _sse(stage: str, data: dict, *, done: bool = False) -> str:
    payload: dict[str, Any] = {"stage": stage, "output": data}
    if done:
        payload["done"] = True
    return f"data: {json.dumps(payload)}\n\n"


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
    openclaw_url: str | None = None,
    openclaw_token: str | None = None,
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

    intent_ = await asyncio.to_thread(brain.intent, raw_prompt, ctx)
    reframe_ = await asyncio.to_thread(brain.reframe, raw_prompt, ctx, intent_)
    scope_ = await asyncio.to_thread(brain.scope, raw_prompt, ctx, intent_, reframe_)
    arch = await asyncio.to_thread(brain.architect, raw_prompt, ctx, intent_, reframe_, scope_)
    research_, execution_ = await asyncio.gather(
        asyncio.to_thread(brain.research, raw_prompt, ctx, reframe_, scope_, arch),
        asyncio.to_thread(brain.execution, raw_prompt, ctx, scope_, arch),
    )
    routing: RoutingPlan = await asyncio.to_thread(
        brain.router, scope_, arch, research_, execution_, min_confidence=s.router_min_confidence
    )

    bundle_for_critic = {
        "architecture": arch.model_dump(), "scope": scope_.model_dump(),
        "research": research_.model_dump(), "execution": execution_.model_dump(),
        "reframe": reframe_.model_dump(), "routing": routing.model_dump(),
    }
    critic_ = await asyncio.to_thread(brain.critic, raw_prompt, ctx, bundle_for_critic)

    revisions = starting_revisions
    while auto_revise and critic_.status == "revise" and revisions < s.max_revisions:
        revisions += 1
        new_ctx = _apply_critic_fixes_to_context(ctx, critic_)
        log.info("revision %d/%d — re-running with critic fixes", revisions, s.max_revisions)
        scope_ = await asyncio.to_thread(brain.scope, raw_prompt, new_ctx, intent_, reframe_)
        arch = await asyncio.to_thread(brain.architect, raw_prompt, new_ctx, intent_, reframe_, scope_)
        research_, execution_ = await asyncio.gather(
            asyncio.to_thread(brain.research, raw_prompt, new_ctx, reframe_, scope_, arch),
            asyncio.to_thread(brain.execution, raw_prompt, new_ctx, scope_, arch),
        )
        routing = await asyncio.to_thread(
            brain.router, scope_, arch, research_, execution_, min_confidence=s.router_min_confidence
        )
        critic_ = await asyncio.to_thread(brain.critic, raw_prompt, new_ctx, {
            "architecture": arch.model_dump(), "scope": scope_.model_dump(),
            "research": research_.model_dump(), "execution": execution_.model_dump(),
            "reframe": reframe_.model_dump(), "routing": routing.model_dump(),
        })

    worker_feedback: list[WorkerResponse] = []
    if dispatch and critic_.status in ("approve", "revise"):
        routes_json = [r.model_dump() for r in routing.routes]
        worker_feedback = await dispatch_routes(
            routes_json, ctx, openclaw_url=openclaw_url, openclaw_token=openclaw_token
        )
        needs_rev = [w for w in worker_feedback if w.status == "needs_revision"]
        if needs_rev:
            notes = "; ".join(f"{w.worker}: {w.logs[0] if w.logs else 'needs_revision'}" for w in needs_rev)
            critic_ = await asyncio.to_thread(brain.critic, raw_prompt, f"{ctx or ''}\nWorker feedback: {notes}", {
                "architecture": arch.model_dump(), "scope": scope_.model_dump(),
                "research": research_.model_dump(), "execution": execution_.model_dump(),
                "reframe": reframe_.model_dump(), "routing": routing.model_dump(),
            })

    output_ = await asyncio.to_thread(brain.output, raw_prompt, ctx, intent_, reframe_, scope_, arch)
    memwb = await asyncio.to_thread(brain.memwb, critic_)

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


async def _run_pipeline_stream(
    raw_prompt: str,
    ctx: str | None,
    *,
    auto_revise: bool,
    dispatch: bool,
    openclaw_url: str | None = None,
    openclaw_token: str | None = None,
) -> AsyncGenerator[str, None]:
    s = get_settings()
    t0 = time.monotonic()
    run_id = uuid.uuid4()

    intake = Intake(request_id=str(run_id), timestamp=_now_iso())
    yield _sse("intake", intake.model_dump())

    try:
        mem_ctx: MemoryContext = await memory.retrieve(raw_prompt, ctx)
    except Exception as e:
        log.warning("memory retrieve failed: %s", e)
        mem_ctx = MemoryContext(rows=[])
    yield _sse("memory", mem_ctx.model_dump())

    try:
        intent_ = await asyncio.to_thread(brain.intent, raw_prompt, ctx)
        yield _sse("intent", intent_.model_dump())

        reframe_ = await asyncio.to_thread(brain.reframe, raw_prompt, ctx, intent_)
        yield _sse("reframe", reframe_.model_dump())

        scope_ = await asyncio.to_thread(brain.scope, raw_prompt, ctx, intent_, reframe_)
        yield _sse("scope", scope_.model_dump())

        arch = await asyncio.to_thread(brain.architect, raw_prompt, ctx, intent_, reframe_, scope_)
        yield _sse("architect", arch.model_dump())

        research_, execution_ = await asyncio.gather(
            asyncio.to_thread(brain.research, raw_prompt, ctx, reframe_, scope_, arch),
            asyncio.to_thread(brain.execution, raw_prompt, ctx, scope_, arch),
        )
        yield _sse("research", research_.model_dump())
        yield _sse("execution", execution_.model_dump())

        routing = await asyncio.to_thread(
            brain.router, scope_, arch, research_, execution_, min_confidence=s.router_min_confidence
        )
        yield _sse("router", routing.model_dump())

        bundle_for_critic = {
            "architecture": arch.model_dump(), "scope": scope_.model_dump(),
            "research": research_.model_dump(), "execution": execution_.model_dump(),
            "reframe": reframe_.model_dump(), "routing": routing.model_dump(),
        }
        critic_ = await asyncio.to_thread(brain.critic, raw_prompt, ctx, bundle_for_critic)
        yield _sse("critic", critic_.model_dump())

        revisions = 0
        while auto_revise and critic_.status == "revise" and revisions < s.max_revisions:
            revisions += 1
            new_ctx = _apply_critic_fixes_to_context(ctx, critic_)
            log.info("revision %d/%d — re-running with critic fixes", revisions, s.max_revisions)
            scope_ = await asyncio.to_thread(brain.scope, raw_prompt, new_ctx, intent_, reframe_)
            arch = await asyncio.to_thread(brain.architect, raw_prompt, new_ctx, intent_, reframe_, scope_)
            research_, execution_ = await asyncio.gather(
                asyncio.to_thread(brain.research, raw_prompt, new_ctx, reframe_, scope_, arch),
                asyncio.to_thread(brain.execution, raw_prompt, new_ctx, scope_, arch),
            )
            routing = await asyncio.to_thread(
                brain.router, scope_, arch, research_, execution_, min_confidence=s.router_min_confidence
            )
            critic_ = await asyncio.to_thread(brain.critic, raw_prompt, new_ctx, {
                "architecture": arch.model_dump(), "scope": scope_.model_dump(),
                "research": research_.model_dump(), "execution": execution_.model_dump(),
                "reframe": reframe_.model_dump(), "routing": routing.model_dump(),
            })
            yield _sse("scope", scope_.model_dump())
            yield _sse("architect", arch.model_dump())
            yield _sse("research", research_.model_dump())
            yield _sse("execution", execution_.model_dump())
            yield _sse("router", routing.model_dump())
            yield _sse("critic", {**critic_.model_dump(), "revision": revisions})

        worker_feedback: list[WorkerResponse] = []
        if dispatch and critic_.status in ("approve", "revise"):
            routes_json = [r.model_dump() for r in routing.routes]
            worker_results = await dispatch_routes(
                routes_json, ctx, openclaw_url=openclaw_url, openclaw_token=openclaw_token
            )
            for wr in worker_results:
                worker_feedback.append(wr)
                yield _sse("worker", wr.model_dump())
            needs_rev = [w for w in worker_feedback if w.status == "needs_revision"]
            if needs_rev:
                notes = "; ".join(
                    f"{w.worker}: {w.logs[0] if w.logs else 'needs_revision'}" for w in needs_rev
                )
                critic_ = await asyncio.to_thread(brain.critic, raw_prompt, f"{ctx or ''}\nWorker feedback: {notes}", {
                    "architecture": arch.model_dump(), "scope": scope_.model_dump(),
                    "research": research_.model_dump(), "execution": execution_.model_dump(),
                    "reframe": reframe_.model_dump(), "routing": routing.model_dump(),
                })
                yield _sse("critic", {**critic_.model_dump(), "revision": revisions})

        output_ = await asyncio.to_thread(brain.output, raw_prompt, ctx, intent_, reframe_, scope_, arch)
        yield _sse("output", output_.model_dump())

        memwb_ = await asyncio.to_thread(brain.memwb, critic_)
        latency_ms = int((time.monotonic() - t0) * 1000)

        bundle = PlanBundle(
            request_id=str(run_id), intake=intake, memory=mem_ctx,
            intent=intent_, reframe=reframe_, scope=scope_, architecture=arch,
            research=research_, execution=execution_, routing=routing, critic=critic_,
            worker_feedback=worker_feedback, output=output_, memory_writeback=memwb_,
            revisions=revisions, latency_ms=latency_ms,
        )
        await _persist_run(raw_prompt, ctx, bundle)
        yield _sse("memwb", memwb_.model_dump(), done=True)

    except Exception as e:
        log.exception("pipeline stage failed")
        yield f"data: {json.dumps({'error': f'{type(e).__name__}: {e}'})}\n\n"


# --- /api routes ------------------------------------------------------------

@api.get("/openclaw/ping")
async def openclaw_ping(url: str, token: str = "") -> dict[str, Any]:
    """Lightweight connectivity + auth check — does NOT send any execution prompt."""
    import time
    import httpx
    t0 = time.monotonic()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    probes = ["/healthz", "/health", "/api/health", "/"]
    last_err: str | None = None
    for path in probes:
        try:
            async with httpx.AsyncClient(base_url=url, timeout=5.0) as c:
                r = await c.get(path, headers=headers)
            latency = int((time.monotonic() - t0) * 1000)
            if r.status_code == 401 or r.status_code == 403:
                return {"ok": False, "status": r.status_code, "latency_ms": latency,
                        "detail": "auth failed — check your gateway token"}
            return {"ok": True, "status": r.status_code, "latency_ms": latency,
                    "detail": f"reachable ({path})"}
        except httpx.ConnectError:
            last_err = "connection refused"
            break
        except httpx.TimeoutException:
            last_err = "timed out after 5s"
            break
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
    latency = int((time.monotonic() - t0) * 1000)
    return {"ok": False, "status": None, "latency_ms": latency, "detail": last_err or "unreachable"}


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


@api.post("/plan")
async def plan(req: PlanRequest) -> StreamingResponse:
    return StreamingResponse(
        _run_pipeline_stream(
            req.raw_prompt, req.context,
            auto_revise=req.auto_revise, dispatch=req.dispatch_workers,
            openclaw_url=req.openclaw_base_url, openclaw_token=req.openclaw_gateway_token,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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
