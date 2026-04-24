export default function StatusBar({ mode }) {
  return (
    <div className="status-bar">
      <span>Val OS v0.2 · judgment-first · critic-gated · typed memory</span>
      <span style={{ flex: 1 }} />
      <span>{mode}</span>
    </div>
  );
}
