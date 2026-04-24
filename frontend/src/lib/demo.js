/* Demo judgment engine — mirrors server brain.py logic 1:1 */
import { tokenize, pretty } from "./utils.js";

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms + Math.random() * 250));

function titleOf(raw) {
  const m = raw.match(
    /\b(?:build|make|create|design|develop|ship|launch)\s+(?:me\s+)?(?:a|an|the)?\s*([^.!?\n]+?)(?:\s+(?:that|which|for|to|so|from)\b|[.!?\n]|$)/i
  );
  return (m ? m[1] : raw.slice(0, 80)).trim().replace(/\s+/g, " ");
}

function categorize(raw, ctx) {
  const t = new Set(tokenize(raw + " " + (ctx || "")));
  const has = (...ks) => ks.some((k) => t.has(k));
  if (has("founder", "os", "operating", "orchestrator", "judgment", "specs", "spec", "planning", "wedge"))
    return "founder_os";
  if (has("dashboard", "analytics", "metric", "metrics", "kpi", "report", "reports", "chart", "visualize"))
    return "dashboard";
  if (has("sales", "crm", "deal", "pipeline", "outreach", "lead", "prospect"))
    return "sales";
  if (has("support", "ticket", "helpdesk", "customer"))
    return "support";
  if (has("workflow", "automation", "automate", "agent", "agents"))
    return "automation";
  return "generic";
}

