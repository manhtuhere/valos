import { useState } from "react";

function JsonNode({ data, depth }) {
  const [collapsed, setCollapsed] = useState(depth >= 2);

  if (data === null) return <span className="jv-null">null</span>;
  if (typeof data === "boolean") return <span className="jv-bool">{String(data)}</span>;
  if (typeof data === "number") return <span className="jv-num">{data}</span>;
  if (typeof data === "string") {
    return <span className="jv-str">&quot;{data}&quot;</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="jv-punct">[]</span>;
    if (collapsed) {
      return (
        <button className="jv-toggle" onClick={() => setCollapsed(false)}>
          [<span className="jv-count">{data.length}</span>]
        </button>
      );
    }
    return (
      <span>
        <button className="jv-toggle" onClick={() => setCollapsed(true)}>▾ [</button>
        <div className="jv-indent">
          {data.map((item, i) => (
            <div key={i} className="jv-row">
              <JsonNode data={item} depth={depth + 1} />
              {i < data.length - 1 && <span className="jv-punct">,</span>}
            </div>
          ))}
        </div>
        <span className="jv-close">]</span>
      </span>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data);
    if (entries.length === 0) return <span className="jv-punct">{"{}"}</span>;
    if (collapsed) {
      return (
        <button className="jv-toggle" onClick={() => setCollapsed(false)}>
          {"{"}<span className="jv-count">{entries.length}</span>{"}"}
        </button>
      );
    }
    return (
      <span>
        <button className="jv-toggle" onClick={() => setCollapsed(true)}>▾ {"{"}</button>
        <div className="jv-indent">
          {entries.map(([k, v], i) => (
            <div key={k} className="jv-row">
              <span className="jv-key">{k}</span>
              <span className="jv-colon">: </span>
              <JsonNode data={v} depth={depth + 1} />
              {i < entries.length - 1 && <span className="jv-punct">,</span>}
            </div>
          ))}
        </div>
        <span className="jv-close">{"}"}</span>
      </span>
    );
  }

  return <span className="jv-str">{String(data)}</span>;
}

export default function JsonView({ data }) {
  return (
    <div className="jv-root">
      <JsonNode data={data} depth={0} />
    </div>
  );
}
