/**
 * callBackendPlan — POST to FastAPI orchestrator.
 * Mirrors the original callBackendPlan() in val-os.html 1:1.
 */
export async function callBackendPlan(rawPrompt, context, autoRevise, backendUrl, openclawUrl, openclawToken) {
  const base = (backendUrl || "http://localhost:8080").replace(/\/+$/, "");
  const body = {
    raw_prompt: rawPrompt,
    context: context || null,
    auto_revise: autoRevise,
    dispatch_workers: true,
  };
  if (openclawToken) {
    body.openclaw_base_url = openclawUrl || "http://localhost:18789";
    body.openclaw_gateway_token = openclawToken;
  }
  const res = await fetch(base + "/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Backend ${res.status}: ${await res.text()}`);
  return await res.json();
}
