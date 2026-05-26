"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";

import { supabase } from "@/lib/supabaseClient";
import {
  fetchPigeonsWithParents,
  createPigeonInDb,
  updatePigeonInDb,
  setPigeonParentsInDb,
} from "@/lib/pigeonDb";
import { getIsCoopAdmin } from "@/lib/auth";

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

  const [pigeons, setPigeons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [hoveredPigeonId, setHoveredPigeonId] = useState(null);
  const [selectedPigeonId, setSelectedPigeonId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const [newPigeonOpen, setNewPigeonOpen] = useState(false);

  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  function requireAdmin(callback) {
    if (isAdmin) {
      callback();
      return;
    }

    setAdminLoginOpen(true);
  }

  useEffect(() => {
    let mounted = true;

    async function restoreAdminSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted || !session) return;

        const admin = await getIsCoopAdmin();

        if (mounted) {
          setIsAdmin(admin);
        }
      } catch (error) {
        console.error("restoreAdminSession failed:", error);
        if (mounted) {
          setIsAdmin(false);
        }
      }
    }

    restoreAdminSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (!session || event === "SIGNED_OUT") {
        setIsAdmin(false);
        return;
      }

      const admin = await getIsCoopAdmin();
      setIsAdmin(admin);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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

      setNodes(layouted.nodes);
      setEdges(layouted.edges);

      if (viewport) {
        requestAnimationFrame(() => {
          reactFlow.setViewport(viewport);
        });
      }
    },
    [reactFlow, handleHover],
  );

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setLoadError(null);

        const loadedPigeons = await fetchPigeonsWithParents();

        setPigeons(loadedPigeons);
        await runLayout(loadedPigeons, false);
      } catch (error) {
        console.error("loadData failed:", {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          raw: error,
        });

        setLoadError(
          error?.message ||
            error?.details ||
            error?.hint ||
            JSON.stringify(error) ||
            "Failed to load pigeons.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [runLayout]);

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

  function updateSelectedPigeon(nextPigeon) {
    setPigeons((current) =>
      current.map((pigeon) =>
        pigeon.id === nextPigeon.id
          ? {
              ...pigeon,
              name: nextPigeon.name,
              birthday: nextPigeon.birthday,
              bandId: nextPigeon.bandId,
              status: nextPigeon.status,
              notes: nextPigeon.notes,
            }
          : pigeon,
      ),
    );

    setNodes((current) =>
      current.map((node) => {
        if (node.id !== nextPigeon.id) return node;

        return {
          ...node,
          data: {
            ...node.data,
            name: nextPigeon.name,
            birthday: nextPigeon.birthday,
            bandId: nextPigeon.bandId,
            status: nextPigeon.status,
            notes: nextPigeon.notes,
          },
        };
      }),
    );
  }

  async function updatePigeonParents(pigeonId, parentIds) {
    const nextPigeons = pigeons.map((pigeon) =>
      pigeon.id === pigeonId
        ? {
            ...pigeon,
            parentIds,
          }
        : pigeon,
    );

    try {
      await setPigeonParentsInDb(pigeonId, parentIds);

      setPigeons(nextPigeons);
      await runLayout(nextPigeons, true);
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to save parents.");
    }
  }

  async function createPigeon(nextPigeon) {
    try {
      const createdPigeon = await createPigeonInDb(nextPigeon);
      const nextPigeons = [...pigeons, createdPigeon];

      setPigeons(nextPigeons);
      await runLayout(nextPigeons, true);
      setSelectedPigeonId(createdPigeon.id);
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to create pigeon.");
    }
  }

  async function updatePigeonField(pigeonId, field, value) {
    setPigeons((current) =>
      current.map((pigeon) =>
        pigeon.id === pigeonId ? { ...pigeon, [field]: value } : pigeon,
      ),
    );

    setNodes((current) =>
      current.map((node) => {
        if (node.id !== pigeonId) return node;

        return {
          ...node,
          data: {
            ...node.data,
            [field]: value,
          },
        };
      }),
    );

    try {
      await updatePigeonInDb(pigeonId, {
        [field]: value,
      });
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to save pigeon.");
    }
  }

  async function addChild(parentId, childId) {
    const nextPigeons = pigeons.map((pigeon) => {
      if (pigeon.id !== childId) return pigeon;

      return {
        ...pigeon,
        parentIds: [...(pigeon.parentIds || []), parentId],
      };
    });

    try {
      const child = nextPigeons.find((pigeon) => pigeon.id === childId);
      await setPigeonParentsInDb(childId, child.parentIds);

      setPigeons(nextPigeons);
      await runLayout(nextPigeons, true);
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to add child.");
    }
  }

  async function removeChild(parentId, childId) {
    const nextPigeons = pigeons.map((pigeon) => {
      if (pigeon.id !== childId) return pigeon;

      return {
        ...pigeon,
        parentIds: (pigeon.parentIds || []).filter((id) => id !== parentId),
      };
    });

    try {
      const child = nextPigeons.find((pigeon) => pigeon.id === childId);
      await setPigeonParentsInDb(childId, child.parentIds);

      setPigeons(nextPigeons);
      await runLayout(nextPigeons, true);
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to remove child.");
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
          type: "bezier",
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

      <TopNav
        isAdmin={isAdmin}
        onCreateBird={() => requireAdmin(() => setNewPigeonOpen(true))}
        onOpenAdmin={() => setAdminLoginOpen(true)}
      />

      <NewPigeonDialog
        open={newPigeonOpen}
        onOpenChange={setNewPigeonOpen}
        pigeons={pigeons}
        onCreate={createPigeon}
      />

      <AdminLoginDialog
        open={adminLoginOpen}
        onOpenChange={setAdminLoginOpen}
        onLogin={() => setIsAdmin(true)}
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
