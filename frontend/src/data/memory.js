/* Typed memory seed — 26 entries across 6 tables */
export const MEMORY = {
  founder_principles: [
    { title: "Judgment first, execution second", content: "Never let worker execution run ahead of wedge/scope/architecture judgment.", tags: ["governance", "planning", "core"], priority: 1 },
    { title: "Typed JSON at every module boundary", content: "Every stage emits typed JSON that the next stage consumes. No free-form blobs.", tags: ["architecture", "schema", "core"], priority: 1 },
    { title: "Prefer narrow wedge over broad MVP", content: "A demo that proves one cut of the value prop beats a half-working general tool.", tags: ["scope", "wedge", "mvp"], priority: 2 },
    { title: "Mock what you can, keep real what you must", content: "Cleanly separate mocked integrations from real ones in scope.mocked_vs_real.", tags: ["scope", "mvp", "integrations"], priority: 2 },
    { title: "Critic gate before assembling output", content: "No final output bundle assembles until critic returns approve.", tags: ["quality", "governance", "critic"], priority: 1 },
    { title: "Memory is typed tables, not a vector dump", content: "Memory retrieved by tag + type + priority, not nearest-neighbor embedding search.", tags: ["memory", "architecture", "core"], priority: 1 },
  ],
  product_preferences: [
    { title: "Dark UI with monospace for structured data", content: "Use dark theme; render JSON in monospace.", tags: ["ui", "design", "dx"], confidence: 0.9 },
    { title: "Visible system map over hidden orchestration", content: "Always show the 11-stage pipeline; never hide routing or critic.", tags: ["ui", "transparency", "dx"], confidence: 0.85 },
    { title: "FastAPI + Postgres + Next.js default stack", content: "Default backend FastAPI + Postgres, frontend Next.js.", tags: ["stack", "default"], confidence: 0.8 },
    { title: "Structured logs with stage + latency", content: "Every stage logs stage id, run id, latency, output shape.", tags: ["observability", "logs"], confidence: 0.85 },
    { title: "Editable routing decisions", content: "User should be able to override a routing decision before dispatch.", tags: ["ui", "routing", "control"], confidence: 0.75 },
  ],
  routing_rules: [
    { title: "Judgment to val_clone_internal", content: "Wedge, scope cuts, architecture trade-offs → val_clone_internal.", tags: ["routing", "judgment"], route_to: "val_clone_internal", confidence: 0.95 },
    { title: "External discovery to Manus", content: "Competitor catalogs, public docs, web research → Manus.", tags: ["routing", "research"], route_to: "manus", confidence: 0.92 },
    { title: "Code edits to code_builder", content: "Multi-file real codebase changes → code_builder.", tags: ["routing", "execution", "code"], route_to: "code_builder", confidence: 0.88 },
    { title: "Operational tasks to OpenClaw", content: "Approved task runners, non-code execution → OpenClaw.", tags: ["routing", "execution", "ops"], route_to: "openclaw", confidence: 0.9 },
    { title: "Quality gates to Critic", content: "Bundle review, rejection, revision → Critic.", tags: ["routing", "quality"], route_to: "critic", confidence: 0.94 },
    { title: "Durable writes to Memory Manager", content: "Should_write with confidence ≥ 0.75 → Memory Manager.", tags: ["routing", "memory"], route_to: "memory_manager", confidence: 0.9 },
  ],
  approved_patterns: [
    { title: "Judgment-first planning loop", content: "Intake → Intent → Reframe → Scope → Architecture → Research/Execution → Router → Critic → Output.", tags: ["core_loop", "planning", "governance"], confidence: 0.92 },
    { title: "Revision-on-revise policy", content: "When critic returns revise, re-run scope/arch/research/exec/router with fixes injected; cap 2 per run.", tags: ["quality", "revision"], confidence: 0.85 },
    { title: "Tag-scored memory retrieval", content: "score = tag_overlap * type_weight + priority + recency. Cap per category.", tags: ["memory", "retrieval"], confidence: 0.88 },
  ],
  failure_lessons: [
    { title: "Routed judgment to Manus", content: "A wedge question sent to Manus returned shallow web summaries instead of a sharp decision.", tags: ["routing", "judgment", "regression"], severity: 2 },
    { title: "Critic bypassed after timeout", content: "Critic timed out; pipeline assembled output anyway and shipped a shallow bundle.", tags: ["quality", "governance", "timeout"], severity: 1 },
    { title: "Memory contaminated with per-run stack choices", content: "Wrote 'use Supabase' as a preference after a single project chose it.", tags: ["memory", "writeback", "governance"], severity: 3 },
    { title: "Over-scoped MVP must-have", content: "Listed 12 must-have items for a single-week MVP. Everything slipped.", tags: ["scope", "mvp"], severity: 2 },
    { title: "JSON parse failure silently swallowed", content: "Stage returned prose with fences; next stage got empty object and continued.", tags: ["schema", "robustness"], severity: 1 },
  ],
  project_state: [
    { title: "Val OS MVP active", content: "Live prototype + backend scaffold. Brain + Critic + typed memory + revision loop + worker stubs.", tags: ["val_os", "state", "mvp"] },
  ],
};

export const TYPE_WEIGHT = {
  founder_principles: 1.10,
  routing_rules: 1.00,
  approved_patterns: 0.95,
  product_preferences: 0.90,
  failure_lessons: 1.05,
  project_state: 0.85,
};

export const CAPS = {
  founder_principles: 5,
  routing_rules: 6,
  approved_patterns: 3,
  product_preferences: 5,
  failure_lessons: 4,
  project_state: 1,
};
