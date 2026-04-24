import { useState } from "react";
import { STAGES } from "../data/stages.js";
import { pretty } from "../lib/utils.js";

const MAX_REVISIONS = 2;

function CriticPanel({ stageStates, revisions, onReviseAndRerun }) {
  const criticData = stageStates?.critic?.output;

  const badgeClass = criticData
    ? `critic-badge ${criticData.status}`
    : "critic-badge pending";
  const badgeText = criticData?.status || "pending";
  const titleText = criticData
    ? `Critic: ${criticData.status}`
    : "Waiting for pipeline";
  const scoreText =
    criticData?.score != null ? `score ${criticData.score}` : "";
  const subText = criticData?.strongest_part
    ? `Strongest: ${criticData.strongest_part}`
    : "";

  return (
    <div className="critic-panel">
      <span className={badgeClass}>{badgeText}</span>
      <span style={{ marginLeft: 6 }}>{titleText}</span>
      <span className="critic-score">{scoreText}</span>
      {subText && (
        <div className="sub" style={{ marginTop: 4 }}>
          {subText}
        </div>
      )}

      {criticData && (
        <div className="critic-body">
          {criticData.failures?.length > 0 && (
            <div className="failures">
              Failures:
              <ul>
                {criticData.failures.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {criticData.fixes?.length > 0 && (
            <div className="fixes">
              Fixes:
              <ul>
                {criticData.fixes.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="critic-actions">
        {criticData?.status === "revise" && revisions < MAX_REVISIONS && (
          <button className="btn warn" onClick={onReviseAndRerun}>
            Revise &amp; re-run ({revisions + 1}/{MAX_REVISIONS})
          </button>
        )}
        {criticData?.status === "reject" && (
          <div style={{ color: "var(--err)", fontSize: "11.5px" }}>
            Critic rejected. Tighten the prompt: describe the user, the action,
            and the success metric.
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelinePanel({
  stageStates,
  revisions,
  onReviseAndRerun,
}) {
  const [openStages, setOpenStages] = useState({});

  function toggleStage(id) {
    setOpenStages((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function stageClass(id) {
    const s = stageStates[id];
    return `stage ${s?.state || "pending"}${openStages[id] ? " open" : ""}`;
  }

  function stageMeta(id) {
    const s = stageStates[id];
    if (!s || s.state === "pending") return "—";
    if (s.state === "running") return "running…";
    if (s.state === "done") return `${s.ms || 0}ms`;
    if (s.state === "error") return "error";
    return "—";
  }

  function stageDetail(id) {
    const s = stageStates[id];
    if (!s) return "(no output yet)";
    if (s.state === "done" && s.output != null) return pretty(s.output);
    if (s.state === "error") return s.error || "error";
    return "(no output yet)";
  }

  return (
    <section className="panel">
      <h3>pipeline</h3>
      <div className="sub">
        11 stages · typed JSON at every boundary · critic gates output
      </div>

      <div className="pipeline">
        {STAGES.map((s) => (
          <div key={s.id}>
            <div
              className={stageClass(s.id)}
              data-id={s.id}
              onClick={() => toggleStage(s.id)}
            >
              <div className="dot" />
              <div className="title">
                <span className="n">{s.n}</span>
                {s.title}
              </div>
              <div className="meta">{stageMeta(s.id)}</div>
            </div>

            {openStages[s.id] && (
              <div className="stage-detail open">
                <pre>{stageDetail(s.id)}</pre>
              </div>
            )}
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: 12 }}>critic</h3>
      <CriticPanel
        stageStates={stageStates}
        revisions={revisions}
        onReviseAndRerun={onReviseAndRerun}
      />
    </section>
  );
}
