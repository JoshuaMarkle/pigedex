"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, MapPin, X, Undo2, LocateFixed, Loader2, Search } from "lucide-react";

import { haversineDistance } from "@/lib/flightDb";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Leaflet map loaded client-side only
const MapPicker = dynamic(() => import("@/components/flights/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] rounded-lg bg-muted animate-pulse" />
  ),
});

// ── Default form ──────────────────────────────────────────────────────────────

const defaultForm = {
  flightDate: "",
  locationName: "",
  status: "active",
  notes: "",
  pigeonIds: [],
  setPigeonsFlying: true,  // shown when status is active/planned
  allReturned: true,       // shown when status is completed
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewFlightDialog({
  open,
  onOpenChange,
  homeLocation, // { lat, lng, name } | null  — from coop_settings
  distanceUnit, // "miles" | "km"
  pigeons, // array of pigeon objects for the selector
  onCreate, // (flight) => void
}) {
  const [form, setForm] = useState(defaultForm);
  const [releaseLocation, setReleaseLocation] = useState(null); // { lat, lng }
  const [prevReleaseLocation, setPrevReleaseLocation] = useState(null); // for undo
  const [previewLocation, setPreviewLocation] = useState(null); // address search preview
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const searchDebounceRef = useRef(null);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function togglePigeon(pigeonId) {
    setForm((prev) => ({
      ...prev,
      pigeonIds: prev.pigeonIds.includes(pigeonId)
        ? prev.pigeonIds.filter((id) => id !== pigeonId)
        : [...prev.pigeonIds, pigeonId],
    }));
  }

  function reset() {
    setForm(defaultForm);
    setReleaseLocation(null);
    setPrevReleaseLocation(null);
    setPreviewLocation(null);
    setAddressQuery("");
    setAddressResults([]);
    setShowResults(false);
    setError("");
  }

  function handleAddressInput(e) {
    const q = e.target.value;
    setAddressQuery(q);
    setShowResults(true);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!q.trim()) {
      setAddressResults([]);
      setPreviewLocation(null);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setAddressLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`,
          { headers: { "Accept-Language": "en" } },
        );
        const data = await res.json();
        setAddressResults(data);
      } catch {
        setAddressResults([]);
      } finally {
        setAddressLoading(false);
      }
    }, 400);
  }

  function handleSelectAddress(result) {
    const loc = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    setPreviewLocation({ ...loc, label: result.display_name });
    setAddressQuery(result.display_name.split(",").slice(0, 2).join(",").trim());
    setAddressResults([]);
    setShowResults(false);
  }

  function handleReleaseChange(loc) {
    setPrevReleaseLocation(releaseLocation);
    setReleaseLocation(loc);
  }

  function handleUndoLocation() {
    setReleaseLocation(prevReleaseLocation);
    setPrevReleaseLocation(null);
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        handleReleaseChange(loc);
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.message ?? "Could not get location.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  // Auto-calculate distance when both points are set
  const distance = useMemo(() => {
    if (!homeLocation || !releaseLocation) return null;
    const d = haversineDistance(
      homeLocation.lat,
      homeLocation.lng,
      releaseLocation.lat,
      releaseLocation.lng,
      distanceUnit ?? "miles",
    );
    return Math.round(d * 10) / 10; // 1 decimal place
  }, [homeLocation, releaseLocation, distanceUnit]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.flightDate) return;

    setSaving(true);
    setError("");

    try {
      const isActive = form.status === "active" || form.status === "planned";
      const isCompleted = form.status === "completed";

      await onCreate({
        flightDate: form.flightDate,
        locationName: form.locationName.trim() || null,
        releaseLat: releaseLocation?.lat ?? null,
        releaseLng: releaseLocation?.lng ?? null,
        distance,
        status: form.status,
        notes: form.notes.trim(),
        pigeonIds: form.pigeonIds,
        // Extra flags consumed by handleCreateFlight in the page
        setPigeonsFlying: isActive && form.setPigeonsFlying && form.pigeonIds.length > 0,
        defaultPigeonResult: isCompleted && form.allReturned ? "returned" : "unknown",
      });
      onOpenChange(false);
    } catch (err) {
      setError(err?.message ?? "Failed to create flight.");
    } finally {
      setSaving(false);
    }
  }

  // Coord display helper
  function coordLabel(loc) {
    if (!loc) return "Click map to place";
    const lat = loc.lat.toFixed(4);
    const lng = loc.lng.toFixed(4);
    return `${lat}°, ${lng}°`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log a flight</DialogTitle>
          <DialogDescription>
            Record a release flight. Click the map to set the release location.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date + Status */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Flight date *</Label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.flightDate
                        ? format(
                            new Date(form.flightDate + "T12:00:00"),
                            "MMM d, yyyy",
                          )
                        : "Select date"}
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      form.flightDate
                        ? new Date(form.flightDate + "T12:00:00")
                        : undefined
                    }
                    onSelect={(date) =>
                      updateField(
                        "flightDate",
                        date ? format(date, "yyyy-MM-dd") : "",
                      )
                    }
                    captionLayout="dropdown"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => updateField("status", v)}
              >
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
          </div>

          {/* Location name */}
          <div className="space-y-2">
            <Label htmlFor="flight-location">Release location name</Label>
            <Input
              id="flight-location"
              value={form.locationName}
              onChange={(e) => updateField("locationName", e.target.value)}
              placeholder="e.g. Columbus, OH"
            />
          </div>

          <Separator />

          {/* Map picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Release coordinates
              </Label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={geoLoading}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                >
                  {geoLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <LocateFixed className="h-3 w-3" />
                  )}
                  My location
                </button>
                {prevReleaseLocation !== null && (
                  <button
                    type="button"
                    onClick={handleUndoLocation}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  >
                    <Undo2 className="h-3 w-3" />
                    Undo
                  </button>
                )}
                {releaseLocation && (
                  <button
                    type="button"
                    onClick={() => { setPrevReleaseLocation(releaseLocation); setReleaseLocation(null); }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {coordLabel(releaseLocation)}
              {distance != null && (
                <span className="ml-2 font-medium text-foreground">
                  · {distance} {distanceUnit ?? "miles"} from home
                </span>
              )}
            </p>

            {geoError && (
              <p className="text-xs text-red-500">{geoError}</p>
            )}

            {!homeLocation && (
              <p className="text-xs text-amber-600">
                ⚠ Home location not set — distance calculation unavailable.
              </p>
            )}

            {/* Address search */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={addressQuery}
                  onChange={handleAddressInput}
                  onFocus={() => addressQuery && setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 150)}
                  placeholder="Search address to navigate map…"
                  className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {addressLoading && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
              {showResults && addressResults.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg text-xs max-h-40 overflow-y-auto">
                  {addressResults.map((r) => (
                    <li key={r.place_id}>
                      <button
                        type="button"
                        onMouseDown={() => handleSelectAddress(r)}
                        className="w-full text-left px-3 py-1.5 hover:bg-muted truncate"
                      >
                        {r.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <MapPicker
              homeLocation={homeLocation}
              releaseLocation={releaseLocation}
              onReleaseChange={handleReleaseChange}
              previewLocation={previewLocation}
            />
          </div>

          <Separator />

          {/* Pigeons selector */}
          {pigeons && pigeons.length > 0 && (
            <div className="space-y-2">
              <Label>Pigeons on this flight</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                {pigeons.map((pigeon) => {
                  const checked = form.pigeonIds.includes(pigeon.id);
                  return (
                    <label
                      key={pigeon.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors ${
                        checked ? "bg-primary/8" : "hover:bg-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={checked}
                        onChange={() => togglePigeon(pigeon.id)}
                      />
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={pigeon.imageUrl ?? ""} />
                        <AvatarFallback className="text-[9px]">
                          {(pigeon.name?.[0] ?? "?").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{pigeon.name}</span>
                      {pigeon.bandId && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {pigeon.bandId}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              {form.pigeonIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {form.pigeonIds.length} pigeon
                  {form.pigeonIds.length !== 1 ? "s" : ""} selected
                </p>
              )}

              {/* Status actions for selected pigeons */}
              {form.pigeonIds.length > 0 &&
                (form.status === "active" || form.status === "planned") && (
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={form.setPigeonsFlying}
                      onChange={(e) =>
                        updateField("setPigeonsFlying", e.target.checked)
                      }
                    />
                    <span>
                      Set selected pigeons to{" "}
                      <span className="font-medium">Flying</span>
                    </span>
                  </label>
                )}

              {form.pigeonIds.length > 0 && form.status === "completed" && (
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={form.allReturned}
                    onChange={(e) =>
                      updateField("allReturned", e.target.checked)
                    }
                  />
                  <span>
                    All pigeons{" "}
                    <span className="font-medium">returned successfully</span>
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="flight-notes">Notes</Label>
            <Textarea
              id="flight-notes"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Weather conditions, observations..."
              rows={2}
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
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
            <Button type="submit" disabled={saving || !form.flightDate}>
              {saving ? "Saving…" : "Log flight"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
