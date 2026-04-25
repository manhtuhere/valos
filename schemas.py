"""Pydantic models for every stage boundary.

Kept deliberately permissive (Extra.allow) because the judgment engine may add
fields as it evolves — the contract is the documented keys, not a hard lock.
"""
from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _coerce_json(v: Any) -> Any:
    """Coerce JSON-encoded strings to dicts/lists (Claude tool_use sometimes returns nested objects as strings)."""
    if isinstance(v, str):
        try:
            return json.loads(v)
        except (json.JSONDecodeError, ValueError):
            pass
    return v


class _Base(BaseModel):
    model_config = ConfigDict(extra="allow")


RouteTo = Literal[
    "val_clone_internal",
    "manus",
    "openclaw",
    "code_builder",
    "critic",
    "memory_manager",
]


class PlanRequest(_Base):
    raw_prompt: str = Field(..., min_length=1)
    context: str | None = None
    auto_revise: bool = True
    dispatch_workers: bool = True
    openclaw_base_url: str | None = None   # user's local OpenClaw instance URL
    openclaw_gateway_token: str | None = None  # user's OpenClaw gateway token


class ReviseRequest(_Base):
    raw_prompt: str
    context: str | None = None
    previous_bundle: dict[str, Any]
    critic: dict[str, Any]  # { status, failures[], fixes[], score, strongest_part }
    max_revisions: int | None = None


class Intake(_Base):
    request_id: str
    type: str = "founder_build_prompt"
    timestamp: str


class Intent(_Base):
    core_goal: str
    user_type: str
    domain: str
    build_category: str
    ambiguities: list[str] = []
    assumptions: list[str] = []


class Reframe(_Base):
    problem_statement: str
    wedge: str
    success_definition: str
    non_goals: list[str] = []


class Scope(_Base):
    must_have: list[str] = []
    should_have: list[str] = []
    defer: list[str] = []
    mock_ok: list[str] = []
    must_be_real: list[str] = []


class Architecture(_Base):
    system_modules: list[str] = []
    module_responsibilities: dict[str, str] = {}
    data_flow: list[str] = []
    dependencies: list[str] = []
    failure_points: list[str] = []
    memory_vs_runtime: dict[str, list[str]] = {"memory": [], "runtime": []}

    @field_validator("module_responsibilities", "memory_vs_runtime", mode="before")
    @classmethod
    def _coerce(cls, v: Any) -> Any:
        return _coerce_json(v)


class ResearchTask(_Base):
    task_id: str
    objective: str
    why_it_matters: str
    source_type: str
    deliverable: str


class Research(_Base):
    research_tasks: list[ResearchTask] = []


class ExecutionTask(_Base):
    task_id: str
    title: str
    owner_type: str
    depends_on: list[str] = []
    acceptance_criteria: list[str] = []
    mockable: bool = False


class Execution(_Base):
    execution_tasks: list[ExecutionTask] = []


class Route(_Base):
    work_item: str
    route_to: RouteTo
    reason: str
    confidence: float
    fallback: RouteTo | None = None


class RoutingPlan(_Base):
    routes: list[Route] = []


class CriticVerdict(_Base):
    status: Literal["approve", "revise", "reject"]
    score: float
    failures: list[str] = []
    fixes: list[str] = []
    strongest_part: str = ""


class MemoryRow(_Base):
    memory_type: str
    id: str
    title: str
    content: str
    tags: list[str] = []
    score: float = 0.0


class MemoryContext(_Base):
    rows: list[MemoryRow] = []


class OpenClawStep(_Base):
    order: int
    action: str
    target: str
    detail: str
    code_hint: str = ""
    acceptance: str
    observability: str = ""


class OpenClawPlan(_Base):
    steps: list[OpenClawStep]
    estimated_effort: str
    stack_decisions: list[str] = []
    environment_setup: list[str] = []
    risks: list[str] = []
    next_actions: list[str] = []


class PromptGate(_Base):
    passed: bool
    score: float
    missing: list[str] = []
    suggestions: list[str] = []
    rejection_reason: str = ""


class StageCoherence(_Base):
    aligned: bool
    drift_detected: bool = False
    issues: list[str] = []
    corrections: list[str] = []
    proceed: bool = True


class WorkerResponse(_Base):
    worker: Literal["manus", "openclaw"]
    work_item: str
    status: Literal["ok", "partial", "failed", "needs_revision"]
    artifact: dict[str, Any] | None = None
    logs: list[str] = []
    next_actions: list[str] = []
    latency_ms: int = 0


class MemoryRecommendation(_Base):
    should_write: bool
    memory_type: str
    title: str
    content: str
    tags: list[str] = []
    confidence: float
    justification: str


class MemoryWriteback(_Base):
    recommendations: list[MemoryRecommendation] = []


class MockedVsReal(_Base):
    mocked: list[str] = []
    real: list[str] = []


class PRD(_Base):
    product_definition: str
    target_user: str
    problem_statement: str
    wedge: str
    user_stories: list[str] = []
    success_criteria: list[str] = []
    kpis: list[str] = []
    non_goals: list[str] = []
    mvp_feature_set: list[str] = []
    mocked_vs_real: MockedVsReal = MockedVsReal()
    competitive_moat: str = ""

    @field_validator("mocked_vs_real", mode="before")
    @classmethod
    def _coerce_mvr(cls, v: Any) -> Any:
        return _coerce_json(v)


class SystemSpec(_Base):
    modules: list[str] = []
    data_flow: list[str] = []
    api_contracts: list[str] = []
    dependencies: list[str] = []
    environment_variables: list[str] = []
    failure_states: list[str] = []


class QACheck(_Base):
    category: str
    test: str
    input: str = ""
    expected_output: str = ""
    pass_threshold: str = ""


class OutputBundle(_Base):
    prd: PRD
    system_spec: SystemSpec = SystemSpec()
    qa_checklist: list[QACheck] = []
    deployment_checklist: list[str] = []

    @field_validator("prd", "system_spec", mode="before")
    @classmethod
    def _coerce(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                v = json.loads(v)
            except (json.JSONDecodeError, ValueError):
                pass
        return v


class PlanBundle(_Base):
    request_id: str
    intake: Intake
    memory: MemoryContext
    intent: Intent
    reframe: Reframe
    scope: Scope
    architecture: Architecture
    research: Research
    execution: Execution
    routing: RoutingPlan
    critic: CriticVerdict
    worker_feedback: list[WorkerResponse] = []
    output: OutputBundle
    memory_writeback: MemoryWriteback
    revisions: int = 0
    latency_ms: int = 0
