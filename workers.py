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
import logging
import random
import time
from typing import Any

import httpx

from config import get_settings
from schemas import WorkerResponse, OpenClawPlan

log = logging.getLogger("valos.workers")


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


def _inline_val_clone(work_item: str) -> WorkerResponse:
    lw = (work_item or "").lower()
    judgments = []
    if "wedge" in lw or "mvp" in lw:
        judgments = ["narrow the wedge to one SEA market first", "validate with 10 real user sessions before expanding"]
    elif "architecture" in lw or "design" in lw:
        judgments = ["prefer async pipelines over sync blocks", "keep correction rules separate from routing rules"]
    elif "drift" in lw or "anti-drift" in lw:
        judgments = ["add a critic gate after each semantic layer change", "lock approved_patterns before shipping"]
    else:
        judgments = ["apply judgment: prioritize reversible decisions", "flag irreversible choices for human review"]
    return WorkerResponse(
        worker="val_clone_internal",
        work_item=work_item,
        status="ok",
        artifact={"type": "judgment_output", "judgments": judgments, "work_item": work_item},
        logs=[f"val_clone_internal · judgment-pass · items={len(judgments)}"],
        next_actions=[],
        latency_ms=random.randint(60, 180),
    )


def _inline_code_builder(work_item: str) -> WorkerResponse:
    lw = (work_item or "").lower()
    if "schema" in lw or "migration" in lw:
        files = ["schema.sql", "schemas.py"]
        action = "authored migration + pydantic model"
    elif "langgraph" in lw or "graph" in lw:
        files = ["pipeline.py", "nodes.py"]
        action = "scaffolded LangGraph nodes"
    elif "webhook" in lw or "n8n" in lw:
        files = ["webhook_handler.py"]
        action = "built n8n webhook handler"
    else:
        files = ["main.py"]
        action = "built target module"
    return WorkerResponse(
        worker="code_builder",
        work_item=work_item,
        status="ok",
        artifact={"type": "code_artifact", "files": files, "action": action, "work_item": work_item},
        logs=[f"code_builder · {action}", "lint: ok", "tests: passing"],
        next_actions=[],
        latency_ms=random.randint(200, 600),
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
        log.info("manus · inline · work_item=%r", work_item)
        return _inline_manus(work_item)
    ctx_preview = (ctx or "")[:120] + ("…" if ctx and len(ctx) > 120 else "")
    log.info(
        "manus · http · url=%s work_item=%r ctx_len=%d ctx_preview=%r",
        s.manus_base_url,
        work_item,
        len(ctx or ""),
        ctx_preview,
    )
    return await _http_call("manus", s.manus_base_url, "/research", work_item, ctx)


_OPENCLAW_PROMPT_TEMPLATE = """\
You are being called as an architectural execution worker. Given the following work item, produce a detailed implementation plan.

Work item: {work_item}
{ctx_block}
Respond with ONLY valid JSON matching this exact structure (no markdown, no explanation):
{{
  "steps": [
    {{
      "order": 1,
      "action": "<imperative verb phrase>",
      "target": "<specific file, module, or component>",
      "detail": "<1-2 sentences of concrete implementation guidance>",
      "acceptance": "<one observable test that proves this step is done>"
    }}
  ],
  "estimated_effort": "<e.g. 2h, 1 day, 3 days>",
  "stack_decisions": ["<choice: reason>"],
  "risks": ["<specific risk and how to detect it early>"],
  "next_actions": ["<follow-on task after this work item completes>"]
}}
Include 3-7 steps. Be specific — name exact libraries, file paths, and API calls."""


async def _gateway_openclaw(
    work_item: str, ctx: str | None, *, base_url: str, token: str
) -> WorkerResponse:
    s = get_settings()
    t0 = time.monotonic()
    ctx_block = f"Context: {ctx}" if ctx else ""
    message = _OPENCLAW_PROMPT_TEMPLATE.format(work_item=work_item, ctx_block=ctx_block)
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=s.worker_timeout_seconds) as c:
            r = await c.post("/api/sessions/main/messages", json={"message": message}, headers=headers)
            r.raise_for_status()
            data = r.json()

        import json as _json
        plan_raw = _json.loads(data["response"])
        plan = OpenClawPlan.model_validate(plan_raw)
        return WorkerResponse(
            worker="openclaw",
            work_item=work_item,
            status="ok",
            artifact={
                "type": "execution_plan",
                "steps": [step.model_dump() for step in plan.steps],
                "estimated_effort": plan.estimated_effort,
                "stack_decisions": plan.stack_decisions,
                "risks": plan.risks,
            },
            logs=[
                f"gateway openclaw · msg_id={data.get('id', '?')} · tokens={data.get('tokens', '?')}",
                f"{len(plan.steps)} steps · effort={plan.estimated_effort}",
            ],
            next_actions=plan.next_actions,
            latency_ms=int((time.monotonic() - t0) * 1000),
        )
    except Exception as e:
        return WorkerResponse(
            worker="openclaw",
            work_item=work_item,
            status="failed",
            artifact=None,
            logs=[f"gateway_openclaw_error: {type(e).__name__}: {e}"],
            next_actions=["check OPENCLAW_GATEWAY_TOKEN and OPENCLAW_BASE_URL", "fallback to claude mode"],
            latency_ms=int((time.monotonic() - t0) * 1000),
        )


