import { useEffect, useState } from "react";

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
import { Separator } from "@/components/ui/separator";

import { hasDescendant } from "@/lib/graph/graphData";

// ----- Popup ----- //

export default function PigeonPopup({
  pigeon,
  pigeons,
  position,
  onClose,
  onUpdateField,
  onUpdateParents,
  isAdmin,
}) {
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (pigeon) {
      setDraft(pigeon);
    }
  }, [pigeon]);

  if (!pigeon || !position || !draft) return null;

  function updateDraft(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function saveField(field) {
    if (draft[field] === pigeon[field]) return;
    onUpdateField(pigeon.id, field, draft[field]);
  }

  const parentIds = draft.parentIds || [];
  const parentOneId = parentIds[0] || "";
  const parentTwoId = parentIds[1] || "";

  function getPigeonNameById(id) {
    return pigeons.find((item) => item.id === id)?.name || "Unknown";
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

    const cleanedParentIds = [...new Set(nextParentIds.filter(Boolean))];

    setDraft((current) => ({
      ...current,
      parentIds: cleanedParentIds,
    }));

    onUpdateParents(pigeon.id, cleanedParentIds);
  }

  const parentOneOptions = pigeons.filter(
    (item) => item.id !== pigeon.id && item.id !== parentTwoId,
  );

  const parentTwoOptions = pigeons.filter(
    (item) => item.id !== pigeon.id && item.id !== parentOneId,
  );

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
          <CardTitle className="text-base">
            {draft.name || "Unnamed bird"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {draft.bandId || "Unbanded"}
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
            value={draft.name || ""}
            disabled={!isAdmin}
            onChange={(event) => updateDraft("name", event.target.value)}
            onBlur={() => saveField("name")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pigeon-birthday">Birthday</Label>
          <Input
            id="pigeon-birthday"
            value={draft.birthday || ""}
            placeholder="Unknown"
            disabled={!isAdmin}
            onChange={(event) => updateDraft("birthday", event.target.value)}
            onBlur={() => saveField("birthday")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Parent 1</Label>

            <Select
              value={parentOneId || "none"}
              disabled={!isAdmin}
              onValueChange={(value) => updateParentAtIndex(0, value)}
            >
              <SelectTrigger>
                <SelectValue>
                  {parentOneId ? getPigeonNameById(parentOneId) : "Unknown"}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="none">Unknown</SelectItem>

                {parentOneOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <div className="flex flex-col">
                      <span>{item.name}</span>
                      {/* {item.bandId ? ( */}
                      {/*   <span className="text-xs text-muted-foreground"> */}
                      {/*     {item.bandId} */}
                      {/*   </span> */}
                      {/* ) : null} */}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Parent 2</Label>

            <Select
              value={parentTwoId || "none"}
              disabled={!isAdmin}
              onValueChange={(value) => updateParentAtIndex(1, value)}
            >
              <SelectTrigger>
                <SelectValue>
                  {parentTwoId ? getPigeonNameById(parentTwoId) : "Unknown"}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="none">Unknown</SelectItem>

                {parentTwoOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <div className="flex flex-col">
                      <span>{item.name}</span>
                      {/* {item.bandId ? ( */}
                      {/*   <span className="text-xs text-muted-foreground"> */}
                      {/*     {item.bandId} */}
                      {/*   </span> */}
                      {/* ) : null} */}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={draft.status || "home"}
            disabled={!isAdmin}
            onValueChange={(status) => {
              updateDraft("status", status);
              onUpdateField(pigeon.id, "status", status);
            }}
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
            value={draft.notes || ""}
            disabled={!isAdmin}
            placeholder="Medical notes, description, behavior..."
            onChange={(event) => updateDraft("notes", event.target.value)}
            onBlur={() => saveField("notes")}
          />
        </div>
      </CardContent>
    </Card>
  );
}
