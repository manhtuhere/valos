import { useState } from "react";
import { MEMORY } from "../data/memory.js";

const SEED_PROMPT =
  "Build me a founder operating system that turns prompts into product specs and execution plans.";

export default function IntakePanel({
  rawPrompt,
  setRawPrompt,
  ctx,
  setCtx,
  metrics,
  activeMemTab,
  setActiveMemTab,
  retrievedIds,
  running,
  onRun,
  onSeed,
  onClearPrompt,
  onReset,
}) {
  const [showContext, setShowContext] = useState(false);
  const [showMemory, setShowMemory] = useState(false);

  const hasRun = metrics.runId !== "—";
  const memTabs = ["all", ...Object.keys(MEMORY)];

  function buildMemRows() {
    const cats = activeMemTab === "all" ? Object.keys(MEMORY) : [activeMemTab];
    const rows = [];
    for (const cat of cats)
      for (const row of MEMORY[cat])
        rows.push({ cat, id: `${cat}:${row.title}`, ...row });
    return rows;
  }

  return (
    <section className="panel intake-panel">
      <div className="intake-header">
        <h3>intake</h3>
        {hasRun && (
          <button className="btn-ghost" onClick={onReset} title="Reset run">
            reset
          </button>
        )}
      </div>
      <p className="intake-sub">Describe the thing you want to build.</p>

      <textarea
        className="prompt-textarea"
        rows={6}
        placeholder="e.g. Build me a founder OS that turns a raw idea into a typed architecture, routing plan, and execution spec."
        value={rawPrompt}
        onChange={(e) => setRawPrompt(e.target.value)}
        disabled={running}
      />

      <div className="intake-actions-row">
        {!showContext && (
          <button className="btn-link" onClick={() => setShowContext(true)}>
            + context
          </button>
        )}
        {!rawPrompt && (
          <button className="btn-link" onClick={onSeed}>
            use seed prompt
          </button>
        )}
        {rawPrompt && !running && (
          <button className="btn-link" onClick={onClearPrompt}>
            clear
          </button>
        )}
      </div>

      {showContext && (
        <div className="ctx-wrap">
          <div className="ctx-label-row">
            <span className="ctx-label">context</span>
            <button className="btn-ghost" onClick={() => { setShowContext(false); setCtx(""); }}>
              remove
            </button>
          </div>
          <textarea
            rows={2}
            placeholder="Audience, constraints, references…"
            value={ctx}
            onChange={(e) => setCtx(e.target.value)}
            disabled={running}
          />
        </div>
      )}

      <button
        className={`run-btn ${running ? "running" : ""}`}
        onClick={onRun}
        disabled={running}
      >
        {running ? (
          <>
            <span className="run-spinner" />
            Running pipeline…
          </>
        ) : (
          "Run pipeline →"
        )}
      </button>

      {hasRun && (
        <div className="metrics-row">
          <div className="metric-pill">
            <span className="metric-pill-k">latency</span>
            <span className="metric-pill-v">{metrics.latency}</span>
          </div>
          <div className="metric-pill">
            <span className="metric-pill-k">stages</span>
            <span className="metric-pill-v">{metrics.stagesDone}</span>
          </div>
          <div className="metric-pill">
            <span className="metric-pill-k">revisions</span>
            <span className="metric-pill-v">{metrics.revisions}</span>
          </div>
          <div className="metric-pill">
            <span className="metric-pill-k">mode</span>
            <span className="metric-pill-v">{metrics.mode}</span>
          </div>
        </div>
      )}

      <button
        className="memory-toggle"
        onClick={() => setShowMemory((v) => !v)}
      >
        <span>typed memory</span>
        <span className="memory-toggle-icon">{showMemory ? "▲" : "▼"}</span>
      </button>

      {showMemory && (
        <>
          <div className="tabs mem-tabs">
            {memTabs.map((t) => (
              <button
                key={t}
                className={t === activeMemTab ? "active" : ""}
                onClick={() => setActiveMemTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="mem-list">
            {buildMemRows().map((r) => (
              <div
                key={r.id}
                className={`mem-item${retrievedIds.has(r.id) ? " hit" : ""}`}
              >
                <div className="t">
                  {r.title}
                  {retrievedIds.has(r.id) && (
                    <span className="score">retrieved</span>
                  )}
                </div>
                <div className="c">{r.content}</div>
                <div className="tags">
                  {(r.tags || []).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                  <span style={{ color: "var(--ink-dim)" }}>{r.cat}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
