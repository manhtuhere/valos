import { useState } from "react";

const STATUS_STYLES = {
  ok:             { bg: "#0c3828", color: "#34d399", label: "ok" },
  partial:        { bg: "#3a2e17", color: "#fbbf24", label: "partial" },
  needs_revision: { bg: "#2a1a0c", color: "#f97316", label: "needs revision" },
  failed:         { bg: "#3b1616", color: "#f87171", label: "failed" },
};

const OWNER_COLORS = {
  frontend:      { bg: "#0c2a3a", color: "#38bdf8" },
  backend:       { bg: "#0c3828", color: "#34d399" },
  data:          { bg: "#2a1a4a", color: "#a78bfa" },
  observability: { bg: "#3a2e17", color: "#fbbf24" },
};

function ownerStyle(type) {
  return OWNER_COLORS[type] || { bg: "#1a2030", color: "#8a94a4" };
}

function statusStyle(status) {
  return STATUS_STYLES[status] || { bg: "#1a2030", color: "#8a94a4", label: status };
}

function PendingJobCard({ task }) {
  const [open, setOpen] = useState(false);
  const s = ownerStyle(task.owner_type);
  const prompt = buildPrompt(task);

  return (
    <div className="wc-card pending-job">
      <div className="wc-header" style={{ background: s.bg, color: s.color }}>
        <span className="wc-worker-name">openclaw</span>
        <span className="wc-task-id">{task.task_id}</span>
        <span className="wc-status-label pending">queued</span>
      </div>
      <div className="wc-body">
        <div className="wc-work-item">{task.title}</div>
        {task.owner_type && (
          <div className="wc-owner-row">
            <span className="wc-owner-badge" style={{ background: s.bg, color: s.color }}>{task.owner_type}</span>
            {task.mockable && <span className="wc-mock-tag">mock ok</span>}
          </div>
        )}
        {task.acceptance_criteria?.length > 0 && (
          <div className="wc-criteria">
            {task.acceptance_criteria.map((c, i) => (
              <div key={i} className="wc-criterion">✓ {c}</div>
            ))}
          </div>
        )}
        <button className="wc-prompt-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? "▲ hide prompt" : "▼ view prompt"}
        </button>
        {open && (
          <pre className="wc-prompt-block">{prompt}</pre>
        )}
      </div>
    </div>
  );
}

function buildPrompt(task) {
  const deps = task.depends_on?.length ? `\nDepends on: ${task.depends_on.join(", ")}` : "";
  const criteria = task.acceptance_criteria?.length
    ? `\nAcceptance criteria:\n${task.acceptance_criteria.map((c) => `  - ${c}`).join("\n")}`
    : "";
  return `Task: ${task.task_id} — ${task.title}
Owner: ${task.owner_type}${deps}${criteria}

Produce a concrete, ordered implementation plan a developer can follow immediately.
Use the VALSEA stack: LangGraph, Claude API, Supabase/asyncpg, n8n, Vercel/Railway.
Return steps with: action, target file/service, detail, and acceptance check.`;
}

export default function WorkerCards({ workers, execution }) {
  const list = workers ?? [];
  const tasks = execution?.execution_tasks ?? [];

  if (!list.length) {
    return (
      <div className="wc-pending-wrap">
        <div className="wc-pending-header">
          <span className="wc-pending-title">OpenClaw — pending jobs</span>
          <span className="wc-pending-hint">Run the pipeline in backend mode to dispatch</span>
        </div>
        {tasks.length === 0 ? (
          <div className="wc-empty">No execution tasks yet. Run the pipeline first.</div>
        ) : (
          <div className="wc-grid">
            {tasks.map((t, i) => <PendingJobCard key={i} task={t} />)}
          </div>
        )}
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