const FOUNDER_OS = {
  core_goal:
    "turn raw founder prompts into production-grade specs, architecture, routing, and execution plans through a judgment-first pipeline",
  user_type: "startup founders and 0→1 builders",
  domain: "founder tooling / AI orchestration",
  build_category: "platform / operating system",
  ambiguities: [
    "execution autonomy level for v1",
    "which worker surfaces are wired",
    "memory persistence target",
    "whether critic can hard-block execution",
  ],
  assumptions: [
    "single-user v1",
    "typed JSON at every module boundary",
    "memory as typed tables not vector blob",
  ],
  problem_statement:
    "founders lose weeks translating vague prompts into production-grade plans; existing tools either act as personality chatbots or execute too early without wedge/scope discipline",
  wedge:
    "prompt → structured founder-grade plan, with a critic gate before any execution",
  success_definition:
    "user enters a vague build prompt and receives typed intent, reframed problem, scoped MVP, architecture, routing plan, execution queue, critic verdict, and output bundle in a single run",
  non_goals: [
    "full autonomous build loop",
    "multi-user collaboration",
    "production deployment engine in v1",
    "IDE execution in v1",
  ],
  must_have: [
    "prompt-to-spec pipeline",
    "problem reframing",
    "MVP scoping",
    "architecture generation",
    "research + execution task generation",
    "router with confidence + fallback",
    "critic quality gate",
    "typed memory retrieval",
    "output bundle",
  ],
  should_have: [
    "memory writeback recommendations",
    "editable routing decisions",
    "revision loop after critic revise",
  ],
  defer: [
    "autonomous iteration loop",
    "multi-project graph memory",
    "real worker execution feedback",
    "multi-user collaboration",
  ],
  mock_ok: [
    "Manus connector",
    "OpenClaw connector",
    "actual execution results",
    "deployment logs",
  ],
  must_be_real: [
    "planning pipeline outputs",
    "routing decisions",
    "memory retrieval",
    "critic evaluation",
    "typed output bundle",
  ],
  modules: [
    "Prompt Intake",
    "Intent Interpreter",
    "Problem Reframer",
    "Scope Engine",
    "Architecture Engine",
    "Research Planner",
    "Execution Planner",
    "Router",
    "Critic",
    "Output Generator",
    "Memory Manager",
  ],
  module_resp: {
    "Prompt Intake": "normalize raw prompt, assign request id, detect request type",
    "Intent Interpreter":
      "convert raw prompt into structured intent with ambiguities + assumptions",
    "Problem Reframer": "sharpen into problem / wedge / success / non-goals",
    "Scope Engine":
      "produce must-have, should-have, defer, mock_ok, must_be_real",
    "Architecture Engine":
      "modules, data flow, dependencies, failure points, memory vs runtime split",
    "Research Planner":
      "emit specific, deliverable-keyed Manus research tasks",
    "Execution Planner":
      "emit typed execution queue with owner_type, deps, acceptance criteria",
    Router:
      "route each work item with reason, confidence, fallback",
    Critic:
      "return approve | revise | reject + failures + fixes + strongest_part",
    "Output Generator":
      "assemble founder-grade PRD + system spec + QA + deployment checklists",
    "Memory Manager":
      "tag-scored retrieval; durable writeback recommendations only",
  },
  data_flow: [
    "raw_prompt → intake",
    "intake + memory → intent",
    "intent → reframed problem",
    "reframed problem → scope",
    "scope + reframed → architecture",
    "architecture + scope → research plan",
    "architecture + scope → execution plan",
    "all prior → router",
    "bundle → critic",
    "critic approve → output generator",
    "output → memory writeback recommendations",
  ],
  dependencies: [
    "LLM provider",
    "Postgres (typed memory)",
    "optional: Manus API",
    "optional: OpenClaw shell",
  ],
  failure_points: [
    "prompt ambiguity",
    "over-scoped MVP",
    "bad routing decision",
    "low-quality worker output",
    "memory contamination",
    "critic gate bypassed",
    "JSON extraction failure",
  ],
  memory_vs_runtime: {
    memory: [
      "founder_principles",
      "routing_rules",
      "approved_patterns",
      "product_preferences",
      "failure_lessons",
      "project_state",
    ],
    runtime: [
      "current request_id",
      "stage outputs in-flight",
      "critic verdict for this run",
      "per-run retrieved context block",
    ],
  },
  research_seeds: [
    [
      "catalogue 10 production-grade AI build-planning tools",
      "know credible competitors so wedge is defensible",
      "web/product",
      "comparison table with core flow, strengths, weaknesses",
    ],
    [
      "collect module patterns used by prompt-to-spec systems",
      "validate module boundary choices",
      "docs/architecture",
      "typed module-pattern summary",
    ],
    [
      "identify how competing tools separate judgment from execution",
      "verify four-way role split",
      "product analysis",
      "routing taxonomy",
    ],
    [
      "survey typed-memory approaches in long-running agent systems",
      "pick memory shape before writing schema",
      "docs/papers",
      "trade-off matrix with recommendation",
    ],
    [
      "find examples of critic patterns in agent pipelines",
      "design a critic that rejects shallow output",
      "repos/docs",
      "critic-pattern catalog",
    ],
  ],
  execution_seeds: [
    [
      "Scaffold Next.js app shell with 11-stage pipeline UI",
      "frontend",
      [],
      ["app boots", "theme configured", "pipeline renders"],
      false,
    ],
    [
      "Build FastAPI orchestrator with POST /plan endpoint",
      "backend",
      ["e1"],
      ["accepts raw prompt", "returns typed bundle", "logs latency"],
      false,
    ],
    [
      "Implement Postgres schemas for 6 typed memory tables",
      "data",
      [],
      ["tables created", "seeds loaded", "retrieval indexed"],
      false,
    ],
    [
      "Wire intent/reframe/scope/architecture modules with strict JSON extraction",
      "backend",
      ["e2"],
      ["shape-correct JSON", "retry on malformed", "per-module timeout"],
      false,
    ],
    [
      "Implement router service with confidence + fallback",
      "backend",
      ["e4"],
      ["routes emit confidence", "<0.75 fallback to val_clone_internal"],
      false,
    ],
    [
      "Implement critic service evaluating full bundle",
      "backend",
      ["e4"],
      ["returns approve/revise/reject", "surfaces failures + fixes"],
      false,
    ],
    [
      "Stub Manus + OpenClaw connector services",
      "backend",
      ["e5"],
      ["shape-correct fake responses", "observable logs"],
      true,
    ],
    [
      "Add memory retrieval + writeback recommendation endpoints",
      "backend",
      ["e3"],
      ["tag-scored retrieval with caps", "writeback recommends not commits"],
      false,
    ],
  ],
  qa: [
    "every stage returns typed JSON matching schema",
    "critic rejects deliberately shallow prompt",
    "memory retrieval surfaces right rows",
    "routing emits confidence + fallback",
    "malformed LLM output triggers retry",
    "pipeline under 30s on standard prompt",
  ],
  deploy: [
    "env config for LLM key + model",
    "Postgres migrations applied",
    "seed memory loaded",
    "rate-limit + timeout policies",
    "structured logs for stage latency",
    "error reporting wired",
    "feature flag for demo vs real mode",
  ],
  critic_strong:
    "typed JSON at every module boundary with a real critic gate — judgment-first discipline is the moat",
};

