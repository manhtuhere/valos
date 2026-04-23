"""Worker clients — Vercel-ready with an inline mode.

Two modes, selected by Settings.worker_mode:

  http     — POST to the Manus / OpenClaw HTTP endpoints (local dev, real workers)
  inline   — return shape-correct synthetic WorkerResponses without any HTTP call
             (Vercel default — no separate worker processes need to run)

Both modes return the same WorkerResponse shape, so the execution feedback
loop behaves identically. Swap to http mode + point MANUS_BASE_URL /
OPENCLAW_BASE_URL at real workers when you're ready.
"""
from __future__ import annotations

import asyncio
import random
import time
from typing import Any

import httpx

from .config import get_settings
from .schemas import WorkerResponse


# --- inline mode --------------------------------------------------------------

def _plan_execution_steps(work_item: str) -> list[str]:
    lw = (work_item or "").lower()
    if "scaffold" in lw:
        return ["create directory tree", "write config files", "install deps", "smoke-run boot"]
    if "implement" in lw or "wire" in lw:
        return ["read target file set", "apply edits", "run lint", "run tests"]
    if "schema" in lw or "migration" in lw:
        return ["read current schema", "author migration", "dry-run apply", "rollback plan"]
    if "log" in lw or "observability" in lw:
        return ["attach structured logger", "emit per-stage events", "verify log shape"]
    return ["parse work_item", "run action", "verify acceptance criteria", "emit artifact"]


def _shape_research_artifact(work_item: str) -> dict[str, Any]:
    lw = (work_item or "").lower()
    if "compare" in lw or "vs" in lw:
        return {"type": "comparison_table", "columns": ["option", "pros", "cons", "fit"], "rows_count": 3}
    if "tradeoff" in lw or "trade-off" in lw:
        return {"type": "tradeoff_matrix", "axes": ["cost", "complexity", "time_to_value"], "options": 3}
    if "pattern" in lw or "architecture" in lw:
        return {"type": "pattern_catalog", "patterns": 4, "recommended_count": 1}
    return {"type": "summary", "key_findings": 3, "citations": 2}


def _inline_manus(work_item: str) -> WorkerResponse:
    short = len((work_item or "").split()) < 5
    # Mirror the real worker's rough failure distribution but deterministic enough for demos.
    roll = random.random()
    status = "ok"
    next_actions: list[str] = []
    if short and roll < 0.35:
        status = "needs_revision"
        next_actions = ["rephrase work_item with a concrete subject"]
    elif roll < 0.05:
        status = "partial"
        next_actions = ["re-run with expanded context"]

    return WorkerResponse(
        worker="manus",
        work_item=work_item,
        status=status,
        artifact=_shape_research_artifact(work_item),
        logs=[f"inline manus · work_item words={len((work_item or '').split())}"],
        next_actions=next_actions,
        latency_ms=random.randint(80, 260),
    )


def _inline_openclaw(work_item: str) -> WorkerResponse:
    steps = _plan_execution_steps(work_item)
    roll = random.random()
    if roll < 0.70:
        status = "ok"
    elif roll < 0.85:
        status = "partial"
    elif roll < 0.95:
        status = "needs_revision"
    else:
        status = "failed"
    completed = steps if status == "ok" else steps[: max(1, len(steps) - 1)]
    logs = [f"planned {len(steps)} steps", *(f"step ok: {s}" for s in completed)]
    next_actions: list[str] = []
    if status == "partial":
        logs.append(f"step blocked: {steps[-1]}")
        next_actions = ["re-run blocked step with more context"]
    if status == "needs_revision":
        logs.append("acceptance criteria not met on first pass")
        next_actions = ["tighten acceptance criteria", "re-run with clarified scope"]
    if status == "failed":
        logs.append("fatal: inline sandbox errored")
        next_actions = ["retry with backoff", "fallback to val_clone_internal"]

    return WorkerResponse(
        worker="openclaw",
        work_item=work_item,
        status=status,
        artifact={"type": "execution_report", "steps": steps, "completed": completed, "work_item": work_item},
        logs=logs,
        next_actions=next_actions,
        latency_ms=random.randint(120, 420),
    )


# --- http mode ---------------------------------------------------------------

async def _post(base_url: str, path: str, payload: dict[str, Any], timeout_s: float) -> dict[str, Any]:
    async with httpx.AsyncClient(base_url=base_url, timeout=timeout_s) as c:
        r = await c.post(path, json=payload)
        r.raise_for_status()
        return r.json()


async def _http_call(worker: str, base_url: str, path: str, work_item: str, ctx: str | None) -> WorkerResponse:
    s = get_settings()
    t0 = time.monotonic()
    try:
        data = await _post(base_url, path, {"work_item": work_item, "context": ctx or ""}, s.worker_timeout_seconds)
        data["worker"] = worker
        data.setdefault("latency_ms", int((time.monotonic() - t0) * 1000))
        return WorkerResponse(**data)
    except Exception as e:
        return WorkerResponse(
            worker=worker,  # type: ignore[arg-type]
            work_item=work_item,
            status="failed",
            artifact=None,
            logs=[f"worker_error: {type(e).__name__}: {e}"],
            next_actions=["retry with backoff", "fallback to val_clone_internal"],
            latency_ms=int((time.monotonic() - t0) * 1000),
        )


# --- public API --------------------------------------------------------------

async def call_manus(work_item: str, ctx: str | None = None) -> WorkerResponse:
    s = get_settings()
    if s.worker_mode == "inline":
        return _inline_manus(work_item)
    return await _http_call("manus", s.manus_base_url, "/research", work_item, ctx)


async def call_openclaw(work_item: str, ctx: str | None = None) -> WorkerResponse:
    s = get_settings()
    if s.worker_mode == "inline":
        return _inline_openclaw(work_item)
    return await _http_call("openclaw", s.openclaw_base_url, "/execute", work_item, ctx)


async def _stub_code_builder(work_item: str) -> WorkerResponse:
    return WorkerResponse(
        worker="openclaw",
        work_item=work_item,
        status="partial",
        artifact={"note": "code_builder dispatch not implemented; stage deferred"},
        logs=["code_builder not wired in v1"],
        next_actions=["wire real code_builder", "fallback to openclaw"],
        latency_ms=1,
    )


async def dispatch_routes(routes: list[dict[str, Any]], ctx: str | None) -> list[WorkerResponse]:
    tasks: list[asyncio.Task[WorkerResponse]] = []
    for r in routes:
        route_to = r.get("route_to")
        work_item = r.get("work_item", "")
        if route_to == "manus":
            tasks.append(asyncio.create_task(call_manus(work_item, ctx)))
        elif route_to == "openclaw":
            tasks.append(asyncio.create_task(call_openclaw(work_item, ctx)))
        elif route_to == "code_builder":
            tasks.append(asyncio.create_task(_stub_code_builder(work_item)))
    if not tasks:
        return []
    return list(await asyncio.gather(*tasks))
