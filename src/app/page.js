"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";

import { usePigeons } from "@/lib/AppDataContext";

import TopNav from "@/components/TopNav";
import PigeonPopup from "@/components/graph/PigeonPopup";
import NewPigeonDialog from "@/components/dialogs/NewPigeonDialog";
import AdminLoginDialog from "@/components/dialogs/AdminLoginDialog";

import { nodeTypes, pigeonWidth, pigeonHeight } from "@/components/graph/Node";
import { buildGraphData, getConnectedEdgeIds } from "@/lib/graph/graphData";
import { layoutWithElk } from "@/lib/graph/graphLayout";

// ----- Helper ----- //

function getPopupPosition({ node, reactFlow, containerRect }) {
  const popupWidth = 320;
  const popupHeight = 420;
  const gap = 16;
  const padding = 16;

  const isSmallScreen = containerRect.width < 1000;
  const navbarOffset = isSmallScreen ? 64 : 0;
  const minY = padding + navbarOffset;

  const nodeWidth = node.width || pigeonWidth;
  const nodeHeight = node.height || pigeonHeight;

  const nodeTopLeft = reactFlow.flowToScreenPosition({
    x: node.position.x,
    y: node.position.y,
  });

  const nodeBottomRight = reactFlow.flowToScreenPosition({
    x: node.position.x + nodeWidth,
    y: node.position.y + nodeHeight,
  });

  const nodeLeft = nodeTopLeft.x - containerRect.left;
  const nodeRight = nodeBottomRight.x - containerRect.left;
  const nodeCenterY =
    (nodeTopLeft.y + nodeBottomRight.y) / 2 - containerRect.top;

  const unclampedRightY = nodeCenterY - popupHeight / 2;
  const unclampedLeftY = nodeCenterY - popupHeight / 2;

  const rightPosition = {
    x: nodeRight + gap,
    y: Math.max(minY, unclampedRightY),
  };

  const leftPosition = {
    x: nodeLeft - popupWidth - gap,
    y: Math.max(minY, unclampedLeftY),
  };

  const fitsRight =
    rightPosition.x + popupWidth <= containerRect.width - padding &&
    rightPosition.y + popupHeight <= containerRect.height - padding;

  if (fitsRight) return rightPosition;

  const fitsLeft =
    leftPosition.x >= padding &&
    leftPosition.y + popupHeight <= containerRect.height - padding;

  if (fitsLeft) return leftPosition;

  return {
    x: Math.max(padding, containerRect.width - popupWidth - padding),
    y: minY,
  };
}

// ----- Graph ----- //

