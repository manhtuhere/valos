export default function Header({
  demoMode,
  setDemoMode,
  backendMode,
  setBackendMode,
  autoRevise,
  setAutoRevise,
  apiKey,
  setApiKey,
  model,
  setModel,
  backendUrl,
  setBackendUrl,
}) {
  const realApiVisible = !demoMode && !backendMode;

  return (
    <header>
      <div className="brand">Val <span>OS</span></div>
      <div className="tag">judgment-first founder operating system</div>

      <div className="spacer" />

      <div className="controls">
        <label className="toggle" title="Use local judgment engine — no API calls">
          <input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} />
          <span className="toggle-pill" />
          <span>demo</span>
        </label>

        <div className="sep" />

        <label className="toggle" title="Call FastAPI orchestrator at the URL below">
          <input type="checkbox" checked={backendMode} onChange={(e) => setBackendMode(e.target.checked)} />
          <span className="toggle-pill" />
          <span>backend</span>
        </label>

        <div className="sep" />

        <label className="toggle" title="Re-run stages automatically when critic returns 'revise'">
          <input type="checkbox" checked={autoRevise} onChange={(e) => setAutoRevise(e.target.checked)} />
          <span className="toggle-pill" />
          <span>auto-revise</span>
        </label>
      </div>

      {realApiVisible && (
        <>
          <div className="field">
            <span>api key</span>
            <input
              type="password"
              placeholder="sk-ant-…"
              style={{ width: 160 }}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="field">
            <span>model</span>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="claude-sonnet-4-5">sonnet-4-5</option>
              <option value="claude-opus-4-5">opus-4-5</option>
              <option value="claude-haiku-4-5-20251001">haiku-4-5</option>
            </select>
          </div>
        </>
      )}

      {backendMode && (
        <div className="field">
          <span>orchestrator</span>
          <input
            style={{ width: 160 }}
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
          />
        </div>
      )}
    </header>
  );
}
