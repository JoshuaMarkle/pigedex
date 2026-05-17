"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import ELK from "elkjs/lib/elk.bundled.js";
import { FaDotCircle } from "react-icons/fa";
import { PiBird, PiBirdBold } from "react-icons/pi";
import { CalendarIcon } from "lucide-react";
import { IoSettingsOutline } from "react-icons/io5";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { pigeons as mockPigeons } from "@/data/mockData";

const elk = new ELK();

const pigeonWidth = 180;
const pigeonHeight = 72;
const unionSize = 16;

const manualPositions = {
  // Optional future overrides:
  // "1": { x: 0, y: 0 },
  // "union-1+2": { x: 100, y: 180 },
};

function getStatusClass(status) {
  if (status === "home") return "ring-green";
  if (status === "flying") return "ring-blue";
  if (status === "lost") return "ring-red";
  return "ring-foreground/10";
}

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

function PigeonPopup({ pigeon, position, onClose, onChange }) {
  if (!pigeon || !position) return null;

  return (
    <Card
      className="absolute z-5 w-[320px] shadow-xl"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{pigeon.name}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {pigeon.bandId || "Unbanded"}
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pigeon-name">Name</Label>
          <Input
            id="pigeon-name"
            value={pigeon.name || ""}
            onChange={(event) =>
              onChange({
                ...pigeon,
                name: event.target.value,
              })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pigeon-birthday">Birthday</Label>
          <Input
            id="pigeon-birthday"
            value={pigeon.birthday || ""}
            placeholder="Unknown"
            onChange={(event) =>
              onChange({
                ...pigeon,
                birthday: event.target.value,
              })
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={pigeon.status}
            onValueChange={(status) =>
              onChange({
                ...pigeon,
                status,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="home">Home</SelectItem>
              <SelectItem value="flying">Flying</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="pigeon-notes">Notes</Label>
          <Textarea
            id="pigeon-notes"
            value={pigeon.notes || ""}
            placeholder="Medical notes, description, behavior..."
            onChange={(event) =>
              onChange({
                ...pigeon,
                notes: event.target.value,
              })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PigeonNode({ data }) {
  return (
    <div
      onMouseEnter={() => data.onHover(data.pigeonId)}
      onMouseLeave={() => data.onHover(null)}
      className={`relative w-[180px] cursor-pointer rounded-xl ring-2 border-b-4 bg-white px-4 py-3 shadow-md transition-transform hover:scale-[1.02] ${getStatusClass(
        data.status,
      )}`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <div className="flex items-center gap-2">
        <Avatar>
          <AvatarImage src={data.imageUrl || ""} />
          <AvatarFallback className="border-2 border-edge!">
            <PiBirdBold />
          </AvatarFallback>
        </Avatar>

        <div className="space-y-0">
          <div className="text-sm font-semibold">{data.name}</div>
          <div className="text-xs text-gray-600">
            {data.birthday || "Unknown"}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

function UnionNode() {
  return (
    <div className="relative h-2 w-2">
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <FaDotCircle className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-edge" />

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

const nodeTypes = {
  pigeon: PigeonNode,
  union: UnionNode,
};

function getUnionId(parentIds) {
  return `union-${[...parentIds].sort().join("+")}`;
}

function buildGraphData(pigeons, handlers) {
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
      onSelect: handlers.onSelect,
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

async function layoutWithElk(rawNodes, rawEdges) {
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

function getConnectedEdgeIds(startNodeId, edges) {
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

function hasDescendant(pigeons, parentId, descendantId) {
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

function PigeonEditor({
  pigeon,
  pigeons,
  onClose,
  onUpdateField,
  onAddChild,
  onRemoveChild,
}) {
  const [childToAdd, setChildToAdd] = useState("");

  if (!pigeon) return null;

  const children = pigeons.filter((item) =>
    item.parentIds?.includes(pigeon.id),
  );

  const possibleChildren = pigeons.filter((item) => {
    if (item.id === pigeon.id) return false;
    if (item.parentIds?.includes(pigeon.id)) return false;
    if ((item.parentIds?.length || 0) >= 2) return false;

    // Prevent cycles.
    if (hasDescendant(pigeons, item.id, pigeon.id)) return false;

    return true;
  });

  return (
    <aside className="fixed right-4 top-4 z-50 w-[360px] rounded-xl border-2 border-r-4 bg-white p-5 shadow-md">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500">Editing pigeon</p>
          <h2 className="text-xl font-semibold">{pigeon.name}</h2>
        </div>

        <button
          onClick={onClose}
          className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
        >
          Close
        </button>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input
            value={pigeon.name}
            onChange={(event) =>
              onUpdateField(pigeon.id, "name", event.target.value)
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Birthday</span>
          <input
            value={pigeon.birthday || ""}
            onChange={(event) =>
              onUpdateField(pigeon.id, "birthday", event.target.value)
            }
            placeholder="Unknown"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Status</span>
          <select
            value={pigeon.status}
            onChange={(event) =>
              onUpdateField(pigeon.id, "status", event.target.value)
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="home">home</option>
            <option value="flying">flying</option>
            <option value="lost">lost</option>
          </select>
        </label>

        <div className="rounded-xl border p-3">
          <p className="mb-2 text-sm font-medium">Children</p>

          {children.length > 0 ? (
            <div className="space-y-2">
              {children.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <span>{child.name}</span>

                  <button
                    onClick={() => onRemoveChild(pigeon.id, child.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No children listed.</p>
          )}

          <div className="mt-3 flex gap-2">
            <select
              value={childToAdd}
              onChange={(event) => setChildToAdd(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">Add child...</option>

              {possibleChildren.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <button
              disabled={!childToAdd}
              onClick={() => {
                onAddChild(pigeon.id, childToAdd);
                setChildToAdd("");
              }}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function TopNav({ onCreateBird }) {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home" },
    { href: "/flights", label: "Flights" },
    { href: "/catalog", label: "Catalog" },
  ];

  return (
    <nav className="absolute top-4 left-0 z-10 w-full">
      {/* Centered navbar */}
      <div className="absolute left-1/2 -translate-x-1/2 rounded-lg ring-2 ring-ring border-b-4 bg-white/90 px-2 py-2 shadow-md backdrop-blur transition-all hover:scale-105">
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const active = pathname === link.href;

            if (active) {
              return (
                <span
                  key={link.href}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  {link.label}
                </span>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Button to the right of navbar */}
      <Button
        type="button"
        onClick={onCreateBird}
        className="absolute left-1/2 ml-36 h-[56px] w-[62px] rounded-lg border-0 border-b-4 border-dot bg-white p-0 text-muted-foreground ring-2 ring-ring shadow-md backdrop-blur hover:scale-105 hover:text-primary"
        aria-label="Add new bird"
      >
        <PiBird className="size-6" />
      </Button>

      {/* Button to the left of navbar */}
      <Button
        type="button"
        onClick={onCreateBird}
        className="absolute right-1/2 mr-36 h-[56px] w-[62px] rounded-lg border-0 border-b-4 border-dot bg-white p-0 text-muted-foreground ring-2 ring-ring shadow-md backdrop-blur hover:scale-105 hover:text-primary"
        aria-label="Add new bird"
      >
        <IoSettingsOutline className="size-6" />
      </Button>
    </nav>
  );
}

function NewPigeonDialog({ open, onOpenChange, pigeons, onCreate }) {
  const defaultForm = {
    name: "",
    birthday: "",
    status: "home",
    bandId: "",
    bandColor: "none",
    parentOneId: "",
    parentTwoId: "",
    notes: "",
  };

  const [form, setForm] = useState(defaultForm);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(defaultForm);
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) return;

    const parentIds = [form.parentOneId, form.parentTwoId].filter(Boolean);

    const nextPigeon = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      birthday: form.birthday.trim() || null,
      status: form.status,
      bandId: form.bandId.trim() || null,
      bandColor: form.bandColor || "none",
      parentIds,
      notes: form.notes.trim() || "",
    };

    onCreate(nextPigeon);
    resetForm();
    onOpenChange(false);
  }

  const parentOneOptions = pigeons.filter(
    (pigeon) => pigeon.id !== form.parentTwoId,
  );

  const parentTwoOptions = pigeons.filter(
    (pigeon) => pigeon.id !== form.parentOneId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add new bird</DialogTitle>
          <DialogDescription>
            Add a pigeon to the family graph. Parents are optional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Blue"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Birthday</Label>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.birthday || "Select birthday"}
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      form.birthday
                        ? new Date(
                            Number(form.birthday.slice(6, 10)),
                            Number(form.birthday.slice(0, 2)) - 1,
                            Number(form.birthday.slice(3, 5)),
                          )
                        : undefined
                    }
                    onSelect={(date) => {
                      updateField(
                        "birthday",
                        date ? format(date, "MM-dd-yyyy") : "",
                      );
                    }}
                    captionLayout="dropdown"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Parent 1</Label>
              <Select
                value={form.parentOneId || "none"}
                onValueChange={(value) =>
                  updateField("parentOneId", value === "none" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unknown" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unknown</SelectItem>
                  {parentOneOptions.map((pigeon) => (
                    <SelectItem key={pigeon.id} value={pigeon.id}>
                      {pigeon.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Parent 2</Label>
              <Select
                value={form.parentTwoId || "none"}
                onValueChange={(value) =>
                  updateField("parentTwoId", value === "none" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unknown" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unknown</SelectItem>
                  {parentTwoOptions.map((pigeon) => (
                    <SelectItem key={pigeon.id} value={pigeon.id}>
                      {pigeon.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-band-id">Band ID</Label>
              <Input
                id="new-band-id"
                value={form.bandId}
                onChange={(event) => updateField("bandId", event.target.value)}
                placeholder="Unknown"
              />
            </div>

            <div className="space-y-2">
              <Label>Band color</Label>
              <Select
                value={form.bandColor}
                onValueChange={(value) => updateField("bandColor", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Band color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                  <SelectItem value="blue">Blue</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="yellow">Yellow</SelectItem>
                  <SelectItem value="white">White</SelectItem>
                  <SelectItem value="black">Black</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) => updateField("status", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home">Home</SelectItem>
                <SelectItem value="flying">Flying</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="new-notes">Notes</Label>
            <Textarea
              id="new-notes"
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Random information, medical notes, behavior..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            <Button type="submit">Add bird</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PigeonGraph() {
  const reactFlow = useReactFlow();

  const [pigeons, setPigeons] = useState(mockPigeons);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [hoveredPigeonId, setHoveredPigeonId] = useState(null);
  const [selectedPigeonId, setSelectedPigeonId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const [newPigeonOpen, setNewPigeonOpen] = useState(false);

  const selectedPigeon = useMemo(
    () => pigeons.find((pigeon) => pigeon.id === selectedPigeonId) || null,
    [pigeons, selectedPigeonId],
  );

  const handleHover = useCallback((pigeonId) => {
    setHoveredPigeonId(pigeonId);
  }, []);

  const handleSelect = useCallback((pigeonId) => {
    setSelectedPigeonId(pigeonId);
  }, []);

  const runLayout = useCallback(
    async (nextPigeons, preserveViewport = false) => {
      const viewport = preserveViewport ? reactFlow.getViewport() : null;

      const { nodes: rawNodes, edges: rawEdges } = buildGraphData(nextPigeons, {
        onHover: handleHover,
        onSelect: handleSelect,
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
    [reactFlow, handleHover, handleSelect],
  );

  useEffect(() => {
    runLayout(pigeons, false);
  }, []);

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

  async function createPigeon(nextPigeon) {
    const nextPigeons = [...pigeons, nextPigeon];

    setPigeons(nextPigeons);
    await runLayout(nextPigeons, true);

    setSelectedPigeonId(nextPigeon.id);
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

      <TopNav onCreateBird={() => setNewPigeonOpen(true)} />

      <NewPigeonDialog
        open={newPigeonOpen}
        onOpenChange={setNewPigeonOpen}
        pigeons={pigeons}
        onCreate={createPigeon}
      />

      <PigeonPopup
        pigeon={selectedPigeon}
        position={popupPosition}
        onClose={() => {
          setSelectedPigeonId(null);
          setPopupPosition(null);
        }}
        onChange={updateSelectedPigeon}
      />
    </main>
  );
}

export default function FamilyTreeCanvas() {
  return (
    <ReactFlowProvider>
      <PigeonGraph />
    </ReactFlowProvider>
  );
}
