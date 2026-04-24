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
  const memTabs = ["all", ...Object.keys(MEMORY)];

  function buildMemRows() {
    const cats =
      activeMemTab === "all" ? Object.keys(MEMORY) : [activeMemTab];
    const rows = [];
    for (const cat of cats) {
      for (const row of MEMORY[cat]) {
        const id = `${cat}:${row.title}`;
        rows.push({ cat, id, ...row });
      }
    }
    return rows;
  }

  const memRows = buildMemRows();

  return (
    <section className="panel">
      <h3>intake</h3>
      <div className="sub">founder prompt → structured planning bundle</div>

      <textarea
        rows={5}
        placeholder="Describe the thing you want to build."
        value={rawPrompt}
        onChange={(e) => setRawPrompt(e.target.value)}
      />
      <textarea
        rows={2}
        placeholder="Optional context (audience, constraints, references)"
        style={{ marginTop: 6 }}
        value={ctx}
        onChange={(e) => setCtx(e.target.value)}
      />

      <div className="row" style={{ marginTop: 8 }}>
        <button
          className="btn primary"
          onClick={onRun}
          disabled={running}
        >
          {running ? "Running…" : "Run pipeline"}
        </button>
        <button className="btn" onClick={onSeed}>
          Seed meta-prompt
        </button>
        <button className="btn" onClick={onClearPrompt}>
          Clear prompt
        </button>
        <button className="btn" onClick={onReset}>
          Reset run
        </button>
      </div>

      <div className="metrics">
        <div className="metric">
          <div className="k">run id</div>
          <div className="v">{metrics.runId}</div>
        </div>
        <div className="metric">
          <div className="k">latency</div>
          <div className="v">{metrics.latency}</div>
        </div>
        <div className="metric">
          <div className="k">stages done</div>
          <div className="v">{metrics.stagesDone}</div>
        </div>
        <div className="metric">
          <div className="k">mode</div>
          <div className="v">{metrics.mode}</div>
        </div>
        <div className="metric">
          <div className="k">revisions</div>
          <div className="v">{metrics.revisions}</div>
        </div>
        <div className="metric">
          <div className="k">critic</div>
          <div className="v">{metrics.criticVerdict}</div>
        </div>
        <div className="metric" style={{ gridColumn: "span 2" }}>
          <div className="k">started</div>
          <div className="v">{metrics.startedAt}</div>
        </div>
      </div>

      <h3 style={{ marginTop: 12 }}>typed memory</h3>

      <div className="tabs">
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
        {memRows.map((r) => (
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
    </section>
  );
}
