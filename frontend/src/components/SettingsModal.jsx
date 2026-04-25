import { useState } from "react";

const STATUS = {
  idle:    { cls: "",        label: "" },
  testing: { cls: "testing", label: "testing…" },
  ok:      { cls: "ok",      label: null },
  fail:    { cls: "fail",    label: null },
};

export default function SettingsModal({
  open, onClose,
  openclawUrl, setOpenclawUrl,
  openclawToken, setOpenclawToken,
  backendUrl,
}) {
  const [showToken, setShowToken] = useState(false);
  const [pingState, setPingState] = useState("idle");
  const [pingResult, setPingResult] = useState(null);

  if (!open) return null;

  async function handlePing() {
    if (!openclawUrl) return;
    setPingState("testing");
    setPingResult(null);
    try {
      const base = (backendUrl || "http://localhost:8080").replace(/\/$/, "");
      const params = new URLSearchParams({ url: openclawUrl, token: openclawToken || "" });
      const res = await fetch(`${base}/api/openclaw/ping?${params}`);
      const data = await res.json();
      setPingResult(data);
      setPingState(data.ok ? "ok" : "fail");
    } catch (e) {
      setPingResult({ ok: false, detail: `Could not reach backend: ${e.message}`, latency_ms: null });
      setPingState("fail");
    }
  }

  const s = STATUS[pingState];

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-hdr">
          <span className="settings-title">Worker Settings</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-section">
          <div className="settings-section-label">OpenClaw</div>
          <p className="settings-hint">
            Credentials sent per-request to your local OpenClaw instance.
            Never stored on the server.
          </p>

          <div className="settings-field">
            <label>Base URL</label>
            <input
              type="text"
              placeholder="http://localhost:18789"
              value={openclawUrl}
              onChange={(e) => { setOpenclawUrl(e.target.value); setPingState("idle"); }}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div className="settings-field">
            <label>Gateway Token</label>
            <div className="settings-secret-row">
              <input
                type={showToken ? "text" : "password"}
                placeholder="your-gateway-token"
                value={openclawToken}
                onChange={(e) => { setOpenclawToken(e.target.value); setPingState("idle"); }}
                spellCheck={false}
                autoComplete="off"
              />
              <button
                className="settings-eye"
                onClick={() => setShowToken((v) => !v)}
                title={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? "hide" : "show"}
              </button>
            </div>
          </div>

          <div className="settings-ping-row">
            <button
              className={`settings-ping-btn ${s.cls}`}
              onClick={handlePing}
              disabled={pingState === "testing" || !openclawUrl}
            >
              {pingState === "testing" ? "testing…" : "Test connection"}
            </button>
            {pingResult && (
              <span className={`settings-ping-result ${pingState}`}>
                {pingResult.ok
                  ? `✓ connected · ${pingResult.latency_ms}ms`
                  : `✗ ${pingResult.detail}${pingResult.latency_ms != null ? ` · ${pingResult.latency_ms}ms` : ""}`
                }
              </span>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-save" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