function generic(raw, ctx) {
  const t = titleOf(raw).toLowerCase();
  return {
    core_goal: `ship a working v1 of ${t} that proves a single user loop`,
    user_type: "internal operators / early users",
    domain: "general tooling",
    build_category: "internal tool",
    ambiguities: [
      "primary user not specified",
      "data source not named",
      "success metric unclear",
    ],
    assumptions: ["single-user v1", "mocked external data ok", "dark web UI"],
    problem_statement: `user articulates a need around ${t} but the wedge, scope, and success metric aren't sharp`,
    wedge: `one clearly useful slice of ${t} that a single user runs end-to-end`,
    success_definition:
      "a realistic user reaches the main action in under 60s on a seeded demo",
    non_goals: [
      "full platform generalization",
      "multi-tenant admin in v1",
      "enterprise SSO in v1",
    ],
    must_have: [
      `core user flow for ${t}`,
      "seeded data source",
      "primary action",
      "result view",
    ],
    should_have: ["saved state", "shareable URL", "light analytics"],
    defer: ["admin console", "billing", "multi-tenant"],
    mock_ok: ["external integrations", "downstream write-backs"],
    must_be_real: ["core user action", "persistent state of a single run"],
    modules: [
      "Frontend App",
      "Frontend State",
      "API Service",
      "Data Store",
      "Integration Stubs",
      "Observability",
    ],
    module_resp: {
      "Frontend App": "renders user flow and primary action",
      "Frontend State": "holds run state and optimistic updates",
      "API Service": "exposes typed endpoints for core action",
      "Data Store": "persists a single run; seeded with mock data",
      "Integration Stubs": "fake third-party calls with observable I/O",
      Observability: "structured logs and latency per request",
    },
    data_flow: [
      "user action → frontend",
      "frontend → api",
      "api → data store",
      "api → integration stub",
      "response → frontend",
    ],
    dependencies: ["web host", "Postgres", "LLM provider (optional)"],
    failure_points: [
      "vague success metric",
      "primary action not findable",
      "integration stub diverges",
      "state not persisted",
    ],
    memory_vs_runtime: {
      memory: ["product_preferences", "approved_patterns"],
      runtime: ["current request id", "seeded dataset"],
    },
    research_seeds: [
      [
        `catalogue 3-5 tools that solve ${t}`,
        "anchor wedge against credible alternatives",
        "web/product",
        "comparison table",
      ],
      [
        `identify one task users do most inside ${t}`,
        "shape primary action",
        "user interviews",
        "ranked task list",
      ],
      [
        `collect top 2 data sources for ${t}`,
        "decide mock vs real",
        "docs",
        "source table",
      ],
    ],
    execution_seeds: [
      [
        "Scaffold app shell with primary action on home screen",
        "frontend",
        [],
        ["app boots", "primary action visible"],
        false,
      ],
      [
        "Implement API endpoint for primary action",
        "backend",
        ["e1"],
        ["returns typed response", "logs latency"],
        false,
      ],
      [
        "Seed data store with realistic rows",
        "data",
        [],
        ["10+ seeded rows", "indexed on primary key"],
        false,
      ],
      [
        "Wire frontend to API and persist a run",
        "frontend",
        ["e1", "e2"],
        ["submit → response", "state persists"],
        false,
      ],
      [
        "Instrument structured logs",
        "observability",
        ["e2"],
        ["logs carry request id"],
        false,
      ],
      [
        "Stub one external integration",
        "backend",
        ["e2"],
        ["shape-correct fake", "observable log"],
        true,
      ],
    ],
    qa: [
      "primary action under 3s on seed",
      "malformed input rejected with typed error",
      "frontend handles empty-state",
      "logs include request id",
      "no unhandled exception on happy path",
    ],
    deploy: [
      "env config loaded",
      "database seeded",
      "health check passes",
      "structured logs exported",
      "feature flag for demo vs real",
    ],
    critic_strong: "one clearly scoped user loop with typed JSON between frontend and backend",
  };
}

