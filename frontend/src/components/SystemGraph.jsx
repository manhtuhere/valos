import ReactFlow, { Background, Controls, Handle, Position } from "reactflow";
import "reactflow/dist/style.css";
import { useMemo } from "react";

const NODE_W  = 160;
const NODE_H  = 56;
const H_GAP   = 24;
const V_GAP   = 64;
const PER_ROW = 5;

const proOptions = { hideAttribution: true };

function ModuleNode({ data }) {
  return (
    <>
      <Handle type="target" position={Position.Left}   id="left"   style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top}    id="top"    style={{ opacity: 0 }} />
      <div className="sg-node">
        <div className="sg-node-title">{data.label}</div>
        {data.desc && <div className="sg-node-desc">{data.desc}</div>}
      </div>
      <Handle type="source" position={Position.Right}  id="right"  style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
    </>
  );
}

const nodeTypes = { module: ModuleNode };

export default function SystemGraph({ arch }) {
  const modules          = arch?.system_modules || arch?.modules || [];
  const responsibilities = arch?.module_responsibilities || {};
  const failurePoints    = arch?.failure_points || arch?.failure_states || [];

  const { nodes, edges } = useMemo(() => {
    const ns = modules.map((mod, i) => ({
      id: `m${i}`,
      type: "module",
      position: {
        x: (i % PER_ROW) * (NODE_W + H_GAP),
        y: Math.floor(i / PER_ROW) * (NODE_H + V_GAP),
      },
      data: { label: mod, desc: responsibilities[mod] || "" },
      draggable: true,
    }));

    const es = modules.slice(0, -1).map((_, i) => {
      const isWrap = Math.floor(i / PER_ROW) !== Math.floor((i + 1) / PER_ROW);
      return {
        id: `e${i}`,
        source: `m${i}`,
        target: `m${i + 1}`,
        sourceHandle: isWrap ? "bottom" : "right",
        targetHandle: isWrap ? "top"    : "left",
        type: "smoothstep",
        style: {
          stroke: isWrap ? "var(--ink-dim)" : "var(--accent-2)",
          strokeWidth: isWrap ? 1 : 1.5,
          strokeDasharray: isWrap ? "5 4" : "none",
        },
      };
    });

    return { nodes: ns, edges: es };
  }, [modules, responsibilities]);

  if (!modules.length) {
    return <div className="sg-empty">No system data. Run the pipeline first.</div>;
  }

  return (
    <div className="sg-wrap">
      <div className="sg-flow-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={proOptions}
          minZoom={0.3}
          maxZoom={1.5}
        >
          <Background color="var(--edge)" gap={20} size={1} />
          <Controls
            style={{ background: "var(--panel-2)", border: "1px solid var(--edge)", borderRadius: 6 }}
          />
        </ReactFlow>
      </div>

      {failurePoints.length > 0 && (
        <div className="sg-failures">
          <div className="sg-failures-label">Failure points</div>
          <div className="af-failure-chips">
            {failurePoints.map((f, i) => (
              <span key={i} className="af-failure-chip">⚠ {f}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
