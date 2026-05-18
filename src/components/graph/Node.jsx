import { Handle, Position } from "@xyflow/react";
import { FaDotCircle } from "react-icons/fa";
import { PiBirdBold } from "react-icons/pi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const pigeonWidth = 180;
export const pigeonHeight = 72;
export const unionSize = 16;

// ----- Types ----- //

export const nodeTypes = {
  pigeon: PigeonNode,
  union: UnionNode,
};

// Decide color of node outline
export function getStatusClass(status) {
  if (status === "home") return "ring-green";
  if (status === "flying") return "ring-blue";
  if (status === "lost") return "ring-red";
  return "ring-foreground/10";
}

// ----- Nodes ----- //

// Node for the pigeon
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

// Node for a union
function UnionNode() {
  return (
    <div className="relative h-2 w-2">
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <FaDotCircle className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-edge" />

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
