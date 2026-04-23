-- Val OS seed memory. Matches the 26 entries from the HTML prototype PRD §3.

-- Founder principles (6)
INSERT INTO founder_principles (title, content, tags, priority) VALUES
  ('Judgment first, execution second', 'Never let worker execution run ahead of wedge/scope/architecture judgment. Typed planning bundle must exist before routing.', ARRAY['governance','planning','core'], 1),
  ('Typed JSON at every module boundary', 'Every stage emits typed JSON that the next stage consumes. No free-form blobs between modules.', ARRAY['architecture','schema','core'], 1),
  ('Prefer narrow wedge over broad MVP', 'A demo that proves one cut of the value prop beats a half-working general tool.', ARRAY['scope','wedge','mvp'], 2),
  ('Mock what you can, keep real what you must', 'Cleanly separate mocked integrations from real ones; store the decision in scope.mocked_vs_real.', ARRAY['scope','mvp','integrations'], 2),
  ('Critic gate before assembling output', 'No final output bundle assembles until the critic has returned approve or explicit override.', ARRAY['quality','governance','critic'], 1),
  ('Memory is typed tables, not a vector dump', 'Memory is retrieved by tag + type + priority, not by nearest-neighbor embedding search.', ARRAY['memory','architecture','core'], 1);

-- Product preferences (5)
INSERT INTO product_preferences (title, content, tags, confidence) VALUES
  ('Dark UI with monospace for structured data', 'Use dark theme; render JSON, code, and stage outputs in monospace.', ARRAY['ui','design','dx'], 0.9),
  ('Visible system map over hidden orchestration', 'Always show the 11-stage pipeline visually; do not hide routing or critic from the user.', ARRAY['ui','transparency','dx'], 0.85),
  ('FastAPI + Postgres + Next.js default stack', 'Unless a prompt overrides, default backend is FastAPI + Postgres, frontend is Next.js (app router).', ARRAY['stack','default'], 0.8),
  ('Structured logs with stage + latency', 'Every stage logs stage id, run id, latency, and output shape; no ad-hoc prints.', ARRAY['observability','logs'], 0.85),
  ('Editable routing decisions', 'User should be able to override a routing decision before execution dispatches.', ARRAY['ui','routing','control'], 0.75);

-- Routing rules (6)
INSERT INTO routing_rules (title, content, tags, route_to, confidence, fallback) VALUES
  ('Judgment to val_clone_internal', 'Wedge, scope cuts, architecture trade-offs, strategic framing -> val_clone_internal.', ARRAY['routing','judgment'], 'val_clone_internal', 0.95, NULL),
  ('External discovery to Manus', 'Competitor catalogs, public docs, web research -> Manus.', ARRAY['routing','research'], 'manus', 0.92, 'val_clone_internal'),
  ('Code edits to code_builder', 'Multi-file real codebase changes, migrations, IaC -> code_builder.', ARRAY['routing','execution','code'], 'code_builder', 0.88, 'openclaw'),
  ('Operational tasks to OpenClaw', 'Ticket moves, CRM syncs, approved task runners, non-code execution -> OpenClaw.', ARRAY['routing','execution','ops'], 'openclaw', 0.9, 'val_clone_internal'),
  ('Quality gates to Critic', 'Bundle review, shallow-output rejection, revision decisions -> Critic.', ARRAY['routing','quality'], 'critic', 0.94, NULL),
  ('Durable writes to Memory Manager', 'Any should_write recommendation with confidence >= 0.75 gets routed to Memory Manager.', ARRAY['routing','memory'], 'memory_manager', 0.9, 'critic');

-- Approved patterns (3)
INSERT INTO approved_patterns (title, content, tags, confidence) VALUES
  ('Judgment-first planning loop', 'Intake -> Intent -> Reframe -> Scope -> Architecture -> Research/Execution -> Router -> Critic -> Output. Critic gates output.', ARRAY['core_loop','planning','governance'], 0.92),
  ('Revision-on-revise policy', 'When critic returns revise, re-run scope/architect/research/execution/router with fixes injected; cap revisions at 2 per run.', ARRAY['quality','revision'], 0.85),
  ('Tag-scored memory retrieval', 'Score candidates by (tag overlap * type_weight) + priority bonus + recency nudge; cap rows per category.', ARRAY['memory','retrieval'], 0.88);

-- Failure lessons (5)
INSERT INTO failure_lessons (title, content, tags, severity, fix) VALUES
  ('Routed judgment to Manus', 'A wedge question was sent to Manus and returned shallow web summaries instead of a sharp decision.', ARRAY['routing','judgment','regression'], 2, 'Strategic framing must route to val_clone_internal regardless of keyword overlap with research tasks.'),
  ('Critic bypassed after timeout', 'Critic call timed out; pipeline assembled output anyway and shipped a shallow bundle.', ARRAY['quality','governance','timeout'], 1, 'On critic timeout, mark bundle as needs_revision and surface as error, never auto-approve.'),
  ('Memory contaminated with per-run stack choices', 'Wrote "use Supabase" as a preference after a single project chose it.', ARRAY['memory','writeback','governance'], 3, 'Require pattern to appear in 3+ runs before writing to product_preferences.'),
  ('Over-scoped MVP must-have', 'Listed 12 must-have items for a single-week MVP. Everything slipped.', ARRAY['scope','mvp'], 2, 'Cap must-have at 4-6 items; move rest to should-have or defer.'),
  ('JSON parse failure silently swallowed', 'Stage returned prose with fences; next stage got empty object and continued.', ARRAY['schema','robustness'], 1, 'On parse failure: retry once with JSON-only reminder, then raise and halt pipeline.');

-- Project state (1)
INSERT INTO project_state (project, title, content, tags) VALUES
  ('val_os_mvp', 'Val OS MVP active', 'Live prototype + backend scaffold. Brain + Critic + typed memory. Revision loop in place. Workers are stubs.', ARRAY['val_os','state','mvp']);
