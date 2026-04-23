"""Typed memory layer — serverless-safe asyncpg.

Differences vs local backend:
- Tiny pool (min=0, max=2) so a cold Vercel invocation doesn't waste time
  opening connections it won't use.
- SSL is enabled automatically for Neon (driven by Settings.database_requires_ssl).
- If Postgres is unreachable, retrieve() returns an empty MemoryContext so the
  pipeline still produces a bundle — memory is not a hard dependency.
"""
from __future__ import annotations

import ssl
from typing import Iterable

import asyncpg

from .config import get_settings
from .schemas import MemoryContext, MemoryRecommendation, MemoryRow

TYPE_WEIGHT: dict[str, float] = {
    "founder_principles": 1.10,
    "routing_rules": 1.00,
    "approved_patterns": 0.95,
    "product_preferences": 0.90,
    "failure_lessons": 1.05,
    "project_state": 0.85,
}

CAPS: dict[str, int] = {
    "founder_principles": 5,
    "routing_rules": 6,
    "approved_patterns": 3,
    "product_preferences": 5,
    "failure_lessons": 4,
    "project_state": 1,
}

STOP = {
    "a","an","the","and","or","to","for","of","in","on","with","by","me","my",
    "our","from","that","which","is","are","be","being","it","its","as","so",
    "into","onto","up","down","just","how","what","why","do","we","build","make",
}


def _tokens(s: str) -> list[str]:
    import re
    return [t for t in re.findall(r"[a-zA-Z0-9_]+", (s or "").lower()) if t not in STOP and len(t) > 2]


def _overlap(prompt_tokens: set[str], tags: Iterable[str]) -> int:
    c = 0
    for tag in tags or []:
        for part in str(tag).lower().replace("_", " ").split():
            if part in prompt_tokens:
                c += 1
    return c


_POOL: asyncpg.Pool | None = None


def _ssl_ctx() -> ssl.SSLContext | None:
    s = get_settings()
    if not s.database_requires_ssl:
        return None
    # Neon, Supabase, RDS: valid CA chain. Use default context for hostname verification.
    ctx = ssl.create_default_context()
    return ctx


async def get_pool() -> asyncpg.Pool:
    """Lazy pool. Sized for serverless (min=0, max=2)."""
    global _POOL
    if _POOL is None:
        s = get_settings()
        _POOL = await asyncpg.create_pool(
            dsn=s.database_url,
            min_size=0,
            max_size=2,
            command_timeout=15,
            ssl=_ssl_ctx(),
        )
    return _POOL


async def close_pool() -> None:
    global _POOL
    if _POOL is not None:
        await _POOL.close()
        _POOL = None


_QUERIES: dict[str, str] = {
    "founder_principles":  "SELECT id, title, content, tags, priority, 1.0::real AS conf, 3::smallint AS sev FROM founder_principles",
    "product_preferences": "SELECT id, title, content, tags, 3::smallint AS priority, confidence AS conf, 3::smallint AS sev FROM product_preferences",
    "routing_rules":       "SELECT id, title, content, tags, 3::smallint AS priority, confidence AS conf, 3::smallint AS sev FROM routing_rules",
    "approved_patterns":   "SELECT id, title, content, tags, 3::smallint AS priority, confidence AS conf, 3::smallint AS sev FROM approved_patterns",
    "failure_lessons":     "SELECT id, title, content, tags, 3::smallint AS priority, 1.0::real AS conf, severity AS sev FROM failure_lessons",
    "project_state":       "SELECT id, title, content, tags, 3::smallint AS priority, 1.0::real AS conf, 3::smallint AS sev FROM project_state",
}


