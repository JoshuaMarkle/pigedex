import { useState } from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { hasDescendant } from "@/lib/graph/graphData";

const BAND_COLOR_HEX = {
  red: "#eb5539",
  blue: "#1e96eb",
  green: "#0fca88",
  yellow: "#f59e0b",
  orange: "#f59e0b",
  purple: "#7a61f9",
  white: "#f1f5f9",
  black: "#1e293b",
};

function parseBirthday(value) {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [month, day, year] = parts.map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getAgeLabel(birthday) {
  const birthDate = parseBirthday(birthday);
  if (!birthDate) return "Unknown";

  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.max(0, Math.floor((new Date() - birthDate) / msPerDay));

  if (days < 14) return `${days} ${days === 1 ? "day" : "days"}`;
  if (days < 56) {
    const weeks = Math.floor(days / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  }
  if (days < 366) {
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? "month" : "months"}`;
  }
  const years = Math.floor(days / 365);
  const rem = Math.floor((days % 365) / 30);
  if (rem <= 0) return `${years} ${years === 1 ? "year" : "years"}`;
  return `${years} ${years === 1 ? "year" : "years"} ${rem} ${rem === 1 ? "month" : "months"}`;
}

export default function PigeonPopup(props) {
  if (!props.pigeon || !props.position) return null;
  return <PigeonPopupContent key={props.pigeon.id} {...props} />;
}

function PigeonPopupContent({
  pigeon,
  pigeons,
  position,
  onClose,
  onUpdateField,
  onUpdateParents,
  isAdmin,
}) {
  const [draft, setDraft] = useState(pigeon);

  const parentIds = draft.parentIds || [];
  const parentOneId = parentIds[0] || "";
  const parentTwoId = parentIds[1] || "";

  function getPigeonNameById(id) {
    return pigeons.find((p) => p.id === id)?.name || "Unknown";
  }

  function wouldCreateCycle(parentId) {
    if (!parentId) return false;
    return hasDescendant(pigeons, pigeon.id, parentId);
  }

  function updateParentAtIndex(index, value) {
    const nextValue = value === "none" ? "" : value;
    if (nextValue && wouldCreateCycle(nextValue)) {
      alert("That parent would create a family tree loop.");
      return;
    }
    const nextParentIds = [...parentIds];
    if (nextValue) {
      nextParentIds[index] = nextValue;
    } else {
      nextParentIds.splice(index, 1);
    }
    const cleaned = [...new Set(nextParentIds.filter(Boolean))];
    setDraft((prev) => ({ ...prev, parentIds: cleaned }));
    onUpdateParents(pigeon.id, cleaned);
  }

  const parentOneOptions = pigeons.filter(
    (p) => p.id !== pigeon.id && p.id !== parentTwoId,
  );
  const parentTwoOptions = pigeons.filter(
    (p) => p.id !== pigeon.id && p.id !== parentOneId,
  );

  const bandHex =
    pigeon.bandColor && pigeon.bandColor !== "none"
      ? (BAND_COLOR_HEX[pigeon.bandColor] ?? null)
      : null;

  return (
    <Card
      className="absolute z-5 w-[300px] shadow-xl"
      style={{ left: position.x, top: position.y }}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="min-w-0 flex-1 pr-2">
          <CardTitle className="text-base leading-tight">
            {pigeon.name || "Unnamed bird"}
          </CardTitle>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {bandHex && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: bandHex }}
              />
            )}
            <span>{pigeon.bandId || "Unbanded"}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Link href={`/pigeons/${pigeon.id}`}>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Age + Status */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="mb-1.5 font-medium">Age</p>
            <p className="text-sm">{getAgeLabel(pigeon.birthday)}</p>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label>Status</Label>
            <Select
              value={draft.status || "home"}
              disabled={!isAdmin}
              onValueChange={(status) => {
                setDraft((prev) => ({ ...prev, status }));
                onUpdateField(pigeon.id, "status", status);
              }}
            >
              <SelectTrigger className="w-full h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home">Home</SelectItem>
                <SelectItem value="flying">Flying</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Parents */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Parent 1</Label>
            <Select
              value={parentOneId || "none"}
              disabled={!isAdmin}
              onValueChange={(v) => updateParentAtIndex(0, v)}
            >
              <SelectTrigger className="w-full h-8">
                <SelectValue>
                  {parentOneId ? getPigeonNameById(parentOneId) : "Unknown"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="capitalize">
                <SelectItem value="none">Unknown</SelectItem>
                {parentOneOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Parent 2</Label>
            <Select
              value={parentTwoId || "none"}
              disabled={!isAdmin}
              onValueChange={(v) => updateParentAtIndex(1, v)}
            >
              <SelectTrigger className="w-full h-8">
                <SelectValue>
                  {parentTwoId ? getPigeonNameById(parentTwoId) : "Unknown"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="capitalize">
                <SelectItem value="none">Unknown</SelectItem>
                {parentTwoOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Notes */}
        {pigeon.notes && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {pigeon.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
