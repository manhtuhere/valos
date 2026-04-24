import { useState } from "react";

const OWNER_COLORS = {
  frontend:      { bg: "#0c2a3a", color: "#38bdf8" },
  backend:       { bg: "#0c3828", color: "#34d399" },
  data:          { bg: "#2a1a4a", color: "#a78bfa" },
  observability: { bg: "#3a2e17", color: "#fbbf24" },
};

function ownerStyle(type) {
  return OWNER_COLORS[type] || { bg: "#1a2030", color: "#8a94a4" };
}

export default function ExecutionBoard({ execution }) {
  const tasks = execution?.execution_tasks ?? [];
  const [open, setOpen] = useState({});

  if (!tasks.length) {
    return <div className="eb-empty">No execution tasks. Run the pipeline first.</div>;
  }

  function toggle(id) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="eb-wrap">
      {tasks.map((t) => {
        const s = ownerStyle(t.owner_type);
        const isOpen = !!open[t.task_id];
        return (
          <div key={t.task_id} className="eb-task">
            <div className="eb-task-header" onClick={() => toggle(t.task_id)}>
              <span className="eb-task-id">{t.task_id}</span>
              <span className="eb-task-title">{t.title}</span>
              <div className="eb-task-meta">
                <span className="eb-owner-badge" style={{ background: s.bg, color: s.color }}>
                  {t.owner_type}
                </span>
                {t.mockable && <span className="eb-mock-tag">mock</span>}
                <span className="eb-expand-icon">{isOpen ? "▲" : "▼"}</span>
              </div>
            </div>

            {t.depends_on?.length > 0 && (
              <div className="eb-deps">
                {t.depends_on.map((d) => (
                  <span key={d} className="eb-dep-chip">{d}</span>
                ))}
              </div>
            )}

            {isOpen && t.acceptance_criteria?.length > 0 && (
              <div className="eb-criteria">
                <div className="eb-criteria-label">Acceptance criteria</div>
                <ul className="eb-criteria-list">
                  {t.acceptance_criteria.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