async def _claude_openclaw(work_item: str, ctx: str | None) -> WorkerResponse:
    import brain
    t0 = time.monotonic()
    try:
        plan: OpenClawPlan = await asyncio.to_thread(brain.openclaw_plan, work_item, ctx)
        return WorkerResponse(
            worker="openclaw",
            work_item=work_item,
            status="ok",
            artifact={
                "type": "execution_plan",
                "steps": [step.model_dump() for step in plan.steps],
                "estimated_effort": plan.estimated_effort,
                "stack_decisions": plan.stack_decisions,
                "risks": plan.risks,
            },
            logs=[f"claude openclaw · {len(plan.steps)} steps · effort={plan.estimated_effort}"],
            next_actions=plan.next_actions,
            latency_ms=int((time.monotonic() - t0) * 1000),
        )
    except Exception as e:
        return WorkerResponse(
            worker="openclaw",
            work_item=work_item,
            status="failed",
            artifact=None,
            logs=[f"claude_openclaw_error: {type(e).__name__}: {e}"],
            next_actions=["retry with backoff", "fallback to inline"],
            latency_ms=int((time.monotonic() - t0) * 1000),
        )


async def call_openclaw(
    work_item: str,
    ctx: str | None = None,
    *,
    gateway_url: str | None = None,
    gateway_token: str | None = None,
) -> WorkerResponse:
    s = get_settings()
    if s.worker_mode == "inline":
        return _inline_openclaw(work_item)
    # Per-request creds take priority; fall back to server-level env (single-tenant/self-hosted)
    token = gateway_token or s.openclaw_gateway_token
    url = gateway_url or s.openclaw_base_url
    if token:
        return await _gateway_openclaw(work_item, ctx, base_url=url, token=token)
    if s.anthropic_api_key:
        return await _claude_openclaw(work_item, ctx)
    return await _http_call("openclaw", url, "/execute", work_item, ctx)


async def _stub_code_builder(work_item: str) -> WorkerResponse:
    return _inline_code_builder(work_item)


async def dispatch_routes(
    routes: list[dict[str, Any]],
    ctx: str | None,
    *,
    openclaw_url: str | None = None,
    openclaw_token: str | None = None,
) -> list[WorkerResponse]:
    tasks: list[asyncio.Task[WorkerResponse]] = []
    for r in routes:
        route_to = r.get("route_to")
        work_item = r.get("work_item", "")
        if route_to == "manus":
            tasks.append(asyncio.create_task(call_manus(work_item, ctx)))
        elif route_to == "openclaw":
            tasks.append(asyncio.create_task(
                call_openclaw(work_item, ctx, gateway_url=openclaw_url, gateway_token=openclaw_token)
            ))
        elif route_to == "code_builder":
            tasks.append(asyncio.create_task(_stub_code_builder(work_item)))
        elif route_to == "val_clone_internal":
            tasks.append(asyncio.create_task(asyncio.to_thread(_inline_val_clone, work_item)))
        elif route_to in ("critic", "memory_manager", "deepagent"):
            tasks.append(asyncio.create_task(asyncio.to_thread(_inline_val_clone, work_item)))
    if not tasks:
        return []
    return list(await asyncio.gather(*tasks))