async def retrieve(raw_prompt: str, context: str | None = None) -> MemoryContext:
    """Rank rows across all typed tables, return the top-N per category.

    On Postgres failure returns an empty MemoryContext rather than raising — memory
    is advisory, the pipeline must still produce a bundle.
    """
    try:
        pool = await get_pool()
    except Exception:
        return MemoryContext(rows=[])

    prompt_tokens = set(_tokens(f"{raw_prompt} {context or ''}"))
    rows_out: list[MemoryRow] = []

    try:
        async with pool.acquire() as conn:
            for mem_type, sql in _QUERIES.items():
                records = await conn.fetch(sql)
                scored: list[tuple[float, MemoryRow]] = []
                for r in records:
                    tags = list(r["tags"] or [])
                    overlap = _overlap(prompt_tokens, tags)
                    if overlap == 0 and mem_type != "founder_principles":
                        continue
                    base = overlap * TYPE_WEIGHT[mem_type]
                    prio_bonus = (6 - int(r["priority"] or 3)) * 0.1
                    conf_bonus = float(r["conf"] or 0.0) * 0.15
                    sev_bonus = (6 - int(r["sev"] or 3)) * 0.05 if mem_type == "failure_lessons" else 0.0
                    score = base + prio_bonus + conf_bonus + sev_bonus
                    scored.append((
                        score,
                        MemoryRow(
                            memory_type=mem_type,
                            id=str(r["id"]),
                            title=r["title"],
                            content=r["content"],
                            tags=tags,
                            score=round(score, 3),
                        ),
                    ))
                scored.sort(key=lambda x: x[0], reverse=True)
                for _, row in scored[: CAPS[mem_type]]:
                    rows_out.append(row)
    except Exception:
        return MemoryContext(rows=[])

    return MemoryContext(rows=rows_out)


async def commit_writebacks(recs: list[MemoryRecommendation]) -> list[str]:
    s = get_settings()
    try:
        pool = await get_pool()
    except Exception:
        return []
    written: list[str] = []
    async with pool.acquire() as conn:
        for rec in recs:
            if not rec.should_write or rec.confidence < s.memwb_min_confidence:
                continue
            mt = rec.memory_type
            try:
                if mt == "founder_principles":
                    rid = await conn.fetchval(
                        "INSERT INTO founder_principles (title, content, tags, priority) VALUES ($1,$2,$3,$4) RETURNING id",
                        rec.title, rec.content, rec.tags, 2,
                    )
                elif mt == "product_preferences":
                    rid = await conn.fetchval(
                        "INSERT INTO product_preferences (title, content, tags, confidence) VALUES ($1,$2,$3,$4) RETURNING id",
                        rec.title, rec.content, rec.tags, rec.confidence,
                    )
                elif mt == "routing_rules":
                    rid = await conn.fetchval(
                        "INSERT INTO routing_rules (title, content, tags, route_to, confidence, fallback) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
                        rec.title, rec.content, rec.tags, "val_clone_internal", rec.confidence, None,
                    )
                elif mt == "approved_patterns":
                    rid = await conn.fetchval(
                        "INSERT INTO approved_patterns (title, content, tags, confidence) VALUES ($1,$2,$3,$4) RETURNING id",
                        rec.title, rec.content, rec.tags, rec.confidence,
                    )
                elif mt == "failure_lessons":
                    rid = await conn.fetchval(
                        "INSERT INTO failure_lessons (title, content, tags, severity, fix) VALUES ($1,$2,$3,$4,$5) RETURNING id",
                        rec.title, rec.content, rec.tags, 3, None,
                    )
                elif mt == "project_state":
                    rid = await conn.fetchval(
                        "INSERT INTO project_state (project, title, content, tags) VALUES ($1,$2,$3,$4) RETURNING id",
                        "val_os_mvp", rec.title, rec.content, rec.tags,
                    )
                else:
                    continue
                if rid is not None:
                    written.append(str(rid))
            except Exception:
                # Per-row failures must not break commit of other rows.
                continue
    return written


def context_block(mem: MemoryContext, max_rows: int = 16) -> str:
    lines: list[str] = []
    for row in mem.rows[:max_rows]:
        lines.append(f"- [{row.memory_type}] {row.title}: {row.content}")
    return "\n".join(lines) if lines else "(no relevant memory retrieved)"
