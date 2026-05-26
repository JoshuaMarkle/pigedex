"use client";

import { useEffect, useState } from "react";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";

import { nodeTypes } from "@/components/graph/Node";
import { buildGraphData } from "@/lib/graph/graphData";
import { layoutWithElk } from "@/lib/graph/graphLayout";

// ── Demo data (small, hand-picked 3-generation tree) ──────────────────────────

const demoPigeons = [
  // Gen 1
  {
    id: "1",
    name: "Blue",
    birthday: "03-12-2023",
    status: "home",
    parentIds: [],
    imageUrl: null,
  },
  {
    id: "2",
    name: "Ash",
    birthday: "2023",
    status: "home",
    parentIds: [],
    imageUrl: null,
  },
  {
    id: "3",
    name: "Cloud",
    birthday: "04-15-2023",
    status: "lost",
    parentIds: [],
    imageUrl: null,
  },
  {
    id: "4",
    name: "Pearl",
    birthday: null,
    status: "home",
    parentIds: [],
    imageUrl: null,
  },
  // Gen 2
  {
    id: "6",
    name: "Speck",
    birthday: "02-10-2024",
    status: "home",
    parentIds: ["1", "2"],
    imageUrl: null,
  },
  {
    id: "7",
    name: "Dot",
    birthday: "02-10-2024",
    status: "flying",
    parentIds: ["1", "2"],
    imageUrl: null,
  },
  {
    id: "8",
    name: "Misty",
    birthday: "03-21-2024",
    status: "home",
    parentIds: ["3", "4"],
    imageUrl: null,
  },
  // Gen 3
  {
    id: "13",
    name: "Pebble",
    birthday: "01-14-2025",
    status: "home",
    parentIds: ["6", "8"],
    imageUrl: null,
  },
];

const noopHandlers = { onHover: () => {} };

// ── Component ─────────────────────────────────────────────────────────────────

export default function DemoFamilyTree() {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });

  useEffect(() => {
    let mounted = true;

    async function build() {
      const { nodes: rawNodes, edges: rawEdges } = buildGraphData(
        demoPigeons,
        noopHandlers,
      );

      const laid = await layoutWithElk(rawNodes, rawEdges);
      if (!mounted) return;

      setGraph({
        nodes: laid.nodes.map((n) => ({
          ...n,
          draggable: false,
          selectable: false,
        })),
        edges: laid.edges.map((e) => ({
          ...e,
          style: { strokeWidth: 2, stroke: "var(--color-edge)" },
        })),
      });
    }

    build();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    // pointer-events-none on the wrapper prevents hover/click/scroll
    // from reaching the canvas, so the tree feels like a picture.
    <div className="h-[480px] w-full pointer-events-none select-none">
      <ReactFlowProvider>
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
        />
      </ReactFlowProvider>
    </div>
  );
}
