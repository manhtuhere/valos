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
      <div className="brand">
        Val <span>OS</span>
      </div>
      <div className="tag">judgment-first founder operating system</div>
      <div className="spacer" />

      <label
        className="toggle"
        title="Use the local judgment engine (no API calls)"
      >
        <input
          type="checkbox"
          checked={demoMode}
          onChange={(e) => setDemoMode(e.target.checked)}
        />
        demo
      </label>

      <label
        className="toggle"
        title="Call the FastAPI orchestrator at localhost:8080 (overrides demo/api)"
      >
        <input
          type="checkbox"
          checked={backendMode}
          onChange={(e) => setBackendMode(e.target.checked)}
        />
        backend
      </label>

      <label
        className="toggle"
        title="If critic returns 'revise', automatically re-run stages with fixes applied"
      >
        <input
          type="checkbox"
          checked={autoRevise}
          onChange={(e) => setAutoRevise(e.target.checked)}
        />
        auto-revise
      </label>

      {realApiVisible && (
        <div className="field">
          <span>api key</span>
          <input
            type="password"
            placeholder="sk-ant-..."
            style={{ width: 180 }}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      )}

      {realApiVisible && (
        <div className="field">
          <span>model</span>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="claude-sonnet-4-5">claude-sonnet-4-5</option>
            <option value="claude-opus-4-5">claude-opus-4-5</option>
            <option value="claude-haiku-4-5-20251001">claude-haiku-4-5</option>
          </select>
        </div>
      )}

      {backendMode && (
        <div className="field">
          <span>orchestrator</span>
          <input
            style={{ width: 180 }}
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
          />
        </div>
      )}
    </header>
  );
}
