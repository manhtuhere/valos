function Chip({ label }) {
  return <span className="prd-chip">{label}</span>;
}

export default function PrdView({ prd }) {
  if (!prd || Object.keys(prd).length === 0) {
    return (
      <div className="prd-empty">No PRD data. Run the pipeline first.</div>
    );
  }

  const {
    product_definition,
    target_user,
    wedge,
    success_criteria = [],
    non_goals = [],
    mvp_feature_set = [],
    mocked_vs_real = {},
  } = prd;

  return (
    <div className="prd-wrap">
      {product_definition && (
        <div className="prd-hero">
          <div className="prd-hero-label">Product definition</div>
          <div className="prd-hero-text">{product_definition}</div>
          {target_user && (
            <div className="prd-hero-sub">For: {target_user}</div>
          )}
        </div>
      )}

      {wedge && (
        <div className="prd-wedge">
          <div className="prd-wedge-label">Wedge</div>
          <div className="prd-wedge-text">{wedge}</div>
        </div>
      )}

      {success_criteria.length > 0 && (
        <div className="prd-section">
          <div className="prd-section-title">Success criteria</div>
          <ol className="prd-criteria-list">
            {success_criteria.map((c, i) => <li key={i}>{c}</li>)}
          </ol>
        </div>
      )}

      {mvp_feature_set.length > 0 && (
        <div className="prd-section">
          <div className="prd-section-title">MVP feature set</div>
          <div className="prd-feature-grid">
            {mvp_feature_set.map((f, i) => <Chip key={i} label={f} />)}
          </div>
        </div>
      )}

      {(mocked_vs_real.mocked?.length > 0 || mocked_vs_real.real?.length > 0) && (
        <div className="prd-section">
          <div className="prd-section-title">Mocked vs Real</div>
          <div className="prd-mvr-table">
            <div className="prd-mvr-col">
              <div className="prd-mvr-head mock">Mock OK</div>
              {(mocked_vs_real.mocked ?? []).map((m, i) => (
                <div key={i} className="prd-mvr-row">{m}</div>
              ))}
            </div>
            <div className="prd-mvr-col">
              <div className="prd-mvr-head real">Must Be Real</div>
              {(mocked_vs_real.real ?? []).map((r, i) => (
                <div key={i} className="prd-mvr-row">{r}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {non_goals.length > 0 && (
        <div className="prd-section">
          <div className="prd-section-title">Non-goals</div>
          <ul className="prd-non-goals">
            {non_goals.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
