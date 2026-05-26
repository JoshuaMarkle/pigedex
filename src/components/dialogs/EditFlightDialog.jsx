"use client";

import { useEffect, useRef, useState } from "react";

import {
  parseDurationToSeconds,
  formatSecondsAsDuration,
  durationToReturnedAt,
  returnedAtToDurationSeconds,
} from "@/lib/durationUtils";

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditFlightDialog({
  open,
  onOpenChange,
  flight, // { id, flightDate, status, locationName, notes, pigeons: [{id, pigeonId, result, returnedAt}] }
  pigeons, // full pigeon objects (for name lookup)
  distanceUnit,
  onSave, // async (flightId, flightUpdates, pigeonUpdates) => void
}) {
  const [status, setStatus] = useState("active");
  const [locationName, setLocationName] = useState("");
  const [notes, setNotes] = useState("");
  const [pigeonRows, setPigeonRows] = useState([]);
  const [autoCompleted, setAutoCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Prevent auto-complete from firing during initial population
  const allowAutoComplete = useRef(false);

  // ── Initialise from flight ──
  useEffect(() => {
    if (!open || !flight) return;

    allowAutoComplete.current = false;
    setStatus(flight.status ?? "active");
    setLocationName(flight.locationName ?? "");
    setNotes(flight.notes ?? "");
    setAutoCompleted(false);
    setSaveError("");

    const rows = (flight.pigeons ?? []).map((fp) => {
      const durationSec = returnedAtToDurationSeconds(
        flight.flightDate,
        fp.returnedAt,
      );
      return {
        id: fp.id,
        pigeonId: fp.pigeonId,
        result: fp.result ?? "unknown",
        durationStr: durationSec ? formatSecondsAsDuration(durationSec) : "",
      };
    });
    setPigeonRows(rows);

    // Allow auto-complete from next tick onwards
    requestAnimationFrame(() => {
      allowAutoComplete.current = true;
    });
  }, [open, flight]);

  // ── Auto-complete status when all pigeons are resolved ──
  useEffect(() => {
    if (!allowAutoComplete.current) return;
    if (pigeonRows.length === 0) return;

    const allResolved = pigeonRows.every(
      (r) => r.result === "returned" || r.result === "lost",
    );

    setStatus((prev) => {
      if (allResolved && prev !== "completed" && prev !== "cancelled") {
        setAutoCompleted(true);
        return "completed";
      }
      return prev;
    });
  }, [pigeonRows]);

  function updatePigeonRow(id, field, value) {
    setPigeonRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
    // If a result goes back to unknown, dismiss the auto-complete note
    if (field === "result" && value === "unknown") {
      setAutoCompleted(false);
    }
  }

  function handleStatusChange(v) {
    setStatus(v);
    setAutoCompleted(false);
  }

  // ── Save ──
  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");

    try {
      // Validate durations
      for (const row of pigeonRows) {
        const trimmed = row.durationStr.trim();
        if (trimmed && parseDurationToSeconds(trimmed) === null) {
          const pig = pigeons?.find((p) => p.id === row.pigeonId);
          throw new Error(
            `Invalid flight time for ${pig?.name ?? "a pigeon"}: "${trimmed}" — use format like 1h 30m.`,
          );
        }
      }

      const flightUpdates = {
        status,
        locationName: locationName.trim() || null,
        notes: notes.trim(),
      };

      const pigeonUpdates = pigeonRows.map((row) => {
        const durationSec = parseDurationToSeconds(row.durationStr);
        return {
          id: row.id,
          result: row.result,
          returnedAt: durationToReturnedAt(flight.flightDate, durationSec),
        };
      });

      await onSave(flight.id, flightUpdates, pigeonUpdates);
      onOpenChange(false);
    } catch (err) {
      setSaveError(err?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (!flight) return null;

  const resultClass = (result) => {
    if (result === "returned") return "text-green-600";
    if (result === "lost") return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit flight</DialogTitle>
          <DialogDescription>
            Update flight status and individual pigeon results.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Status + Location */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ef-location">Location name</Label>
              <Input
                id="ef-location"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g. Columbus, OH"
              />
            </div>
          </div>

          {autoCompleted && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
              ✓ All pigeons accounted for — status auto-set to{" "}
              <strong>Completed</strong>.
            </div>
          )}

          {/* Pigeon rows */}
          {pigeonRows.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label>Pigeons</Label>
                  <span className="text-xs text-muted-foreground font-mono">
                    name · result · flight time
                  </span>
                </div>

                <div className="rounded-md border divide-y overflow-hidden">
                  {pigeonRows.map((row) => {
                    const pig = pigeons?.find((p) => p.id === row.pigeonId);
                    return (
                      <div
                        key={row.id}
                        className="flex items-center gap-2 px-3 py-2"
                      >
                        {/* Name */}
                        <span
                          className={`w-28 shrink-0 truncate text-sm font-medium ${resultClass(row.result)}`}
                        >
                          {pig?.name ?? "Unknown"}
                        </span>

                        {/* Result */}
                        <Select
                          value={row.result}
                          onValueChange={(v) =>
                            updatePigeonRow(row.id, "result", v)
                          }
                        >
                          <SelectTrigger className="h-8 w-28 shrink-0 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unknown">Unknown</SelectItem>
                            <SelectItem value="returned">Returned</SelectItem>
                            <SelectItem value="lost">Lost</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Flight time */}
                        <Input
                          className="h-8 min-w-0 flex-1 font-mono text-xs"
                          value={row.durationStr}
                          onChange={(e) =>
                            updatePigeonRow(
                              row.id,
                              "durationStr",
                              e.target.value,
                            )
                          }
                          placeholder="1h 30m"
                          title="Flight time — format: 1d 2h 30m 15s"
                          disabled={row.result === "unknown"}
                        />
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground">
                  Flight time format:{" "}
                  <span className="font-mono">1d 2h 30m 15s</span>
                </p>
              </div>
            </>
          )}

          <Separator />

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="ef-notes">Notes</Label>
            <Textarea
              id="ef-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Weather conditions, observations…"
              rows={2}
            />
          </div>

          {saveError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {saveError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
