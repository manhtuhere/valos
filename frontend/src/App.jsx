import { useState, useRef, useEffect } from "react";
import "./App.css";

import { STAGES } from "./data/stages.js";
import { usePipeline } from "./hooks/usePipeline.js";

import Header from "./components/Header.jsx";
import IntakePanel from "./components/IntakePanel.jsx";
import PipelinePanel from "./components/PipelinePanel.jsx";
import OutputPanel from "./components/OutputPanel.jsx";
import StatusBar from "./components/StatusBar.jsx";

const MAX_REVISIONS = 2;
const SEED_PROMPT =
  "Build me a founder operating system that turns prompts into product specs and execution plans.";

function initStageStates() {
  const s = {};
  for (const st of STAGES)
    s[st.id] = { state: "pending", output: null, ms: 0, error: null };
  return s;
}

function initMetrics() {
  return {
    runId: "—",
    latency: "—",
    stagesDone: "0 / 11",
    mode: "demo · local",
    revisions: "0 / 2",
    criticVerdict: "—",
    startedAt: "—",
  };
}

export default function App() {
  // ── Prompt inputs ────────────────────────────────────────────────────────
  const [rawPrompt, setRawPrompt] = useState("");
  const [ctx, setCtx] = useState("");

  // ── Mode toggles ─────────────────────────────────────────────────────────
  const [demoMode, setDemoMode] = useState(true);
  const [backendMode, setBackendMode] = useState(false);
  const [autoRevise, setAutoRevise] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-5");
  const [backendUrl, setBackendUrl] = useState("http://localhost:8080");

  // ── Pipeline state ───────────────────────────────────────────────────────
  const [stageStates, setStageStates] = useState(initStageStates);
  const [bundle, setBundle] = useState({});
  const [revisions, setRevisions] = useState(0);
  const [retrievedIds, setRetrievedIds] = useState(new Set());
  const [running, setRunning] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("prd");
  const [activeMemTab, setActiveMemTab] = useState("all");
  const [metrics, setMetrics] = useState(initMetrics);

  // Keep a ref to stageStates for reviseAndRerun (needs snapshot at call time)
  const stageStatesRef = useRef(stageStates);
  useEffect(() => { stageStatesRef.current = stageStates; }, [stageStates]);

  // ── Derived: mode text ───────────────────────────────────────────────────
  const modeText = backendMode
    ? "backend · orchestrator"
    : demoMode
    ? "demo · local"
    : "claude api";

  // Sync mode text into metrics whenever toggles change
  useEffect(() => {
    setMetrics((m) => ({ ...m, mode: modeText }));
  }, [modeText]);

  // Sync stagesDone counter whenever stageStates changes
  useEffect(() => {
    const done = Object.values(stageStates).filter((s) => s.state === "done").length;
    setMetrics((m) => ({ ...m, stagesDone: `${done} / 11` }));
  }, [stageStates]);

  // Sync revisions counter
  useEffect(() => {
    setMetrics((m) => ({ ...m, revisions: `${revisions} / ${MAX_REVISIONS}` }));
  }, [revisions]);

  // ── Pipeline hook ─────────────────────────────────────────────────────────
  const { runPipeline, reviseAndRerun, resetRun } = usePipeline({
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
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleRun() {
    if (!rawPrompt.trim()) {
      alert("Enter a prompt first");
      return;
    }
    setRunning(true);
    try {
      await runPipeline(rawPrompt.trim(), ctx.trim());
    } catch (e) {
      console.error(e);
      alert("Pipeline failed: " + (e.message || e));
    } finally {
      setRunning(false);
    }
  }

  function handleSeed() {
    setRawPrompt(SEED_PROMPT);
    setCtx("");
  }

  function handleClearPrompt() {
    setRawPrompt("");
    setCtx("");
  }

  function handleReset() {
    resetRun();
    setRevisions(0);
    setRetrievedIds(new Set());
    setMetrics(initMetrics);
  }

  async function handleReviseAndRerun() {
    setRunning(true);
    try {
      await reviseAndRerun(rawPrompt.trim(), ctx.trim(), stageStatesRef.current);
    } catch (e) {
      console.error(e);
      alert("Revision failed: " + (e.message || e));
    } finally {
      setRunning(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <Header
        demoMode={demoMode}
        setDemoMode={setDemoMode}
        backendMode={backendMode}
        setBackendMode={setBackendMode}
        autoRevise={autoRevise}
        setAutoRevise={setAutoRevise}
        apiKey={apiKey}
        setApiKey={setApiKey}
        model={model}
        setModel={setModel}
        backendUrl={backendUrl}
        setBackendUrl={setBackendUrl}
      />

      <main>
        <IntakePanel
          rawPrompt={rawPrompt}
          setRawPrompt={setRawPrompt}
          ctx={ctx}
          setCtx={setCtx}
          metrics={metrics}
          activeMemTab={activeMemTab}
          setActiveMemTab={setActiveMemTab}
          retrievedIds={retrievedIds}
          running={running}
          onRun={handleRun}
          onSeed={handleSeed}
          onClearPrompt={handleClearPrompt}
          onReset={handleReset}
        />

        <PipelinePanel
          stageStates={stageStates}
          revisions={revisions}
          onReviseAndRerun={handleReviseAndRerun}
        />

        <OutputPanel
          bundle={bundle}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </main>

      <StatusBar mode={modeText} />
    </div>
  );
}
