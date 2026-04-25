function Chip({ label }) {
  return <span className="prd-chip">{label}</span>;
}

function Section({ title, children }) {
  return (
    <div className="prd-section">
      <div className="prd-section-title">{title}</div>
      {children}
    </div>
  );
}

export default function PrdView({ prd }) {
  if (!prd || Object.keys(prd).length === 0) {
    return <div className="prd-empty">No PRD data. Run the pipeline first.</div>;
  }

  const {
    product_definition,
    target_user,
    problem_statement,
    wedge,
    competitive_moat,
    user_stories = [],
    success_criteria = [],
    kpis = [],
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
          {target_user && <div className="prd-hero-sub">For: {target_user}</div>}
        </div>
      )}

      {problem_statement && (
        <Section title="Problem statement">
          <div className="prd-problem">{problem_statement}</div>
        </Section>
      )}

      {wedge && (
        <div className="prd-wedge">
          <div className="prd-wedge-label">Wedge</div>
          <div className="prd-wedge-text">{wedge}</div>
        </div>
      )}

      {competitive_moat && (
        <Section title="Competitive moat">
          <div className="prd-moat">{competitive_moat}</div>
        </Section>
      )}

      {user_stories.length > 0 && (
        <Section title="User stories">
          <ul className="prd-stories">
            {user_stories.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </Section>
      )}

      {success_criteria.length > 0 && (
        <Section title="Success criteria">
          <ol className="prd-criteria-list">
            {success_criteria.map((c, i) => <li key={i}>{c}</li>)}
          </ol>
        </Section>
      )}

      {kpis.length > 0 && (
        <Section title="KPIs">
          <div className="prd-feature-grid">
            {kpis.map((k, i) => <Chip key={i} label={k} />)}
          </div>
        </Section>
      )}

      {mvp_feature_set.length > 0 && (
        <Section title="MVP feature set">
          <div className="prd-feature-grid">
            {mvp_feature_set.map((f, i) => <Chip key={i} label={f} />)}
          </div>
        </Section>
      )}

      {(mocked_vs_real.mocked?.length > 0 || mocked_vs_real.real?.length > 0) && (
        <Section title="Mocked vs Real">
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
        </Section>
      )}

      {non_goals.length > 0 && (
        <Section title="Non-goals">
          <ul className="prd-non-goals">
            {non_goals.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </Section>
      )}
    </div>
  );
}
