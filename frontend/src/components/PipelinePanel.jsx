import { useState } from "react";
import { STAGES } from "../data/stages.js";
import { pretty } from "../lib/utils.js";
import ArchFlow from "./ArchFlow.jsx";
import ExecutionBoard from "./ExecutionBoard.jsx";
import ResearchCards from "./ResearchCards.jsx";

const MAX_REVISIONS = 2;

function scoreColorClass(score) {
  if (score >= 0.82) return "ok";
  if (score >= 0.6) return "warn";
  return "err";
}

function CriticScoreBar({ score }) {
  if (score == null) return null;
  const cls = scoreColorClass(score);
  const pct = Math.round(score * 100);
  return (
    <div className="critic-score-bar-wrap" data-testid="critic-score-bar">
      <div className="critic-score-bar-track">
        <div className={`critic-score-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="critic-score-label">{score.toFixed(2)}</span>
    </div>
  );
}

function CriticPanel({ stageStates, revisions, onReviseAndRerun }) {
  const criticData = stageStates?.critic?.output;
  const [expanded, setExpanded] = useState(false);

  if (!criticData) {
    return (
      <div className="critic-empty">
        <span className="critic-badge pending">pending</span>
        <span className="critic-empty-label">Critic gate — waiting for pipeline</span>
      </div>
    );
  }

  const cls = scoreColorClass(criticData.score);

  return (
    <div className={`critic-card ${cls}`}>
      <div className="critic-card-top" onClick={() => setExpanded((v) => !v)}>
        <span className={`critic-badge ${criticData.status}`}>{criticData.status}</span>
        <CriticScoreBar score={criticData.score} />
        <span className="critic-expand">{expanded ? "▲" : "▼"}</span>
      </div>

      {criticData.strongest_part && (
        <div className="critic-strong">{criticData.strongest_part}</div>
      )}

      {expanded && (
        <div className="critic-body">
          {criticData.failures?.length > 0 && (
            <div className="failures">
              <div className="critic-body-label">Failures</div>
              <ul>{criticData.failures.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </div>
          )}
          {criticData.fixes?.length > 0 && (
            <div className="fixes">
              <div className="critic-body-label">Fixes</div>
              <ul>{criticData.fixes.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      <div className="critic-actions">
        {criticData.status === "revise" && revisions < MAX_REVISIONS && (
          <button className="btn warn" onClick={onReviseAndRerun}>
            Revise &amp; re-run ({revisions + 1}/{MAX_REVISIONS})
          </button>
        )}
        {criticData.status === "reject" && (
          <div className="critic-reject-hint">
            Tighten the prompt: describe the user, the action, and the success metric.
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelinePanel({ stageStates, revisions, onReviseAndRerun }) {
  const [openStages, setOpenStages] = useState({});

  function toggleStage(id) {
    setOpenStages((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function stageMeta(id) {
    const s = stageStates[id];
    if (!s || s.state === "pending") return null;
    if (s.state === "running") return "running…";
    if (s.state === "done") return `${s.ms || 0}ms`;
    if (s.state === "error") return "error";
    return null;
  }

  function renderStageDetail(id) {
    const s = stageStates[id];
    if (!s || s.state === "pending") return <div className="stage-body-empty">no output yet</div>;
    if (s.state === "running") return <div className="stage-body-empty">running…</div>;
    if (s.state === "error") return <pre>{s.error || "error"}</pre>;
    if (s.state !== "done" || s.output == null) return <div className="stage-body-empty">no output yet</div>;

    if (id === "architect") return <ArchFlow arch={s.output} />;
    if (id === "research")  return <ResearchCards research={s.output} />;
    if (id === "execution") return <ExecutionBoard execution={s.output} />;
    return <pre>{pretty(s.output)}</pre>;
  }

  const nonCriticStages = STAGES.filter((s) => s.id !== "critic");

  return (
    <section className="panel pipeline-panel">
      <h3>pipeline</h3>
      <p className="panel .sub pipeline-sub">11 stages · critic-gated · typed JSON at every boundary</p>

      <div className="pipeline">
        {nonCriticStages.map((s, idx) => {
          const state = stageStates[s.id]?.state || "pending";
          const meta = stageMeta(s.id);
          const isOpen = !!openStages[s.id];
          const isLast = idx === nonCriticStages.length - 1;

          return (
            <div key={s.id} className="tl-row">
              <div className="tl-spine">
                <div className={`tl-dot ${state}`} />
                {!isLast && <div className={`tl-line ${state === "done" ? "done" : ""}`} />}
              </div>

              <div className="tl-content">
                <div
                  className={`tl-header ${state === "done" || state === "error" ? "clickable" : ""}`}
                  onClick={() => (state === "done" || state === "error") && toggleStage(s.id)}
                >
                  <span className="tl-num">{s.n}</span>
                  <span className={`tl-title ${state}`}>{s.title}</span>
                  {meta && (
                    <span className={`tl-meta ${state}`}>{meta}</span>
                  )}
                  {(state === "done" || state === "error") && (
                    <span className="tl-chevron">{isOpen ? "▲" : "▼"}</span>
                  )}
                </div>

                {isOpen && (
                  <div className="tl-body">
                    {renderStageDetail(s.id)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="critic-section">
        <div className="critic-section-label">critic gate</div>
        <CriticPanel
          stageStates={stageStates}
          revisions={revisions}
          onReviseAndRerun={onReviseAndRerun}
        />
      </div>
    </section>
  );
}
