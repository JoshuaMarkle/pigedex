"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, CircleHelp, Home, MapPinXInside } from "lucide-react";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

// ── Status icon helper ────────────────────────────────────────────────────────

function StatusIcon({ result, className = "h-4 w-4" }) {
  if (result === "returned") return <Home className={`${className} text-green-600`} />;
  if (result === "lost") return <MapPinXInside className={`${className} text-red-500`} />;
  return <CircleHelp className={`${className} text-muted-foreground`} />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditFlightDialog({
  open,
  onOpenChange,
  flight, // { id, flightDate, status, locationName, notes, pigeons: [{id, pigeonId, result, returnedAt}] }
  pigeons, // full pigeon objects (for name lookup)
  flights, // all flights — used to sort the add-pigeon dropdown by most recent flight
  distanceUnit,
  onSave, // async (flightId, flightUpdates, pigeonUpdates, { addPigeonIds, removePigeonIds }) => void
}) {
  const [status, setStatus] = useState("active");
  const [locationName, setLocationName] = useState("");
  const [notes, setNotes] = useState("");
  // Existing pigeon rows (from DB)
  const [pigeonRows, setPigeonRows] = useState([]);
  // IDs of flight_pigeons to remove
  const [removedIds, setRemovedIds] = useState([]);
  // Pigeon IDs newly added in this edit session (not yet in DB)
  const [addedPigeonIds, setAddedPigeonIds] = useState([]);
  // Currently selected pigeon in the "add" dropdown
  const [addPickerId, setAddPickerId] = useState("");

  const [autoCompleted, setAutoCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Mobile time-entry popup state
  const [mobileTimeEdit, setMobileTimeEdit] = useState(null); // rowId | null
  const [mobileTimeDraft, setMobileTimeDraft] = useState("");
  const mobileTimeRowIdRef = useRef(null);

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
    setRemovedIds([]);
    setAddedPigeonIds([]);
    setAddPickerId("");

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

    requestAnimationFrame(() => {
      allowAutoComplete.current = true;
    });
  }, [open, flight]);

  // ── Auto-complete status when all pigeons are resolved ──
  useEffect(() => {
    if (!allowAutoComplete.current) return;
    const activeExisting = pigeonRows.filter((r) => !removedIds.includes(r.id));
    const total = activeExisting.length + addedPigeonIds.length;
    if (total === 0) return;

    // Newly-added pigeons default to "unknown", so won't trigger auto-complete
    const allResolved = activeExisting.every(
      (r) => r.result === "returned" || r.result === "lost",
    ) && addedPigeonIds.length === 0;

    setStatus((prev) => {
      if (allResolved && prev !== "completed" && prev !== "cancelled") {
        setAutoCompleted(true);
        return "completed";
      }
      return prev;
    });
  }, [pigeonRows, removedIds, addedPigeonIds]);

  function updatePigeonRow(id, field, value) {
    setPigeonRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
    if (field === "result" && value === "unknown") {
      setAutoCompleted(false);
    }
  }

  function handleStatusChange(v) {
    setStatus(v);
    setAutoCompleted(false);
  }

  function handleRemoveExisting(fpId) {
    setRemovedIds((prev) => [...prev, fpId]);
    setAutoCompleted(false);
  }

  function handleRemoveAdded(pigeonId) {
    setAddedPigeonIds((prev) => prev.filter((id) => id !== pigeonId));
    setAutoCompleted(false);
  }

  function handleAddPigeon() {
    if (!addPickerId) return;
    if (addedPigeonIds.includes(addPickerId)) return;
    setAddedPigeonIds((prev) => [...prev, addPickerId]);
    setAddPickerId("");
    setAutoCompleted(false);
  }

  // ── Mobile time popup ──
  function openMobileTime(row) {
    mobileTimeRowIdRef.current = row.id;
    setMobileTimeEdit(row.id);
    setMobileTimeDraft(row.durationStr);
  }

  function applyMobileTimeDraft(rowId, draft) {
    const trimmed = draft.trim();
    if (!trimmed || parseDurationToSeconds(trimmed) !== null) {
      updatePigeonRow(rowId, "durationStr", draft);
    }
  }

  function handleDoneMobileTime() {
    applyMobileTimeDraft(mobileTimeRowIdRef.current, mobileTimeDraft);
    mobileTimeRowIdRef.current = null;
    setMobileTimeEdit(null);
  }

  function handleMobileTimeOpenChange(open) {
    if (!open && mobileTimeRowIdRef.current !== null) {
      applyMobileTimeDraft(mobileTimeRowIdRef.current, mobileTimeDraft);
      mobileTimeRowIdRef.current = null;
      setMobileTimeEdit(null);
    }
  }

  // ── Save ──
  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");

    try {
      const activeRows = pigeonRows.filter((r) => !removedIds.includes(r.id));

      for (const row of activeRows) {
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

      const pigeonUpdates = activeRows.map((row) => {
        const durationSec = parseDurationToSeconds(row.durationStr);
        return {
          id: row.id,
          result: row.result,
          returnedAt: durationToReturnedAt(flight.flightDate, durationSec),
        };
      });

      await onSave(flight.id, flightUpdates, pigeonUpdates, {
        addPigeonIds: addedPigeonIds,
        removePigeonIds: removedIds,
      });
      onOpenChange(false);
    } catch (err) {
      setSaveError(err?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  // Real-time duration validation
  const invalidRowIds = useMemo(() => {
    const ids = new Set();
    for (const row of pigeonRows) {
      if (removedIds.includes(row.id)) continue;
      if (row.result === "unknown") continue;
      const trimmed = row.durationStr.trim();
      if (trimmed && parseDurationToSeconds(trimmed) === null) ids.add(row.id);
    }
    return ids;
  }, [pigeonRows, removedIds]);

  // Latest flight date per pigeon (for sorting the add-pigeon dropdown)
  const latestFlightDate = useMemo(() => {
    const map = {};
    for (const f of flights ?? []) {
      for (const fp of f.pigeons ?? []) {
        if (!map[fp.pigeonId] || f.flightDate > map[fp.pigeonId])
          map[fp.pigeonId] = f.flightDate;
      }
    }
    return map;
  }, [flights]);

  if (!flight) return null;

  const resultClass = (result) => {
    if (result === "returned") return "text-green-600";
    if (result === "lost") return "text-red-500";
    return "text-muted-foreground";
  };

  // Pigeon IDs currently on this flight (existing not-removed + newly added)
  const activePigeonIds = new Set([
    ...pigeonRows
      .filter((r) => !removedIds.includes(r.id))
      .map((r) => r.pigeonId),
    ...addedPigeonIds,
  ]);

  // Pigeons available to add — exclude lost birds and those already on flight,
  // then sort by most recent flight date (most recently flown first)
  const availableToAdd = (pigeons ?? [])
    .filter((p) => !activePigeonIds.has(p.id) && p.status !== "lost")
    .sort((a, b) => {
      const dateA = latestFlightDate[a.id] ?? null;
      const dateB = latestFlightDate[b.id] ?? null;
      if (dateA !== dateB) {
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.localeCompare(dateA);
      }
      return (a.name ?? "").localeCompare(b.name ?? "");
    });

  const activeRowCount =
    pigeonRows.filter((r) => !removedIds.includes(r.id)).length +
    addedPigeonIds.length;

  const mobileTimeRow = mobileTimeEdit ? pigeonRows.find((r) => r.id === mobileTimeEdit) : null;
  const mobileTimePig = mobileTimeRow ? pigeons?.find((p) => p.id === mobileTimeRow.pigeonId) : null;
  const draftInvalid =
    mobileTimeDraft.trim() !== "" &&
    parseDurationToSeconds(mobileTimeDraft.trim()) === null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit flight</DialogTitle>
          <DialogDescription>
            Update flight status, pigeon results, and participating birds.
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
          <Separator />
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>Pigeons</Label>
              <span className="text-xs text-muted-foreground font-mono">
                name · result · flight time
              </span>
            </div>

            {activeRowCount > 0 ? (
              <div className="rounded-md border divide-y overflow-hidden">
                {/* Existing rows */}
                {pigeonRows
                  .filter((r) => !removedIds.includes(r.id))
                  .map((row) => {
                    const pig = pigeons?.find((p) => p.id === row.pigeonId);
                    return (
                      <div
                        key={row.id}
                        className="flex items-center gap-2 px-3 py-2"
                      >
                        {/* Name — fixed width on desktop, flexible on mobile */}
                        <span
                          className={`flex-1 sm:flex-none sm:w-24 min-w-0 shrink-0 truncate text-sm font-medium ${resultClass(row.result)}`}
                        >
                          {pig?.name ?? "Unknown"}
                        </span>

                        {/* MOBILE: icon button that opens a status popover */}
                        <div className="sm:hidden shrink-0">
                          <Popover>
                            <PopoverTrigger
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background hover:bg-muted transition-colors"
                              title="Change status"
                            >
                              <StatusIcon result={row.result} />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-1" align="start">
                              <div className="flex flex-col gap-0.5">
                                {["unknown", "returned", "lost"].map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => updatePigeonRow(row.id, "result", opt)}
                                    className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-muted text-left capitalize ${row.result === opt ? "bg-muted font-medium" : ""}`}
                                  >
                                    <StatusIcon result={opt} />
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* DESKTOP: Select dropdown */}
                        <div className="hidden sm:block shrink-0">
                          <Select
                            value={row.result}
                            onValueChange={(v) => updatePigeonRow(row.id, "result", v)}
                          >
                            <SelectTrigger className="h-8 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unknown">Unknown</SelectItem>
                              <SelectItem value="returned">Returned</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* MOBILE: duration button that opens the centered time popup */}
                        <button
                          type="button"
                          className={`sm:hidden shrink-0 h-8 w-20 rounded-md border px-2 text-left text-xs font-mono transition-colors
                            ${row.result === "unknown" ? "cursor-not-allowed border-input bg-muted opacity-50" : "border-input bg-background hover:bg-muted"}
                            ${invalidRowIds.has(row.id) ? "border-red-500" : ""}
                          `}
                          disabled={row.result === "unknown"}
                          onClick={() => openMobileTime(row)}
                          title="Edit flight time"
                        >
                          {row.durationStr || <span className="text-muted-foreground">—</span>}
                        </button>

                        {/* DESKTOP: inline Input */}
                        <Input
                          className={`hidden sm:block h-8 min-w-0 flex-1 font-mono text-xs ${invalidRowIds.has(row.id) ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                          value={row.durationStr}
                          onChange={(e) => updatePigeonRow(row.id, "durationStr", e.target.value)}
                          placeholder="1h 30m"
                          title="Flight time — format: 1d 2h 30m 15s"
                          disabled={row.result === "unknown"}
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveExisting(row.id)}
                          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove from flight"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}

                {/* Newly added rows */}
                {addedPigeonIds.map((pigeonId) => {
                  const pig = pigeons?.find((p) => p.id === pigeonId);
                  return (
                    <div
                      key={pigeonId}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-50/40"
                    >
                      <span className="w-24 shrink-0 truncate text-sm font-medium text-muted-foreground">
                        {pig?.name ?? "Unknown"}
                      </span>
                      <span className="w-28 shrink-0 text-xs text-muted-foreground italic">
                        Will be added
                      </span>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() => handleRemoveAdded(pigeonId)}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                        title="Cancel add"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No pigeons on this flight.
              </p>
            )}

            {invalidRowIds.size > 0 ? (
              <p className="text-xs text-red-600">
                Invalid flight time — use format:{" "}
                <span className="font-mono">1d 2h 30m 15s</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Flight time format:{" "}
                <span className="font-mono">1d 2h 30m 15s</span>
              </p>
            )}

            {/* Add pigeon */}
            {availableToAdd.length > 0 && (
              <div className="flex items-center gap-2">
                <Select value={addPickerId} onValueChange={setAddPickerId}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Add a pigeon…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableToAdd.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.bandId ? ` · ${p.bandId}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs shrink-0"
                  disabled={!addPickerId}
                  onClick={handleAddPigeon}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            )}
          </div>

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
            <Button type="submit" disabled={saving || invalidRowIds.size > 0}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>

    </Dialog>

    {/* Mobile flight-time entry — portal to body to avoid nested-dialog issues */}
    {mobileTimeEdit !== null && typeof document !== "undefined" && createPortal(
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[200] bg-black/30"
          onClick={() => {
            applyMobileTimeDraft(mobileTimeRowIdRef.current, mobileTimeDraft);
            mobileTimeRowIdRef.current = null;
            setMobileTimeEdit(null);
          }}
        />
        {/* Centered panel */}
        <div className="fixed left-1/2 top-1/2 z-[201] w-[calc(100%-2rem)] max-w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-popover p-4 shadow-xl ring-2 ring-ring">
          <div className="mb-3">
            <p className="font-medium text-sm leading-tight">
              {mobileTimePig?.name ?? "Flight"} — time
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Format: <span className="font-mono">1d 2h 30m 15s</span>
            </p>
          </div>
          <Input
            className={`font-mono ${draftInvalid ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            value={mobileTimeDraft}
            onChange={(e) => setMobileTimeDraft(e.target.value)}
            placeholder="e.g. 1h 30m"
            autoFocus
          />
          {draftInvalid && (
            <p className="mt-1 text-xs text-red-600">
              Invalid — use <span className="font-mono">1d 2h 30m 15s</span>
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              disabled={draftInvalid}
              onClick={handleDoneMobileTime}
            >
              Done
            </Button>
          </div>
        </div>
      </>,
      document.body,
    )}
    </>
  );
}
