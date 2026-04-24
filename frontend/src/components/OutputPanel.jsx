import { pretty } from "../lib/utils.js";

const TABS = [
  { id: "prd",     label: "PRD" },
  { id: "system",  label: "System" },
  { id: "routing", label: "Routing" },
  { id: "workers", label: "Workers" },
  { id: "qa",      label: "QA" },
  { id: "deploy",  label: "Deploy" },
  { id: "memwb",   label: "Memwb" },
];

function renderContent(activeTab, bundle) {
  if (!bundle || Object.keys(bundle).length === 0) {
    return (
      <div style={{ color: "var(--ink-mute)", padding: "12px 0" }}>
        Run the pipeline to see the bundle.
      </div>
    );
  }

  const o = bundle.output || {};

  if (activeTab === "prd") {
    return <pre>{pretty(o.prd || {})}</pre>;
  }
  if (activeTab === "system") {
    return <pre>{pretty(o.system_spec || {})}</pre>;
  }
  if (activeTab === "routing") {
    return <pre>{pretty(bundle.routing || {})}</pre>;
  }
  if (activeTab === "workers") {
    const wf = bundle.worker_feedback || [];
    if (wf.length) return <pre>{pretty(wf)}</pre>;
    return (
      <div style={{ color: "var(--ink-mute)", padding: "8px 0" }}>
        No worker feedback. Workers dispatch in backend mode (or when wired locally).
      </div>
    );
  }
  if (activeTab === "qa") {
    return (
      <>
        <h4>QA checklist</h4>
        <ul>
          {(o.qa_checklist || []).map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </>
    );
  }
  if (activeTab === "deploy") {
    return (
      <>
        <h4>Deployment checklist</h4>
        <ul>
          {(o.deployment_checklist || []).map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </>
    );
  }
  if (activeTab === "memwb") {
    return <pre>{pretty(bundle.memory_writeback || {})}</pre>;
  }
  return null;
}

export default function OutputPanel({ bundle, activeTab, setActiveTab }) {
  return (
    <section className="panel">
      <h3>output bundle</h3>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            data-tab={t.id}
            className={activeTab === t.id ? "active" : ""}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bundle-body">
        {renderContent(activeTab, bundle)}
      </div>
    </section>
  );
}
