function Chip({ label }) {
  return <span className="scope-chip">{label}</span>;
}

function Zone({ title, items, className }) {
  return (
    <div className={`scope-zone ${className}`}>
      <div className="scope-zone-title">{title}</div>
      <div className="scope-chip-list">
        {(items ?? []).length === 0
          ? <span className="scope-empty">—</span>
          : (items ?? []).map((item, i) => <Chip key={i} label={item} />)
        }
      </div>
    </div>
  );
}

export default function ScopeGrid({ scope }) {
  if (!scope || Object.keys(scope).length === 0) {
    return (
      <div className="scope-empty-state">No scope data. Run the pipeline first.</div>
    );
  }

  return (
    <div className="scope-grid-wrap">
      <div className="scope-grid-top">
        <Zone title="Must Have"   items={scope.must_have}   className="must-have" />
        <Zone title="Should Have" items={scope.should_have} className="should-have" />
        <Zone title="Defer"       items={scope.defer}       className="defer" />
      </div>
      <div className="scope-grid-bottom">
        <Zone title="Mock OK"      items={scope.mock_ok}      className="mock-ok" />
        <Zone title="Must Be Real" items={scope.must_be_real} className="must-be-real" />
      </div>
    </div>
  );
}
