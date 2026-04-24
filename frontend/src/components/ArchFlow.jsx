export default function ArchFlow({ arch }) {
  const modules       = arch?.system_modules || arch?.modules || [];
  const responsibilities = arch?.module_responsibilities || {};
  const failurePoints = arch?.failure_points || arch?.failure_states || [];

  if (!modules.length) {
    return <div className="af-empty">No architecture data. Run the pipeline first.</div>;
  }

  return (
    <div className="af-wrap">
      <div className="af-chain-scroll">
        <div className="af-chain">
          {modules.map((m, i) => (
            <span key={m} className="af-chain-item">
              <div className="af-module">{m}</div>
              {i < modules.length - 1 && <span className="af-arrow">→</span>}
            </span>
          ))}
        </div>
      </div>

      {Object.keys(responsibilities).length > 0 && (
        <div className="af-section">
          <div className="af-label">Responsibilities</div>
          <div className="af-resp-table">
            {Object.entries(responsibilities).map(([mod, desc]) => (
              <div key={mod} className="af-resp-row">
                <div className="af-resp-mod">{mod}</div>
                <div className="af-resp-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {failurePoints.length > 0 && (
        <div className="af-section">
          <div className="af-label">Failure points</div>
          <div className="af-failure-chips">
            {failurePoints.map((f, i) => (
              <span key={i} className="af-failure-chip">⚠ {f}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
