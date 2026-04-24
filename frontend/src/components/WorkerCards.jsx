const STATUS_STYLES = {
  ok:             { bg: "#0c3828", color: "#34d399", label: "ok" },
  partial:        { bg: "#3a2e17", color: "#fbbf24", label: "partial" },
  needs_revision: { bg: "#2a1a0c", color: "#f97316", label: "needs revision" },
  failed:         { bg: "#3b1616", color: "#f87171", label: "failed" },
};

function statusStyle(status) {
  return STATUS_STYLES[status] || { bg: "#1a2030", color: "#8a94a4", label: status };
}

export default function WorkerCards({ workers }) {
  const list = workers ?? [];

  if (!list.length) {
    return (
      <div className="wc-empty">
        No worker feedback. Workers dispatch in backend mode only.
      </div>
    );
  }

  return (
    <div className="wc-grid">
      {list.map((w, i) => {
        const s = statusStyle(w.status);
        return (
          <div key={i} className="wc-card">
            <div className="wc-header" style={{ background: s.bg, color: s.color }}>
              <span className="wc-worker-name">{w.worker}</span>
              <span className="wc-status-label">{s.label}</span>
            </div>

            <div className="wc-body">
              {w.work_item && (
                <div className="wc-work-item">{w.work_item}</div>
              )}

              {w.logs?.length > 0 && (
                <div className="wc-logs">
                  {w.logs.map((l, j) => (
                    <div key={j} className="wc-log-line">{l}</div>
                  ))}
                </div>
              )}

              {w.next_actions?.length > 0 && (
                <div className="wc-actions">
                  {w.next_actions.map((a, j) => (
                    <span key={j} className="wc-action-chip">{a}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
