const WORKER_COLORS = {
  manus:              { bg: "#0c2a3a", color: "#38bdf8", label: "manus" },
  code_builder:       { bg: "#0c3828", color: "#34d399", label: "code_builder" },
  openclaw:           { bg: "#3a2e17", color: "#fbbf24", label: "openclaw" },
  val_clone_internal: { bg: "#2a1a4a", color: "#a78bfa", label: "val_clone_internal" },
  critic:             { bg: "#3b1626", color: "#fb7185", label: "critic" },
  memory_manager:     { bg: "#1a2030", color: "#94a3b8", label: "memory_manager" },
};

function workerStyle(worker) {
  return WORKER_COLORS[worker] || { bg: "#1a2030", color: "#8a94a4", label: worker };
}

function WorkerBadge({ worker }) {
  const s = workerStyle(worker);
  return (
    <span
      className="rt-worker-badge"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round((value ?? 0) * 100);
  const cls = value >= 0.82 ? "ok" : value >= 0.6 ? "warn" : "err";
  return (
    <div className="rt-conf-wrap">
      <div className="rt-conf-track">
        <div className={`rt-conf-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="rt-conf-label">{value?.toFixed(2) ?? "—"}</span>
    </div>
  );
}

function FallbackChip({ fallback }) {
  if (!fallback) return <span className="rt-no-fallback">—</span>;
  return <span className="rt-fallback-chip">{fallback}</span>;
}

export default function RoutingTable({ routing }) {
  const routes = routing?.routes ?? [];

  if (!routes.length) {
    return (
      <div className="rt-empty">No routing data. Run the pipeline first.</div>
    );
  }

  return (
    <div className="rt-wrap">
      <table className="rt-table">
        <thead>
          <tr>
            <th>work item</th>
            <th>worker</th>
            <th>confidence</th>
            <th>fallback</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r, i) => (
            <tr key={i}>
              <td className="rt-work-item" title={r.reason}>{r.work_item}</td>
              <td><WorkerBadge worker={r.route_to} /></td>
              <td><ConfidenceBar value={r.confidence} /></td>
              <td><FallbackChip fallback={r.fallback} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
