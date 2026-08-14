"use client";
import * as React from "react";
import { ReactFlow, Background, Controls, applyNodeChanges, applyEdgeChanges, addEdge, Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CustomNode } from "./CustomNode";

const nodeTypes = {
  custom: CustomNode,
};

const initialNodes: Node[] = [
  { id: '1', type: 'custom', position: { x: 250, y: 50 }, data: { label: 'Webhook Trigger', description: 'Listens for events', icon: 'zap', isSource: true, isTarget: false } },
  { id: '2', type: 'custom', position: { x: 250, y: 200 }, data: { label: 'Data Processing', description: 'Formats input JSON', icon: 'bot', isSource: true, isTarget: true } },
  { id: '3', type: 'custom', position: { x: 250, y: 350 }, data: { label: 'Send to Slack', description: 'Notifies channel', icon: 'network', isSource: false, isTarget: true, status: 'error' } },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: 'var(--color-quaz-cyan)', strokeWidth: 2 } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: 'var(--color-quaz-purple)', strokeWidth: 2 } },
];

export function WorkflowCanvas() {
  const [nodes, setNodes] = React.useState<Node[]>(initialNodes);
  const [edges, setEdges] = React.useState<Edge[]>(initialEdges);

  const onNodesChange = React.useCallback((changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = React.useCallback((changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = React.useCallback((connection: any) => setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: 'var(--color-quaz-cyan)', strokeWidth: 2 } }, eds)), []);

  return (
    <div className="w-full h-full rounded-xl border border-white/10 bg-[#060913] overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-transparent"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(255,255,255,0.05)" gap={24} size={2} />
        <Controls className="!bg-[var(--color-quaz-bg)] !border-white/10 !fill-white [&>button]:!border-white/10 [&>button:hover]:!bg-white/10" />
      </ReactFlow>
    </div>
  );
}
