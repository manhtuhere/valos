import { useCallback, useRef } from "react";
import { STAGES } from "../data/stages.js";
import { DEMO } from "../lib/demo.js";
import { retrieveMemory } from "../lib/memRetrieval.js";
import { callBackendPlan } from "../lib/backendApi.js";
import { uid, nowIso, pretty } from "../lib/utils.js";

const MAX_REVISIONS = 2;

/**
 * usePipeline — orchestrates the 11-stage Val OS pipeline.
 *
 * Params (all from App state):
 *   setStageStates, setBundle, setRevisions, setRetrievedIds,
 *   setMetrics, demoMode, backendMode, autoRevise, apiKey, model, backendUrl
 *
 * Exposes: runPipeline(raw, ctx), reviseAndRerun(raw, ctx, stageStatesRef), resetRun()
 */
export function usePipeline({
  setStageStates,
  setBundle,
  setRevisions,
  setRetrievedIds,
  setMetrics,
  demoMode,
  backendMode,
  autoRevise,
  apiKey,
  model,
  backendUrl,
}) {
  // Keep a live ref to revisions count for the loop
  const revisionsRef = useRef(0);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function initStageStates() {
    const s = {};
    for (const st of STAGES) s[st.id] = { state: "pending", output: null, ms: 0, error: null };
    return s;
  }

  function stageUpdate(id, state, extra = {}) {
    setStageStates((prev) => ({
      ...prev,
      [id]: { state, output: extra.output ?? null, ms: extra.ms ?? 0, error: extra.error ?? null },
    }));
  }

  async function runStage(id, demoFn, apiFn) {
    stageUpdate(id, "running");
    const t0 = Date.now();
    try {
      const out = demoMode ? await demoFn() : await apiFn();
      stageUpdate(id, "done", { ms: Date.now() - t0, output: out });
      return out;
    } catch (e) {
      stageUpdate(id, "error", { ms: Date.now() - t0, error: String(e.message || e) });
      throw e;
    }
  }

  async function callClaude({ system, user }) {
    const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
    const MAX_TOKENS = 2000;
    if (!apiKey) throw new Error("API key required for real API mode");
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = (data.content || []).map((c) => c.text || "").join("\n");
    const m = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/) || [null, text];
    return JSON.parse(m[1].trim());
  }

  // -----------------------------------------------------------------------
  // Local (demo / real-api) pipeline
  // -----------------------------------------------------------------------

  async function runLocalPipeline(raw, ctx) {
    // 01 Intake
    stageUpdate("intake", "running");
    const intake = { request_id: uid(), type: "founder_build_prompt", timestamp: nowIso() };
    stageUpdate("intake", "done", { ms: 3, output: intake });

    // 02 Memory
    stageUpdate("memory", "running");
    const mem = retrieveMemory(raw, ctx);
    const ids = new Set(mem.rows.map((r) => r.id));
    setRetrievedIds(ids);
    stageUpdate("memory", "done", { ms: 5, output: mem });

    // 03-08 Brain stages
    const intent = await runStage(
      "intent",
      () => DEMO.intent(raw, ctx),
      () => callClaude({ system: "You are the Intent Interpreter. Return only JSON.", user: `Raw: ${raw}\nContext: ${ctx}` })
    );
    const reframe = await runStage(
      "reframe",
      () => DEMO.reframe(raw, ctx),
      () => callClaude({ system: "You are the Problem Reframer. Return only JSON.", user: `Intent: ${pretty(intent)}` })
    );
    const scope = await runStage(
      "scope",
      () => DEMO.scope(raw, ctx),
      () => callClaude({ system: "You are the Scope Engine. Return only JSON.", user: `Intent: ${pretty(intent)}\nReframe: ${pretty(reframe)}` })
    );
    const arch = await runStage(
      "architect",
      () => DEMO.architect(raw, ctx),
      () => callClaude({ system: "You are the Architecture Engine. Return only JSON.", user: `Scope: ${pretty(scope)}` })
    );
    const research = await runStage(
      "research",
      () => DEMO.research(raw, ctx),
      () => callClaude({ system: "You are the Research Planner. Return only JSON.", user: `Arch: ${pretty(arch)}` })
    );
    const execution = await runStage(
      "execution",
      () => DEMO.execution(raw, ctx),
      () => callClaude({ system: "You are the Execution Planner. Return only JSON.", user: `Arch: ${pretty(arch)}\nScope: ${pretty(scope)}` })
    );

    // 09 Router
    const routing = await runStage(
      "router",
      () => DEMO.router(scope, arch, research, execution),
      () => callClaude({ system: "You are the Router.", user: `Tasks: research + execution + meta` })
    );

    // 10 Critic (with optional revision loop)
    let critic = await runStage(
      "critic",
      () => DEMO.critic(raw, ctx, { architecture: arch, scope, research, execution, reframe, router: routing }),
      () => callClaude({ system: "You are the Critic.", user: `Bundle: ${pretty({ arch, scope, research, execution, reframe, routing })}` })
    );

    let revisedArch = arch;
    let revisedScope = scope;
    let revisedResearch = research;
    let revisedExecution = execution;
    let revisedRouting = routing;
    let revisedCtx = ctx;

    while (autoRevise && critic.status === "revise" && revisionsRef.current < MAX_REVISIONS) {
      revisionsRef.current += 1;
      setRevisions(revisionsRef.current);

      revisedCtx =
        (revisedCtx ? revisedCtx + "\n" : "") +
        "Critic failures: " + (critic.failures || []).join("; ") +
        "\nApply fixes: " + (critic.fixes || []).join("; ");

      revisedScope = await DEMO.scope(raw, revisedCtx);
      revisedArch = await DEMO.architect(raw, revisedCtx);
      revisedResearch = await DEMO.research(raw, revisedCtx);
      revisedExecution = await DEMO.execution(raw, revisedCtx);
      revisedRouting = await DEMO.router(revisedScope, revisedArch, revisedResearch, revisedExecution);
      critic = await DEMO.critic(raw, revisedCtx, {
        architecture: revisedArch,
        scope: revisedScope,
        research: revisedResearch,
        execution: revisedExecution,
        reframe,
        router: revisedRouting,
      });

      stageUpdate("scope",     "done", { ms: 0, output: revisedScope });
      stageUpdate("architect", "done", { ms: 0, output: revisedArch });
      stageUpdate("research",  "done", { ms: 0, output: revisedResearch });
      stageUpdate("execution", "done", { ms: 0, output: revisedExecution });
      stageUpdate("router",    "done", { ms: 0, output: revisedRouting });
      stageUpdate("critic",    "done", { ms: 0, output: critic });
    }

    // 11 Output + memwb
    stageUpdate("output", "running");
    const output = await DEMO.output(raw, revisedCtx, intent, reframe, revisedScope, revisedArch);
    const memwb = await DEMO.memwb(critic);
    stageUpdate("output", "done", { ms: 8, output: { output, memory_writeback: memwb } });

    const bundle = { output, routing: revisedRouting, memory_writeback: memwb, worker_feedback: [] };
    setBundle(bundle);
    return { bundle, critic };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  const runPipeline = useCallback(
    async (raw, ctx) => {
      if (!raw) throw new Error("Enter a prompt first");

      const runId = uid();
      const startedAt = new Date();
      revisionsRef.current = 0;

      setStageStates(initStageStates());
      setBundle({});
      setRevisions(0);
      setRetrievedIds(new Set());
      setMetrics((m) => ({
        ...m,
        runId,
        startedAt: startedAt.toLocaleTimeString(),
        stagesDone: "0 / 11",
        latency: "—",
        criticVerdict: "—",
      }));

      const t0 = Date.now();
      try {
        if (backendMode) {
          stageUpdate("intake", "running");
          const data = await callBackendPlan(raw, ctx, autoRevise, backendUrl);
          const map = {
            intake: data.intake,
            memory: data.memory,
            intent: data.intent,
            reframe: data.reframe,
            scope: data.scope,
            architect: data.architecture,
            research: data.research,
            execution: data.execution,
            router: data.routing,
            critic: data.critic,
            output: { output: data.output, memory_writeback: data.memory_writeback, worker_feedback: data.worker_feedback },
          };
          const perStageMs = Math.round((data.latency_ms || 0) / 11);
          const newStates = {};
          for (const id of Object.keys(map)) {
            newStates[id] = { state: "done", output: map[id], ms: perStageMs, error: null };
          }
          setStageStates(newStates);

          const bundle = {
            output: data.output,
            routing: data.routing,
            memory_writeback: data.memory_writeback,
            worker_feedback: data.worker_feedback,
          };
          setBundle(bundle);
          revisionsRef.current = data.revisions || 0;
          setRevisions(revisionsRef.current);
          setRetrievedIds(new Set((data.memory?.rows || []).map((r) => r.id)));
          setMetrics((m) => ({
            ...m,
            criticVerdict: data.critic ? `${data.critic.status} · ${data.critic.score}` : "—",
          }));
        } else {
          const { critic } = await runLocalPipeline(raw, ctx);
          setMetrics((m) => ({
            ...m,
            criticVerdict: `${critic.status} · ${critic.score}`,
          }));
        }
      } finally {
        const elapsed = Date.now() - t0;
        setMetrics((m) => ({ ...m, latency: elapsed + "ms" }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demoMode, backendMode, autoRevise, apiKey, model, backendUrl]
  );

  const reviseAndRerun = useCallback(
    async (raw, ctx, stageStatesSnapshot) => {
      const lastCritic = stageStatesSnapshot?.critic?.output;
      if (!lastCritic) return;

      revisionsRef.current += 1;
      setRevisions(revisionsRef.current);

      const revisedCtx =
        (ctx ? ctx + "\n" : "") +
        "Critic failures: " + (lastCritic.failures || []).join("; ") +
        "\nApply fixes: " + (lastCritic.fixes || []).join("; ");

      const intent = stageStatesSnapshot?.intent?.output;
      const reframe = stageStatesSnapshot?.reframe?.output;

      const scope = await DEMO.scope(raw, revisedCtx);
      const arch = await DEMO.architect(raw, revisedCtx);
      const research = await DEMO.research(raw, revisedCtx);
      const execution = await DEMO.execution(raw, revisedCtx);
      const routing = await DEMO.router(scope, arch, research, execution);
      const critic = await DEMO.critic(raw, revisedCtx, { architecture: arch, scope, research, execution, reframe, router: routing });
      const output = await DEMO.output(raw, revisedCtx, intent, reframe, scope, arch);
      const memwb = await DEMO.memwb(critic);

      setStageStates((prev) => ({
        ...prev,
        scope:     { ...prev.scope,     state: "done", output: scope,     ms: 0, error: null },
        architect: { ...prev.architect, state: "done", output: arch,      ms: 0, error: null },
        research:  { ...prev.research,  state: "done", output: research,  ms: 0, error: null },
        execution: { ...prev.execution, state: "done", output: execution, ms: 0, error: null },
        router:    { ...prev.router,    state: "done", output: routing,   ms: 0, error: null },
        critic:    { ...prev.critic,    state: "done", output: critic,    ms: 0, error: null },
        output:    { ...prev.output,    state: "done", output: { output, memory_writeback: memwb }, ms: 0, error: null },
      }));

      const bundle = { output, routing, memory_writeback: memwb, worker_feedback: [] };
      setBundle(bundle);
      setMetrics((m) => ({
        ...m,
        criticVerdict: `${critic.status} · ${critic.score}`,
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const resetRun = useCallback(() => {
    revisionsRef.current = 0;
    setStageStates(initStageStates());
    setBundle({});
    setRevisions(0);
    setRetrievedIds(new Set());
    setMetrics({
      runId: "—",
      latency: "—",
      stagesDone: "0 / 11",
      mode: "demo · local",
      revisions: "0 / 2",
      criticVerdict: "—",
      startedAt: "—",
    });
  }, [setStageStates, setBundle, setRevisions, setRetrievedIds, setMetrics]);

  return { runPipeline, reviseAndRerun, resetRun };
}
