import { useState } from "react";
import { STAGES } from "../data/stages.js";
import { pretty } from "../lib/utils.js";
import ArchFlow from "./ArchFlow.jsx";
import ExecutionBoard from "./ExecutionBoard.jsx";
import ResearchCards from "./ResearchCards.jsx";

function renderDetail(id, stageStates) {
  const s = stageStates[id];
  if (!s || s.state !== "done" || s.output == null) return null;
  if (id === "architect") return <ArchFlow arch={s.output} />;
  if (id === "research")  return <ResearchCards research={s.output} />;
  if (id === "execution") return <ExecutionBoard execution={s.output} />;
  return <pre>{pretty(s.output)}</pre>;
}

export default function PipelineStrip({ stageStates, criticData }) {
  const [open, setOpen] = useState(null);

  function toggle(id) {
    const s = stageStates[id];
    if (s?.state !== "done" && s?.state !== "error") return;
    setOpen((prev) => (prev === id ? null : id));
  }

  const scoreClass = criticData
    ? criticData.score >= 0.82 ? "ok" : criticData.score >= 0.6 ? "warn" : "err"
    : null;

  return (
    <div className="ps-wrap">
      <div className="ps-bar">
        <div className="ps-stages">
          {STAGES.map((s, i) => {
            const state = stageStates[s.id]?.state || "pending";
            const isActive = open === s.id;
            const clickable = state === "done" || state === "error";
            return (
              <button
                key={s.id}
                className={`ps-stage ${state} ${isActive ? "active" : ""} ${clickable ? "clickable" : ""}`}
                onClick={() => toggle(s.id)}
                title={s.title}
              >
                <span className={`ps-dot ${state}`} />
                <span className="ps-label">{s.title}</span>
                {state === "done" && stageStates[s.id]?.ms > 0 && (
                  <span className="ps-ms">{stageStates[s.id].ms}ms</span>
                )}
              </button>
            );
          })}
        </div>

        {criticData && (
          <div className={`ps-verdict ${scoreClass}`}>
            <span className={`ps-verdict-badge ${scoreClass}`}>{criticData.status}</span>
            <div className="ps-verdict-bar-track">
              <div
                className={`ps-verdict-bar-fill ${scoreClass}`}
                style={{ width: `${Math.round(criticData.score * 100)}%` }}
              />
            </div>
            <span className="ps-verdict-score">{criticData.score?.toFixed(2)}</span>
          </div>
        )}
      </div>

      {open && (
        <div className="ps-detail">
          <div className="ps-detail-header">
            <span className="ps-detail-title">
              {STAGES.find((s) => s.id === open)?.n} · {STAGES.find((s) => s.id === open)?.title}
            </span>
            <button className="ps-detail-close" onClick={() => setOpen(null)}>✕</button>
          </div>
          <div className="ps-detail-body">
            {renderDetail(open, stageStates) ?? (
              <div className="ps-detail-empty">No output</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
