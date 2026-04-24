export const STOP = new Set(
  "a an the and or to for of in on with by me my our from that which is are be being it its as so into onto up down just how what why do we build make"
    .split(" ")
);

export function tokenize(s) {
  return (String(s || "").toLowerCase().match(/[a-z0-9_]+/g) || []).filter(
    (t) => !STOP.has(t) && t.length > 2
  );
}

export function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export function pretty(o) {
  return JSON.stringify(o, null, 2);
}

export function uid() {
  return "r_" + Math.random().toString(36).slice(2, 10);
}

export function nowIso() {
  return new Date().toISOString();
}
