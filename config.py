"""Config loader. Vercel-ready: reads env vars directly (no .env file in prod).

On Vercel, env vars are injected by the platform. For local dev, we still
honor a .env file via python-dotenv if present. Two new knobs vs the local
backend version:

  WORKER_MODE                inline | http  — inline returns synthetic worker
                                              responses without HTTP (serverless default).
  DATABASE_URL_REQUIRES_SSL  true | false   — controls whether asyncpg forces SSL.
                                              Neon requires SSL; local Postgres does not.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

try:
    from dotenv import load_dotenv
    _HAS_DOTENV = True
except Exception:
    _HAS_DOTENV = False


@dataclass(frozen=True)
class Settings:
    orchestrator_host: str
    orchestrator_port: int
    database_url: str
    database_requires_ssl: bool
    manus_base_url: str
    openclaw_base_url: str
    openclaw_gateway_token: str | None
    worker_mode: str  # "inline" or "http"
    worker_timeout_seconds: float
    router_min_confidence: float
    max_revisions: int
    memwb_min_confidence: float
    anthropic_api_key: str | None
    anthropic_model: str
    haiku_model: str
    enable_persist_runs: bool


def _truthy(val: str | None, default: bool = False) -> bool:
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "y", "on")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    if _HAS_DOTENV:
        load_dotenv()
        load_dotenv(".env.local", override=True)

    # Default to inline workers on Vercel (VERCEL env var is set by the platform).
    is_vercel = bool(os.getenv("VERCEL"))
    default_worker_mode = "inline" if is_vercel else "http"
    # Neon always requires SSL. Auto-detect from DSN substring too.
    default_ssl = is_vercel or "neon" in (os.getenv("DATABASE_URL") or "")

    return Settings(
        orchestrator_host=os.getenv("ORCHESTRATOR_HOST", "0.0.0.0"),
        orchestrator_port=int(os.getenv("ORCHESTRATOR_PORT", "8080")),
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql://valos:valos@localhost:5433/valos",
        ),
        database_requires_ssl=_truthy(os.getenv("DATABASE_URL_REQUIRES_SSL"), default_ssl),
        manus_base_url=os.getenv("MANUS_BASE_URL", "http://localhost:8081"),
        openclaw_base_url=os.getenv("OPENCLAW_BASE_URL", "http://localhost:18789"),
        openclaw_gateway_token=os.getenv("OPENCLAW_GATEWAY_TOKEN"),
        worker_mode=os.getenv("WORKER_MODE", default_worker_mode).strip().lower(),
        worker_timeout_seconds=float(os.getenv("WORKER_TIMEOUT_SECONDS", "15")),
        router_min_confidence=float(os.getenv("ROUTER_MIN_CONFIDENCE", "0.75")),
        max_revisions=int(os.getenv("MAX_REVISIONS", "2")),
        memwb_min_confidence=float(os.getenv("MEMWB_MIN_CONFIDENCE", "0.75")),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
        anthropic_model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        haiku_model=os.getenv("HAIKU_MODEL", "claude-haiku-4-5-20251001"),
        # On serverless, writing plan_runs on every request wastes the only
        # DB connection of the invocation. Off by default on Vercel.
        enable_persist_runs=_truthy(os.getenv("ENABLE_PERSIST_RUNS"), not is_vercel),
    )
