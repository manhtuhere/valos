-- Val OS typed memory schema
-- Six typed tables, matching PRD §3. No free-form vector blob; typed tables are the memory.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enum for memory types keeps writes honest at the DB boundary.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_type') THEN
    CREATE TYPE memory_type AS ENUM (
      'founder_principles',
      'product_preferences',
      'routing_rules',
      'approved_patterns',
      'failure_lessons',
      'project_state'
    );
  END IF;
END$$;

-- Founder principles: durable, high-signal, never auto-written.
CREATE TABLE IF NOT EXISTS founder_principles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  content      text NOT NULL,
  tags         text[] NOT NULL DEFAULT '{}',
  priority     smallint NOT NULL DEFAULT 3,     -- 1 highest, 5 lowest
  source       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_founder_principles_tags   ON founder_principles USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_founder_principles_prio   ON founder_principles (priority);

-- Product preferences: learned defaults (stack, tone, UI patterns).
CREATE TABLE IF NOT EXISTS product_preferences (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  content      text NOT NULL,
  tags         text[] NOT NULL DEFAULT '{}',
  confidence   real NOT NULL DEFAULT 0.7,
  source       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_preferences_tags  ON product_preferences USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_product_preferences_conf  ON product_preferences (confidence);

-- Routing rules: which worker owns which kind of task, with confidence + fallback.
CREATE TABLE IF NOT EXISTS routing_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  content      text NOT NULL,
  tags         text[] NOT NULL DEFAULT '{}',
  route_to     text NOT NULL,                   -- val_clone_internal | manus | openclaw | code_builder | critic | memory_manager
  confidence   real NOT NULL DEFAULT 0.9,
  fallback     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_routing_rules_tags        ON routing_rules USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_routing_rules_route       ON routing_rules (route_to);

-- Approved patterns: canonical loops/solutions worth repeating.
CREATE TABLE IF NOT EXISTS approved_patterns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  content      text NOT NULL,
  tags         text[] NOT NULL DEFAULT '{}',
  confidence   real NOT NULL DEFAULT 0.85,
  source_run   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approved_patterns_tags    ON approved_patterns USING gin (tags);

-- Failure lessons: what went wrong + fix. Severity matters for retrieval.
CREATE TABLE IF NOT EXISTS failure_lessons (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  content      text NOT NULL,
  tags         text[] NOT NULL DEFAULT '{}',
  severity     smallint NOT NULL DEFAULT 3,     -- 1 catastrophic, 5 cosmetic
  fix          text,
  source_run   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_failure_lessons_tags      ON failure_lessons USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_failure_lessons_severity  ON failure_lessons (severity);

-- Project state: lightweight per-project facts. Not transient.
CREATE TABLE IF NOT EXISTS project_state (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project      text NOT NULL,
  title        text NOT NULL,
  content      text NOT NULL,
  tags         text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_state_project     ON project_state (project);
CREATE INDEX IF NOT EXISTS idx_project_state_tags        ON project_state USING gin (tags);

-- Run log: every /plan invocation gets a row, for audit + linking writebacks.
CREATE TABLE IF NOT EXISTS plan_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_prompt    text NOT NULL,
  context       text,
  bundle        jsonb NOT NULL,
  critic        jsonb NOT NULL,
  revisions     smallint NOT NULL DEFAULT 0,
  worker_feedback jsonb,
  latency_ms    integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_runs_created         ON plan_runs (created_at DESC);