function profile(raw, ctx) {
  const cat = categorize(raw, ctx);
  const p = cat === "founder_os" ? { ...FOUNDER_OS } : generic(raw, ctx);
  p.__category = cat;
  return p;
}

export const DEMO = {
  profile,
  categorize,

  async intent(raw, ctx) {
    await delay();
    const p = profile(raw, ctx);
    return {
      core_goal: p.core_goal,
      user_type: p.user_type,
      domain: p.domain,
      build_category: p.build_category,
      ambiguities: p.ambiguities,
      assumptions: p.assumptions,
    };
  },

  async reframe(raw, ctx) {
    await delay();
    const p = profile(raw, ctx);
    return {
      problem_statement: p.problem_statement,
      wedge: p.wedge,
      success_definition: p.success_definition,
      non_goals: p.non_goals,
    };
  },

  async scope(raw, ctx) {
    await delay();
    const p = profile(raw, ctx);
    return {
      must_have: p.must_have,
      should_have: p.should_have,
      defer: p.defer,
      mock_ok: p.mock_ok,
      must_be_real: p.must_be_real,
    };
  },

  async architect(raw, ctx) {
    await delay();
    const p = profile(raw, ctx);
    return {
      system_modules: p.modules,
      module_responsibilities: p.module_resp,
      data_flow: p.data_flow,
      dependencies: p.dependencies,
      failure_points: p.failure_points,
      memory_vs_runtime: p.memory_vs_runtime,
    };
  },

  async research(raw, ctx) {
    await delay();
    const p = profile(raw, ctx);
    return {
      research_tasks: p.research_seeds.map((r, i) => ({
        task_id: `r${i + 1}`,
        objective: r[0],
        why_it_matters: r[1],
        source_type: r[2],
        deliverable: r[3],
      })),
    };
  },

  async execution(raw, ctx) {
    await delay();
    const p = profile(raw, ctx);
    return {
      execution_tasks: p.execution_seeds.map((r, i) => ({
        task_id: `e${i + 1}`,
        title: r[0],
        owner_type: r[1],
        depends_on: r[2] || [],
        acceptance_criteria: r[3] || [],
        mockable: !!r[4],
      })),
    };
  },

  async router(scope, arch, research, execution) {
    await delay();
    const routes = [];
    for (const r of research.research_tasks || []) {
      routes.push({
        work_item: r.objective,
        route_to: "manus",
        reason: "external discovery task",
        confidence: 0.93,
        fallback: null,
      });
    }
    for (const e of execution.execution_tasks || []) {
      const codey =
        /scaffold|implement|wire|build|endpoint|schema|integration/i.test(
          e.title
        );
      const routeTo = codey ? "code_builder" : "openclaw";
      const conf = codey ? 0.9 : 0.92;
      routes.push({
        work_item: e.title,
        route_to: routeTo,
        reason: codey ? "multi-file code change" : "operational execution",
        confidence: conf,
        fallback: conf < 0.75 ? "val_clone_internal" : null,
      });
    }
    routes.push({
      work_item: "define MVP wedge",
      route_to: "val_clone_internal",
      reason: "judgment-heavy decision",
      confidence: 0.97,
      fallback: null,
    });
    routes.push({
      work_item: "stress-test architecture",
      route_to: "critic",
      reason: "quality gate",
      confidence: 0.94,
      fallback: null,
    });
    routes.push({
      work_item: "write durable lesson to memory",
      route_to: "memory_manager",
      reason: "durable continuity",
      confidence: 0.9,
      fallback: null,
    });
    return { routes };
  },

  async critic(raw, ctx, bundle) {
    await delay(280);
    const p = profile(raw, ctx);
    const b = bundle || {};
    let score = 0.55;
    if ((b.architecture?.system_modules || []).length >= 6) score += 0.08;
    const mh = (b.scope?.must_have || []).length;
    if (mh >= 3 && mh <= 7) score += 0.1;
    if ((b.architecture?.failure_points || []).length >= 4) score += 0.05;
    if ((b.execution?.execution_tasks || []).length >= 5) score += 0.06;
    if ((b.research?.research_tasks || []).length >= 3) score += 0.04;
    if ((b.reframe?.non_goals || []).length >= 2) score += 0.03;
    if ((b.router?.routes || []).some((r) => r.route_to === "code_builder"))
      score += 0.02;

    // Prompt-level penalties
    const signal = tokenize(raw);
    if (signal.length < 4) score -= 0.2;
    else if (signal.length < 7) score -= 0.1;
    if (p.__category === "generic") score -= 0.15;
    score = Math.max(0, Math.min(0.96, score));

    const failures = [];
    const fixes = [];
    if (mh > 7) {
      failures.push("must-have is too broad for an MVP");
      fixes.push("cut must-have to 4-6 items");
    }
    if (!(b.architecture?.failure_points || []).length) {
      failures.push("no explicit failure states");
      fixes.push("list failure points + detection");
    }
    if (p.__category === "generic") {
      failures.push("domain not clearly identified from prompt");
      fixes.push("add 1-2 context lines to tighten intent");
    }
    if (signal.length < 4) {
      failures.push("prompt is too short to plan against");
      fixes.push("describe product + user + success");
    }
    if (!failures.length) {
      failures.push("memory writeback criteria could be tightened");
      fixes.push("add confidence threshold before writing memory");
    }

    const status =
      score >= 0.82 ? "approve" : score >= 0.6 ? "revise" : "reject";
    return {
      status,
      score: +score.toFixed(2),
      failures,
      fixes,
      strongest_part: p.critic_strong,
    };
  },

  async output(raw, ctx, intent, reframe, scope, arch) {
    await delay(320);
    const p = profile(raw, ctx);
    return {
      prd: {
        product_definition: `MVP that solves: ${reframe.problem_statement}`,
        target_user: intent.user_type,
        wedge: reframe.wedge,
        success_criteria: [
          reframe.success_definition,
          ...(scope.must_have || []).slice(0, 3),
        ],
        non_goals: reframe.non_goals,
        mvp_feature_set: scope.must_have,
        mocked_vs_real: {
          mocked: scope.mock_ok,
          real: scope.must_be_real,
        },
      },
      system_spec: {
        modules: arch.system_modules,
        data_flow: arch.data_flow,
        dependencies: arch.dependencies,
        failure_states: arch.failure_points,
      },
      qa_checklist: p.qa,
      deployment_checklist: p.deploy,
    };
  },

  async memwb(critic) {
    await delay(200);
    const recs = [];
    if (critic.status === "approve") {
      recs.push({
        should_write: true,
        memory_type: "approved_patterns",
        title: "Judgment-first planning loop with typed module boundaries",
        content:
          "Intent → Reframe → Scope → Arch → Research/Exec → Router → Critic → Output. Typed JSON at boundaries.",
        tags: ["core_loop", "planning", "governance"],
        confidence: 0.9,
        justification: "Loop held end-to-end; aligns with founder principles.",
      });
    }
    if (critic.failures?.length) {
      recs.push({
        should_write: true,
        memory_type: "failure_lessons",
        title: critic.failures[0],
        content: `Observed: ${critic.failures[0]}. Fix: ${
          critic.fixes?.[0] || "review scope + failure states."
        }`,
        tags: ["critic", "quality"],
        confidence: 0.75,
        justification: "Critic surfaced a real weakness worth remembering.",
      });
    }
    recs.push({
      should_write: false,
      memory_type: "product_preferences",
      title: "Defer: personalize stack per run",
      content:
        "Do not store per-run stack choices unless repeated across 3+ projects.",
      tags: ["governance", "memory"],
      confidence: 0.6,
      justification: "Transient details pollute memory.",
    });
    return { recommendations: recs };
  },
};
