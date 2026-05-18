import ELK from "elkjs/lib/elk.bundled.js";

const elk = new ELK();

const manualPositions = {
  // Optional future overrides:
  // "1": { x: 0, y: 0 },
  // "union-1+2": { x: 100, y: 180 },
};

export async function layoutWithElk(rawNodes, rawEdges) {
  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",

      "elk.spacing.nodeNode": "60",
      "elk.layered.spacing.nodeNodeBetweenLayers": "70",
      "elk.layered.spacing.edgeNodeBetweenLayers": "30",

      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.layering.strategy": "NETWORK_SIMPLEX",

      "elk.edgeRouting": "SPLINES",
    },
    children: rawNodes.map((node) => ({
      id: node.id,
      width: node.width,
      height: node.height,
    })),
    edges: rawEdges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layout = await elk.layout(elkGraph);

  const positionById = new Map(
    layout.children.map((node) => [
      node.id,
      {
        x: node.x,
        y: node.y,
      },
    ]),
  );

  return {
    nodes: rawNodes.map((node) => {
      const elkPosition = positionById.get(node.id) || { x: 0, y: 0 };
      const manualPosition = manualPositions[node.id];

      return {
        ...node,
        position: manualPosition || elkPosition,
      };
    }),
    edges: rawEdges,
  };
}
