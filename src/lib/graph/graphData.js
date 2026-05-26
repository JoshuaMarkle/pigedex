import { MarkerType } from "@xyflow/react";
import { pigeonWidth, pigeonHeight, unionSize } from "@/components/graph/Node";

// ----- Functions ----- //

export function getUnionId(parentIds) {
  return `union-${[...parentIds].sort().join("+")}`;
}

export function buildGraphData(pigeons, handlers) {
  const pigeonNodes = pigeons.map((pigeon) => ({
    id: pigeon.id,
    type: "pigeon",
    data: {
      pigeonId: pigeon.id,
      name: pigeon.name,
      birthday: pigeon.birthday,
      bandId: pigeon.bandId,
      status: pigeon.status,
      imageUrl: pigeon.imageUrl,
      onHover: handlers.onHover,
    },
    width: pigeonWidth,
    height: pigeonHeight,
    position: { x: 0, y: 0 },
  }));

  const unionMap = new Map();

  pigeons.forEach((pigeon) => {
    if (!pigeon.parentIds || pigeon.parentIds.length === 0) return;

    const unionId = getUnionId(pigeon.parentIds);

    if (!unionMap.has(unionId)) {
      unionMap.set(unionId, {
        id: unionId,
        type: "union",
        data: {
          parentIds: [...pigeon.parentIds].sort(),
        },
        width: unionSize,
        height: unionSize,
        position: { x: 0, y: 0 },
      });
    }
  });

  const unionNodes = [...unionMap.values()];

  const parentToUnionEdges = unionNodes.flatMap((unionNode) =>
    unionNode.data.parentIds.map((parentId) => ({
      id: `${parentId}-${unionNode.id}`,
      source: parentId,
      target: unionNode.id,
      type: "bezier",
    })),
  );

  const unionToChildEdges = pigeons
    .filter((pigeon) => pigeon.parentIds && pigeon.parentIds.length > 0)
    .map((pigeon) => {
      const unionId = getUnionId(pigeon.parentIds);

      return {
        id: `${unionId}-${pigeon.id}`,
        source: unionId,
        target: pigeon.id,
        type: "bezier",
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      };
    });

  return {
    nodes: [...pigeonNodes, ...unionNodes],
    edges: [...parentToUnionEdges, ...unionToChildEdges],
  };
}

export function getConnectedEdgeIds(startNodeId, edges) {
  const highlighted = new Set();

  const outgoing = new Map();
  const incoming = new Map();

  edges.forEach((edge) => {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);

    outgoing.get(edge.source).push(edge);
    incoming.get(edge.target).push(edge);
  });

  const walkForward = [startNodeId];
  const seenForward = new Set();

  while (walkForward.length > 0) {
    const nodeId = walkForward.pop();
    if (seenForward.has(nodeId)) continue;

    seenForward.add(nodeId);

    const nextEdges = outgoing.get(nodeId) || [];

    nextEdges.forEach((edge) => {
      highlighted.add(edge.id);
      walkForward.push(edge.target);
    });
  }

  const walkBackward = [startNodeId];
  const seenBackward = new Set();

  while (walkBackward.length > 0) {
    const nodeId = walkBackward.pop();
    if (seenBackward.has(nodeId)) continue;

    seenBackward.add(nodeId);

    const previousEdges = incoming.get(nodeId) || [];

    previousEdges.forEach((edge) => {
      highlighted.add(edge.id);
      walkBackward.push(edge.source);
    });
  }

  return highlighted;
}

export function hasDescendant(pigeons, parentId, descendantId) {
  const childrenByParentId = new Map();

  pigeons.forEach((pigeon) => {
    pigeon.parentIds?.forEach((id) => {
      if (!childrenByParentId.has(id)) childrenByParentId.set(id, []);
      childrenByParentId.get(id).push(pigeon.id);
    });
  });

  const stack = [parentId];
  const seen = new Set();

  while (stack.length > 0) {
    const currentId = stack.pop();

    if (currentId === descendantId) return true;
    if (seen.has(currentId)) continue;

    seen.add(currentId);

    const children = childrenByParentId.get(currentId) || [];
    stack.push(...children);
  }

  return false;
}