function PigeonGraph() {
  const reactFlow = useReactFlow();

  const {
    pigeons,
    pigeonsLoading: loading,
    pigeonsError: loadError,
    createPigeon,
    updatePigeon,
    setPigeonParents,
  } = usePigeons();

  const [rawNodes, setRawNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  // Derive display nodes from rawNodes + latest pigeon data so field edits
  // (name, status, imageUrl) are reflected without a full re-layout.
  const nodes = useMemo(
    () =>
      rawNodes.map((node) => {
        const p = pigeons.find((pig) => pig.id === node.id);
        if (!p) return node;
        return {
          ...node,
          data: {
            ...node.data,
            name: p.name,
            status: p.status,
            imageUrl: p.imageUrl,
            bandId: p.bandId,
            birthday: p.birthday,
            notes: p.notes,
          },
        };
      }),
    [rawNodes, pigeons],
  );
  const [hoveredPigeonId, setHoveredPigeonId] = useState(null);
  const [selectedPigeonId, setSelectedPigeonId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const [newPigeonOpen, setNewPigeonOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(null);

  const selectedPigeon = useMemo(
    () => pigeons.find((pigeon) => pigeon.id === selectedPigeonId) || null,
    [pigeons, selectedPigeonId],
  );

  const handleHover = useCallback((pigeonId) => {
    setHoveredPigeonId(pigeonId);
  }, []);

  const runLayout = useCallback(
    async (nextPigeons, preserveViewport = false) => {
      const viewport = preserveViewport ? reactFlow.getViewport() : null;

      const { nodes: rawNodes, edges: rawEdges } = buildGraphData(nextPigeons, {
        onHover: handleHover,
      });

      const layouted = await layoutWithElk(rawNodes, rawEdges);

      setRawNodes(layouted.nodes);
      setEdges(layouted.edges);

      if (viewport) {
        requestAnimationFrame(() => {
          reactFlow.setViewport(viewport);
        });
      }
    },
    [reactFlow, handleHover],
  );

  // Re-layout only when the graph topology changes (parentIds or pigeon count).
  // This avoids a full re-layout on every field edit (status, name, etc.).
  const graphKey = useMemo(
    () =>
      pigeons
        .map((p) => `${p.id}:${(p.parentIds ?? []).slice().sort().join(",")}`)
        .join("|"),
    [pigeons],
  );
  const isFirstLayout = useRef(true);
  useEffect(() => {
    if (!graphKey) return;
    const preserve = !isFirstLayout.current;
    isFirstLayout.current = false;
    runLayout(pigeons, preserve);
  }, [graphKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const highlightedEdgeIds = useMemo(() => {
    if (!hoveredPigeonId) return new Set();
    return getConnectedEdgeIds(hoveredPigeonId, edges);
  }, [hoveredPigeonId, edges]);

  const displayEdges = useMemo(() => {
    return edges.map((edge) => {
      const highlighted = highlightedEdgeIds.has(edge.id);

      return {
        ...edge,
        animated: highlighted,
        style: {
          strokeWidth: 2,
          stroke: "var(--color-edge)",
        },
      };
    });
  }, [edges, highlightedEdgeIds]);

  async function handleCreatePigeon(draft) {
    try {
      const created = await createPigeon(draft);
      setSelectedPigeonId(created.id);
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to create pigeon.");
    }
  }

  async function updatePigeonField(pigeonId, field, value) {
    try {
      await updatePigeon(pigeonId, { [field]: value });
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to save pigeon.");
    }
  }

  async function updatePigeonParents(pigeonId, parentIds) {
    try {
      await setPigeonParents(pigeonId, parentIds);
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to save parents.");
    }
  }

  function updatePopupPosition(node) {
    if (!node) return;

    const wrapper = document.querySelector(".flow-wrapper");
    if (!wrapper) return;

    const containerRect = wrapper.getBoundingClientRect();

    const position = getPopupPosition({
      node,
      reactFlow,
      containerRect,
    });

    setPopupPosition(position);
  }

  return (
    <main className="flow-wrapper relative h-screen w-screen flow-theme">
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.25}
        maxZoom={3.0}
        nodesDraggable={false}
        defaultEdgeOptions={{
          type: "default",
          style: {
            strokeWidth: 2,
            stroke: "var(--color-edge)",
          },
        }}
        onNodeClick={(event, node) => {
          if (node.type !== "pigeon") return;

          setSelectedPigeonId(node.id);
          setSelectedNode(node);
          updatePopupPosition(node);
        }}
        onPaneClick={() => {
          setSelectedPigeonId(null);
          setSelectedNode(null);
          setPopupPosition(null);
        }}
        onMove={() => {
          if (selectedNode) {
            updatePopupPosition(selectedNode);
          }
        }}
        onClose={() => {
          setSelectedPigeonId(null);
          setSelectedNode(null);
          setPopupPosition(null);
        }}
      >
        <Background color="var(--color-dot)" gap={24} size={4} />
        <Controls />
        <MiniMap zoomable pannable />
      </ReactFlow>

      <TopNav onAdd={() => setNewPigeonOpen(true)} onAdminChange={setIsAdmin} />

      <NewPigeonDialog
        open={newPigeonOpen}
        onOpenChange={setNewPigeonOpen}
        pigeons={pigeons}
        onCreate={handleCreatePigeon}
      />

      <PigeonPopup
        pigeon={selectedPigeon}
        pigeons={pigeons}
        position={popupPosition}
        isAdmin={isAdmin}
        onClose={() => {
          setSelectedPigeonId(null);
          setPopupPosition(null);
        }}
        onUpdateField={updatePigeonField}
        onUpdateParents={updatePigeonParents}
      />
    </main>
  );
}

// ----- Canvas ----- //

export default function FamilyTreeCanvas() {
  return (
    <ReactFlowProvider>
      <PigeonGraph />
    </ReactFlowProvider>
  );
}
