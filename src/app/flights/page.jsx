"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  PlaneTakeoff,
  MapPin,
  Loader2,
  Plus,
  ListFilter,
  Pencil,
} from "lucide-react";

import {
  fetchFlightsWithPigeons,
  fetchCoopSettings,
  createFlight,
  deleteFlight,
  updateFlight,
  updateFlightPigeon,
} from "@/lib/flightDb";
import { fetchPigeonsWithParents, updatePigeonInDb } from "@/lib/pigeonDb";
import { getIsCoopAdmin } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import FlightsTopNav from "@/components/flights/FlightsTopNav";
import NewFlightDialog from "@/components/dialogs/NewFlightDialog";
import FlightSettingsDialog from "@/components/dialogs/FlightSettingsDialog";
import EditFlightDialog from "@/components/dialogs/EditFlightDialog";

// Leaflet map — client-side only.
// isolation: isolate on the wrapper scopes Leaflet's high z-indices so they
// don't paint over shadcn dialogs (which portal to <body> with z-index: 50).
const FlightMap = dynamic(() => import("@/components/flights/FlightMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted" />,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL = {
  active: "Active",
  planned: "Planned",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_CLASS = {
  planned: "bg-blue-100 text-blue-700",
  active: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-zinc-100 text-zinc-500",
};

function statusBadge(status) {
  const label = STATUS_LABEL[status] ?? status;
  const cls = STATUS_CLASS[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function formatFlightDate(dateStr) {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Sidebar flight row ────────────────────────────────────────────────────────

function FlightRow({
  flight,
  distanceUnit,
  isActive,
  isAdmin,
  onClick,
  onDelete,
  onEdit,
  pigeons,
}) {
  const returned =
    flight.pigeons?.filter((p) => p.result === "returned").length ?? 0;
  const total = flight.pigeons?.length ?? 0;

  return (
    <div
      className={`border-b last:border-b-0 transition-colors ${isActive ? "bg-blue-50" : "hover:bg-muted/50"}`}
    >
      {/* Main clickable row */}
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left px-4 py-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 shrink-0 text-red-500" />
              <p className="truncate text-sm font-semibold leading-tight">
                {flight.locationName ?? "Unknown location"}
              </p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatFlightDate(flight.flightDate)}
              {flight.distance != null && (
                <>
                  {" "}
                  · {Math.round(flight.distance)} {distanceUnit}
                </>
              )}
            </p>
          </div>
          {statusBadge(flight.status)}
        </div>

        {total > 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {returned}/{total} returned
          </p>
        )}
      </button>

      {/* Expanded detail when active */}
      {isActive && (
        <div className="px-4 pt-2 pb-3 space-y-2 border-t bg-blue-50/60">
          {/* {flight.releaseLat != null && ( */}
          {/*   <p className="text-xs font-mono text-muted-foreground"> */}
          {/*     {flight.releaseLat.toFixed(4)}°, {flight.releaseLng.toFixed(4)}° */}
          {/*   </p> */}
          {/* )} */}

          {flight.pigeons?.length > 0 && (
            <div className="space-y-1">
              {flight.pigeons.map((fp) => {
                const pig = pigeons?.find((p) => p.id === fp.pigeonId);
                const resultColor =
                  fp.result === "returned"
                    ? "text-green-600"
                    : fp.result === "lost"
                      ? "text-red-500"
                      : "text-muted-foreground";
                return (
                  <div
                    key={fp.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span>{pig?.name ?? "Unknown"}</span>
                    <span className={`capitalize ${resultColor}`}>
                      {fp.result}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {flight.notes && (
            <p className="text-xs text-muted-foreground italic">
              {flight.notes}
            </p>
          )}

          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(flight.id);
                }}
              >
                <Pencil className="mr-1 h-3 w-3" />
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(flight.id);
                }}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FlightsPage() {
  const [flights, setFlights] = useState([]);
  const [pigeons, setPigeons] = useState([]);
  const [coopSettings, setCoopSettings] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [activeFlight, setActiveFlight] = useState(null);

  const [flightDialogOpen, setFlightDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editFlightId, setEditFlightId] = useState(null); // id of flight being edited

  // ── Load ──
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setLoadError("");

        const [loadedFlights, loadedPigeons, settings, adminStatus] =
          await Promise.all([
            fetchFlightsWithPigeons(),
            fetchPigeonsWithParents(),
            fetchCoopSettings(),
            getIsCoopAdmin().catch(() => false),
          ]);

        if (!mounted) return;
        setFlights(loadedFlights);
        setPigeons(loadedPigeons);
        setCoopSettings(settings);
        setIsAdmin(adminStatus);

        if (loadedFlights.length > 0) {
          setActiveFlight(loadedFlights[0].id);
        }
      } catch (err) {
        console.error(err);
        if (mounted) setLoadError(err?.message ?? "Failed to load data.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const homeLocation = useMemo(() => {
    if (!coopSettings?.homeLat || !coopSettings?.homeLng) return null;
    return {
      lat: coopSettings.homeLat,
      lng: coopSettings.homeLng,
      name: coopSettings.homeName ?? "Home Coop",
    };
  }, [coopSettings]);

  const distanceUnit = coopSettings?.distanceUnit ?? "miles";

  const visibleFlights = useMemo(() => {
    if (statusFilter === "all") return flights;
    return flights.filter((f) => f.status === statusFilter);
  }, [flights, statusFilter]);

  // ── Handlers ──
  async function handleCreateFlight(flightData) {
    const created = await createFlight(flightData);

    // Optionally set selected pigeons to "flying" in the pigeons table
    if (flightData.setPigeonsFlying && flightData.pigeonIds?.length > 0) {
      await Promise.all(
        flightData.pigeonIds.map((id) =>
          updatePigeonInDb(id, { status: "flying" }),
        ),
      );
      setPigeons((prev) =>
        prev.map((p) =>
          flightData.pigeonIds.includes(p.id) ? { ...p, status: "flying" } : p,
        ),
      );
    }

    setFlights((prev) => [created, ...prev]);
    setActiveFlight(created.id);
  }

  async function handleDeleteFlight(id) {
    if (!confirm("Delete this flight?")) return;
    await deleteFlight(id);
    setFlights((prev) => prev.filter((f) => f.id !== id));
    if (activeFlight === id) setActiveFlight(null);
  }

  async function handleSaveFlight(flightId, flightUpdates, pigeonUpdates) {
    // Persist flight-level changes
    await updateFlight(flightId, flightUpdates);

    // Persist per-pigeon result + returnedAt
    if (pigeonUpdates.length > 0) {
      await Promise.all(
        pigeonUpdates.map((u) =>
          updateFlightPigeon(u.id, {
            result: u.result,
            returnedAt: u.returnedAt,
          }),
        ),
      );
    }

    // Reflect in local state
    setFlights((prev) =>
      prev.map((f) => {
        if (f.id !== flightId) return f;
        return {
          ...f,
          ...flightUpdates,
          pigeons: f.pigeons.map((fp) => {
            const upd = pigeonUpdates.find((u) => u.id === fp.id);
            return upd
              ? { ...fp, result: upd.result, returnedAt: upd.returnedAt }
              : fp;
          }),
        };
      }),
    );
  }

  function handleSettingsSave(newSettings) {
    setCoopSettings(newSettings);
  }

  const editFlight = useMemo(
    () => flights.find((f) => f.id === editFlightId) ?? null,
    [flights, editFlightId],
  );

  return (
    <div className="relative h-screen overflow-hidden">
      {/* ── Full-screen map background ─────────────────────────────────────
          isolation: isolate creates a new stacking context that scopes all
          Leaflet internal z-indices (up to 1000) so they cannot escape and
          paint over dialogs that are portalled to <body> at z-index: 50.  */}
      <div className="absolute inset-0" style={{ isolation: "isolate" }}>
        <FlightMap
          homeLocation={homeLocation}
          flights={visibleFlights}
          activeFlight={activeFlight}
          distanceUnit={distanceUnit}
        />
      </div>

      {/* ── Top nav ── */}
      <FlightsTopNav
        isAdmin={isAdmin}
        onOpenSettings={() => setSettingsDialogOpen(true)}
        onAddFlight={() => setFlightDialogOpen(true)}
      />

      {/* ── Left floating sidebar ─────────────────────────────────────────── */}
      <aside className="absolute left-4 top-4 bottom-4 z-10 flex w-80 flex-col gap-2">
        {/* Flight list */}
        <div className="flex-1 overflow-y-auto rounded-xl bg-white/90 shadow-md ring-2 ring-ring backdrop-blur min-h-0">
          <div className="p-0 px-4 flex row items-center text-sm border-b">
            <ListFilter className="size-3 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-sm border-0 shadow-none focus:ring-0 bg-transparent">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : loadError ? (
            <p className="p-4 text-sm text-red-600">{loadError}</p>
          ) : visibleFlights.length === 0 ? (
            <div className="p-8 text-center">
              <PlaneTakeoff className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {statusFilter === "all"
                  ? "No flights logged yet."
                  : `No ${statusFilter} flights.`}
              </p>
              {isAdmin && statusFilter === "all" && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => setFlightDialogOpen(true)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Log first flight
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {visibleFlights.map((flight) => (
                <FlightRow
                  key={flight.id}
                  flight={flight}
                  distanceUnit={distanceUnit}
                  isActive={flight.id === activeFlight}
                  isAdmin={isAdmin}
                  pigeons={pigeons}
                  onClick={() =>
                    setActiveFlight(
                      flight.id === activeFlight ? null : flight.id,
                    )
                  }
                  onEdit={(id) => setEditFlightId(id)}
                  onDelete={handleDeleteFlight}
                />
              ))}
            </div>
          )}
        </div>
        {/* Home not set warning */}
        {!loading && !homeLocation && (
          <div
            className="shrink-0 cursor-pointer rounded-lg bg-amber-50/90 px-3 py-2 text-xs text-amber-700 shadow ring-2 ring-amber-200 backdrop-blur"
            onClick={() => setSettingsDialogOpen(true)}
          >
            ⚠ Home location not set — click to configure.
          </div>
        )}
      </aside>

      {/* ── Dialogs ── */}
      <NewFlightDialog
        open={flightDialogOpen}
        onOpenChange={setFlightDialogOpen}
        homeLocation={homeLocation}
        distanceUnit={distanceUnit}
        pigeons={pigeons.filter((p) => p.status !== "lost")}
        onCreate={handleCreateFlight}
      />

      <FlightSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        coopSettings={coopSettings}
        isAdmin={isAdmin}
        onSave={handleSettingsSave}
      />

      <EditFlightDialog
        open={editFlightId !== null}
        onOpenChange={(open) => {
          if (!open) setEditFlightId(null);
        }}
        flight={editFlight}
        pigeons={pigeons}
        distanceUnit={distanceUnit}
        onSave={handleSaveFlight}
      />
    </div>
  );
}
