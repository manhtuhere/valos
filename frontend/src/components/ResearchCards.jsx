const SOURCE_STYLES = {
  "web":               { bg: "#0c2a3a", color: "#38bdf8" },
  "web/product":       { bg: "#0c2a3a", color: "#38bdf8" },
  "docs":              { bg: "#0c3828", color: "#34d399" },
  "docs/architecture": { bg: "#0c3828", color: "#34d399" },
  "docs/papers":       { bg: "#2a1a4a", color: "#a78bfa" },
  "papers":            { bg: "#2a1a4a", color: "#a78bfa" },
  "repos/docs":        { bg: "#1a2030", color: "#94a3b8" },
  "product analysis":  { bg: "#3a2e17", color: "#fbbf24" },
  "user interviews":   { bg: "#3a2e17", color: "#fbbf24" },
};

function sourceStyle(type) {
  if (!type) return { bg: "#1a2030", color: "#8a94a4" };
  const key = type.toLowerCase();
  return SOURCE_STYLES[key] || { bg: "#1a2030", color: "#8a94a4" };
}

export default function ResearchCards({ research }) {
  const tasks = research?.research_tasks ?? [];

  if (!tasks.length) {
    return <div className="rc-empty">No research tasks. Run the pipeline first.</div>;
  }

  return (
    <div className="rc-grid">
      {tasks.map((t) => {
        const s = sourceStyle(t.source_type);
        return (
          <div key={t.task_id} className="rc-card">
            <div className="rc-card-top">
              <span className="rc-task-id">{t.task_id}</span>
              <span className="rc-source-badge" style={{ background: s.bg, color: s.color }}>
                {t.source_type}
              </span>
            </div>
            <div className="rc-objective">{t.objective}</div>
            {t.why_it_matters && (
              <div className="rc-why">{t.why_it_matters}</div>
            )}
            {t.deliverable && (
              <div className="rc-deliverable">
                <span className="rc-deliverable-label">deliverable</span>
                {t.deliverable}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
