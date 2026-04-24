import ReactFlow, { Background } from "reactflow";
import "reactflow/dist/style.css";
import { useMemo } from "react";

const proOptions = { hideAttribution: true };

const ITEM_W    = 118;
const ITEM_H    = 26;
const ITEM_GAP  = 6;
const ZONE_PAD  = 12;
const LABEL_H   = 30;
const ZONE_GAP_X = 14;
const ZONE_GAP_Y = 14;

// row/col declare the grid position; w is fixed width
const ZONE_META = [
  { key: "must_have",    label: "Must Have",    color: "#34d399", dim: "rgba(52,211,153,0.06)",   border: "rgba(52,211,153,0.22)",  row: 0, col: 0, w: 370 },
  { key: "should_have",  label: "Should Have",  color: "#fbbf24", dim: "rgba(251,191,36,0.06)",  border: "rgba(251,191,36,0.22)",  row: 0, col: 1, w: 300 },
  { key: "defer",        label: "Defer",        color: "#6b7280", dim: "rgba(107,114,128,0.06)", border: "rgba(107,114,128,0.28)", row: 0, col: 2, w: 240 },
  { key: "mock_ok",      label: "Mock OK",      color: "#94a3b8", dim: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.22)", row: 1, col: 0, w: 480 },
  { key: "must_be_real", label: "Must Be Real", color: "#38bdf8", dim: "rgba(56,189,248,0.06)",  border: "rgba(56,189,248,0.22)",  row: 1, col: 1, w: 430 },
];

function calcH(items, w) {
  if (!items.length) return LABEL_H + ZONE_PAD * 2;
  const inner  = w - ZONE_PAD * 2;
  const perRow = Math.max(1, Math.floor((inner + ITEM_GAP) / (ITEM_W + ITEM_GAP)));
  const rows   = Math.ceil(items.length / perRow);
  return LABEL_H + ZONE_PAD + rows * (ITEM_H + ITEM_GAP) - ITEM_GAP + ZONE_PAD;
}

function ZoneNode({ data }) {
  return (
    <div
      className="sm-zone"
      style={{
        width:       data.w,
        background:  data.dim,
        border:      `1px solid ${data.border}`,
        borderTop:   `2px solid ${data.color}`,
      }}
    >
      <div className="sm-zone-label" style={{ color: data.color }}>{data.label}</div>
      <div className="sm-items">
        {(data.items || []).map((item, i) => (
          <span key={i} className="sm-item" style={{ borderColor: data.border }}>{item}</span>
        ))}
      </div>
    </div>
  );
}

const nodeTypes = { zone: ZoneNode };

export default function ScopeMap({ scope }) {
  const nodes = useMemo(() => {
    if (!scope) return [];

    const r0 = ZONE_META.filter(z => z.row === 0);
    const r1 = ZONE_META.filter(z => z.row === 1);

    // x positions per column, per row
    const row0X = [
      0,
      r0[0].w + ZONE_GAP_X,
      r0[0].w + ZONE_GAP_X + r0[1].w + ZONE_GAP_X,
    ];
    const row1X = [0, r1[0].w + ZONE_GAP_X];

    const heights    = ZONE_META.map(z => calcH(scope[z.key] || [], z.w));
    const row0MaxH   = Math.max(heights[0], heights[1], heights[2]);
    const row1Y      = row0MaxH + ZONE_GAP_Y;

    return ZONE_META.map((z, i) => {
      const xArr = z.row === 0 ? row0X : row1X;
      return {
        id:        `zone-${z.key}`,
        type:      "zone",
        position:  { x: xArr[z.col], y: z.row === 0 ? 0 : row1Y },
        data:      { w: z.w, label: z.label, color: z.color, dim: z.dim, border: z.border, items: scope[z.key] || [] },
        draggable: false,
        selectable: false,
        style:     { width: z.w },
      };
    });
  }, [scope]);

  if (!scope || Object.keys(scope).length === 0) {
    return <div className="sg-empty">No scope data. Run the pipeline first.</div>;
  }

  return (
    <div className="sg-wrap">
      <div className="sg-flow-container">
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          proOptions={proOptions}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          minZoom={0.2}
          maxZoom={2}
          panOnScroll
        >
          <Background color="var(--edge)" gap={20} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}
