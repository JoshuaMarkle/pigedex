"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MapPin, LocateFixed, Loader2 } from "lucide-react";

import { upsertCoopSettings } from "@/lib/flightDb";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const HomePickerMap = dynamic(
  () => import("@/components/flights/HomePickerMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] rounded-lg bg-muted animate-pulse" />
    ),
  },
);

// ── Component ─────────────────────────────────────────────────────────────────

export default function FlightSettingsDialog({
  open,
  onOpenChange,
  coopSettings, // { homeName, homeLat, homeLng, distanceUnit } | null
  isAdmin,
  onSave, // (newSettings) => void
}) {
  const [homeName, setHomeName] = useState("Home Coop");
  const [distanceUnit, setDistanceUnit] = useState("miles");
  const [homeLocation, setHomeLocation] = useState(null); // { lat, lng }
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmPending, setConfirmPending] = useState(false);

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHomeLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.message ?? "Could not get location.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  // Sync from props when dialog opens
  useEffect(() => {
    if (!open) return;
    setHomeName(coopSettings?.homeName ?? "Home Coop");
    setDistanceUnit(coopSettings?.distanceUnit ?? "miles");
    setHomeLocation(
      coopSettings?.homeLat && coopSettings?.homeLng
        ? { lat: coopSettings.homeLat, lng: coopSettings.homeLng }
        : null,
    );
    setError("");
    setConfirmPending(false);
  }, [open, coopSettings]);

  function handleSave(e) {
    e.preventDefault();
    if (!isAdmin) return;
    setConfirmPending(true);
  }

  async function handleConfirmSave() {
    setSaving(true);
    setError("");
    try {
      const next = {
        homeName: homeName.trim() || "Home Coop",
        homeLat: homeLocation?.lat ?? null,
        homeLng: homeLocation?.lng ?? null,
        distanceUnit,
      };
      await upsertCoopSettings(next);
      onSave?.(next);
      onOpenChange(false);
    } catch (err) {
      setError(err?.message ?? "Failed to save settings.");
      setConfirmPending(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Coop settings</DialogTitle>
          <DialogDescription>
            Set your home loft location so distances are calculated correctly.
          </DialogDescription>
        </DialogHeader>

        {!isAdmin && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
            You must be signed in as an admin to edit these settings.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <div className="space-y-2">
              <Label htmlFor="home-name">Home loft name</Label>
              <Input
                id="home-name"
                value={homeName}
                onChange={(e) => setHomeName(e.target.value)}
                placeholder="Home Coop"
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2">
              <Label>Distance unit</Label>
              <Select
                value={distanceUnit}
                onValueChange={setDistanceUnit}
                disabled={!isAdmin}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="miles">Miles</SelectItem>
                  <SelectItem value="km">Kilometers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Home loft location
              </Label>
              <div className="flex items-center gap-2">
                {isAdmin && (
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
                )}
                {homeLocation && isAdmin && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setHomeLocation(null)}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {homeLocation
                ? `${homeLocation.lat.toFixed(5)}°, ${homeLocation.lng.toFixed(5)}°`
                : "Not set — click the map to place your home loft."}
            </p>

            {geoError && <p className="text-xs text-red-500">{geoError}</p>}

            <HomePickerMap
              location={homeLocation}
              onChange={isAdmin ? setHomeLocation : undefined}
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {confirmPending ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 space-y-3">
              <p className="text-sm font-semibold text-amber-800">
                Are you sure you want to save these changes?
              </p>
              <p className="text-sm text-amber-700">
                Changing coop settings can break existing flight data and distance calculations. It is not recommended unless you know what you&apos;re doing.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmPending(false)}
                  disabled={saving}
                >
                  Go back
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleConfirmSave}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Yes, save anyway"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                {isAdmin ? "Cancel" : "Close"}
              </Button>
              {isAdmin && (
                <Button type="submit" disabled={saving}>
                  Save settings
                </Button>
              )}
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
