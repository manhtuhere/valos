import { useState } from "react";
import PrdView from "./PrdView.jsx";
import RoutingTable from "./RoutingTable.jsx";
import ScopeGrid from "./ScopeGrid.jsx";
import SystemGraph from "./SystemGraph.jsx";
import WorkerCards from "./WorkerCards.jsx";

const TABS = [
  { id: "prd",     label: "PRD" },
  { id: "scope",   label: "Scope" },
  { id: "system",  label: "System" },
  { id: "routing", label: "Routing" },
  { id: "workers", label: "Workers" },
  { id: "qa",      label: "QA" },
  { id: "deploy",  label: "Deploy" },
  { id: "memwb",   label: "Memwb" },
];

function EmptyState() {
  return (
    <div className="output-empty">
      <div className="output-empty-icon">⬡</div>
      <div className="output-empty-title">No output yet</div>
      <div className="output-empty-sub">Run the pipeline to generate a PRD, architecture, routing plan, and execution queue.</div>
    </div>
  );
}

function renderContent(activeTab, bundle) {
  if (!bundle || Object.keys(bundle).length === 0) return <EmptyState />;

  const o = bundle.output || {};

  if (activeTab === "prd")     return <PrdView prd={o.prd} />;
  if (activeTab === "scope")   return <ScopeGrid scope={bundle.scope} />;
  if (activeTab === "system")  return <SystemGraph arch={bundle.architect} />;
  if (activeTab === "routing") return <RoutingTable routing={bundle.routing} />;
  if (activeTab === "workers") return <WorkerCards workers={bundle.worker_feedback} execution={bundle.execution} />;

  if (activeTab === "qa") {
    const items = o.qa_checklist || [];
    if (!items.length) return <EmptyState />;
    const isStructured = items.length > 0 && typeof items[0] === "object";
    if (isStructured) {
      const CATEGORY_COLORS = {
        "Semantic accuracy": "var(--accent)",
        "Latency":           "#60a5fa",
        "Integration":       "#34d399",
        "Edge case":         "#fbbf24",
        "Regression":        "#f97316",
      };
      return (
        <div className="qa-list">
          {items.map((q, i) => (
            <div key={i} className="qa-card">
              <div className="qa-card-header">
                <span className="qa-badge" style={{ background: CATEGORY_COLORS[q.category] ? CATEGORY_COLORS[q.category] + "22" : "#1a2030", color: CATEGORY_COLORS[q.category] || "#8a94a4" }}>
                  {q.category}
                </span>
                <span className="qa-test-name">{q.test}</span>
              </div>
              {q.input && <div className="qa-row"><span className="qa-label">Input</span><span className="qa-val">{q.input}</span></div>}
              {q.expected_output && <div className="qa-row"><span className="qa-label">Expected</span><span className="qa-val">{q.expected_output}</span></div>}
              {q.pass_threshold && <div className="qa-row qa-threshold"><span className="qa-label">Pass</span><span className="qa-val">{q.pass_threshold}</span></div>}
            </div>
          ))}
        </div>
      );
    }
    return (
      <ul className="checklist">
        {items.map((q, i) => <li key={i}><span className="check-icon">✓</span>{typeof q === "string" ? q : JSON.stringify(q)}</li>)}
      </ul>
    );
  }

  if (activeTab === "deploy") {
    const items = o.deployment_checklist || [];
    return items.length ? (
      <ul className="checklist">
        {items.map((q, i) => <li key={i}><span className="check-icon">◆</span>{q}</li>)}
      </ul>
    ) : <EmptyState />;
  }

  if (activeTab === "memwb") {
    const recs = bundle.memory_writeback?.recommendations || [];
    if (!recs.length) return <EmptyState />;
    return (
      <div className="memwb-list">
        {recs.map((r, i) => (
          <div key={i} className={`memwb-card ${r.should_write ? "write" : "skip"}`}>
            <div className="memwb-card-top">
              <span className={`memwb-badge ${r.should_write ? "write" : "skip"}`}>
                {r.should_write ? "write" : "skip"}
              </span>
              <span className="memwb-type">{r.memory_type}</span>
              <div className="memwb-conf-bar-wrap">
                <div className="memwb-conf-bar">
                  <div
                    className="memwb-conf-fill"
                    style={{ width: `${Math.round((r.confidence || 0) * 100)}%` }}
                  />
                </div>
                <span className="memwb-conf-label">{r.confidence?.toFixed(2)}</span>
              </div>
            </div>
            <div className="memwb-title">{r.title}</div>
            {r.justification && (
              <div className="memwb-just">{r.justification}</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return null;
}

const MAX_REVISIONS = 2;

export default function OutputPanel({ bundle, activeTab, setActiveTab, criticData, onReviseAndRerun, revisions }) {
  const hasBundle = bundle && Object.keys(bundle).length > 0;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeLabel = TABS.find((t) => t.id === activeTab)?.label ?? activeTab;

  return (
    <section className="panel output-panel">
      <div className="output-tabs-wrap">
        <div className="tabs output-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={activeTab === t.id ? "active" : ""}
              onClick={() => setActiveTab(t.id)}
              disabled={!hasBundle && t.id !== "prd"}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="output-tab-actions">
          {hasBundle && (
            <button
              className="panel-expand-btn"
              onClick={() => setDrawerOpen(true)}
              title="Expand panel"
            >
              ⤢
            </button>
          )}
          {criticData?.status === "revise" && revisions < MAX_REVISIONS && (
            <button className="btn warn output-revise-btn" onClick={onReviseAndRerun}>
              Revise &amp; re-run ({revisions + 1}/{MAX_REVISIONS})
            </button>
          )}
        </div>
      </div>

      <div className="bundle-body">
        {renderContent(activeTab, bundle)}
      </div>

      {drawerOpen && (
        <div className="output-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="output-drawer" role="dialog" aria-label={activeLabel} onClick={(e) => e.stopPropagation()}>
            <div className="output-drawer-header">
              <span className="output-drawer-title">{activeLabel}</span>
              <button className="output-drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
            </div>
            <div className="output-drawer-body">
              {renderContent(activeTab, bundle)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
