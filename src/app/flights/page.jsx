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
  Map,
} from "lucide-react";

import {
  fetchFlightsWithPigeons,
  fetchCoopSettings,
  createFlight,
  deleteFlight,
  updateFlight,
  updateFlightPigeon,
  addPigeonToFlight,
  removePigeonFromFlight,
} from "@/lib/flightDb";
import { fetchPigeonsWithParents, updatePigeonInDb } from "@/lib/pigeonDb";
import {
  returnedAtToDurationSeconds,
  formatSecondsAsDuration,
} from "@/lib/durationUtils";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import TopNav from "@/components/TopNav";
import NewFlightDialog from "@/components/dialogs/NewFlightDialog";
import EditFlightDialog from "@/components/dialogs/EditFlightDialog";

// Leaflet map — client-side only.
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
                const durationSec = returnedAtToDurationSeconds(
                  flight.flightDate,
                  fp.returnedAt,
                );
                const durationStr = durationSec
                  ? formatSecondsAsDuration(durationSec)
                  : null;
                return (
                  <div
                    key={fp.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span>{pig?.name ?? "Unknown"}</span>
                    <div className="flex items-center gap-2">
                      {durationStr && (
                        <span className="text-muted-foreground font-mono">
                          {durationStr}
                        </span>
                      )}
                      <span className={`capitalize ${resultColor}`}>
                        {fp.result}
                      </span>
                    </div>
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

// ── Shared flight list panel ──────────────────────────────────────────────────

function FlightListPanel({
  loading,
  loadError,
  visibleFlights,
  statusFilter,
  setStatusFilter,
  activeFlight,
  setActiveFlight,
  isAdmin,
  pigeons,
  distanceUnit,
  onEdit,
  onDelete,
  onAddFlight,
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between gap-2 border-b shrink-0">
        <div className="flex flex-1 items-center gap-2">
          <span className="font-semibold text-sm">Flights</span>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddFlight}
              className="text-muted-foreground hover:text-primary transition-colors"
              title="Log a flight"
            >
              <Plus className="size-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs border-0 shadow-none focus:ring-0 bg-transparent w-[100px] pr-0 *:data-[slot=select-value]:justify-end">
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
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
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
              <Button size="sm" className="mt-3" onClick={onAddFlight}>
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
                  setActiveFlight(flight.id === activeFlight ? null : flight.id)
                }
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FlightsPage() {
  const [flights, setFlights] = useState([]);
  const [pigeons, setPigeons] = useState([]);
  const [coopSettings, setCoopSettings] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null); // null = unknown, false = not admin, true = admin

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [activeFlight, setActiveFlight] = useState(null);

  const [flightDialogOpen, setFlightDialogOpen] = useState(false);
  const [editFlightId, setEditFlightId] = useState(null);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState("flights");

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 768);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Load ──
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setLoadError("");

        const [loadedFlights, loadedPigeons, settings] = await Promise.all([
          fetchFlightsWithPigeons(),
          fetchPigeonsWithParents(),
          fetchCoopSettings(),
        ]);

        if (!mounted) return;
        setFlights(loadedFlights);
        setPigeons(loadedPigeons);
        setCoopSettings(settings);

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

  async function handleSaveFlight(
    flightId,
    flightUpdates,
    pigeonUpdates,
    { addPigeonIds = [], removePigeonIds = [] } = {},
  ) {
    await updateFlight(flightId, flightUpdates);

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

    await Promise.all(removePigeonIds.map(removePigeonFromFlight));

    const newPigeons = await Promise.all(
      addPigeonIds.map((pigeonId) => addPigeonToFlight(flightId, pigeonId)),
    );

    setFlights((prev) =>
      prev.map((f) => {
        if (f.id !== flightId) return f;
        const updatedExisting = f.pigeons
          .filter((fp) => !removePigeonIds.includes(fp.id))
          .map((fp) => {
            const upd = pigeonUpdates.find((u) => u.id === fp.id);
            return upd
              ? { ...fp, result: upd.result, returnedAt: upd.returnedAt }
              : fp;
          });
        return {
          ...f,
          ...flightUpdates,
          pigeons: [...updatedExisting, ...newPigeons],
        };
      }),
    );
  }

  const editFlight = useMemo(
    () => flights.find((f) => f.id === editFlightId) ?? null,
    [flights, editFlightId],
  );

  // Shared props for dialogs
  const dialogs = (
    <>
      <NewFlightDialog
        open={flightDialogOpen}
        onOpenChange={setFlightDialogOpen}
        homeLocation={homeLocation}
        distanceUnit={distanceUnit}
        pigeons={pigeons.filter((p) => p.status !== "lost")}
        onCreate={handleCreateFlight}
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
    </>
  );

  // Shared list panel props
  const listPanelProps = {
    loading,
    loadError,
    visibleFlights,
    statusFilter,
    setStatusFilter,
    activeFlight,
    setActiveFlight,
    isAdmin,
    pigeons,
    distanceUnit,
    onEdit: (id) => setEditFlightId(id),
    onDelete: handleDeleteFlight,
    onAddFlight: () => setFlightDialogOpen(true),
  };

  // ── Mobile layout ──
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <TopNav
          onAdd={() => setFlightDialogOpen(true)}
          onAdminChange={setIsAdmin}
          onSettingsChange={setCoopSettings}
        />

        {/* Tab bar */}
        <div className="absolute top-[74px] left-0 right-0 z-10 flex border-b bg-white/95 backdrop-blur shrink-0">
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "flights"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab("flights")}
          >
            <PlaneTakeoff className="size-4" />
            Flights
          </button>
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "map"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab("map")}
          >
            <Map className="size-4" />
            Map
          </button>
        </div>

        {/* Content area — offset for nav + tab bar */}
        <div className="absolute inset-0 top-[116px]">
          {activeTab === "flights" ? (
            <div className="h-full bg-white overflow-hidden">
              <FlightListPanel {...listPanelProps} />
            </div>
          ) : (
            <div className="h-full" style={{ isolation: "isolate" }}>
              <FlightMap
                homeLocation={homeLocation}
                flights={visibleFlights}
                activeFlight={activeFlight}
                distanceUnit={distanceUnit}
              />
            </div>
          )}
        </div>

        {/* Home not set warning (mobile flights tab) */}
        {!loading && !homeLocation && activeTab === "flights" && (
          <div
            className="absolute bottom-4 left-4 right-4 z-20 cursor-pointer rounded-lg bg-amber-50/90 px-3 py-2 text-xs text-amber-700 shadow ring-2 ring-amber-200 backdrop-blur"
            onClick={() => setSettingsDialogOpen(true)}
          >
            ⚠ Home location not set — click to configure.
          </div>
        )}

        {dialogs}
      </div>
    );
  }

  // ── Desktop layout ──
  return (
    <div className="relative h-screen overflow-hidden">
      {/* Full-screen map background */}
      <div className="absolute inset-0" style={{ isolation: "isolate" }}>
        <FlightMap
          homeLocation={homeLocation}
          flights={visibleFlights}
          activeFlight={activeFlight}
          distanceUnit={distanceUnit}
        />
      </div>

      {/* Top nav */}
      <TopNav
        onAdd={() => setFlightDialogOpen(true)}
        onAdminChange={setIsAdmin}
        onSettingsChange={setCoopSettings}
      />

      {/* Left floating sidebar */}
      <aside className="absolute left-4 top-4 bottom-4 z-10 flex w-80 flex-col gap-2">
        <div className="flex-1 overflow-hidden rounded-xl bg-white/90 shadow-md ring-2 ring-ring backdrop-blur min-h-0">
          <FlightListPanel {...listPanelProps} />
        </div>

        {/* Home not set warning */}
        {!loading && !homeLocation && (
          <div className="shrink-0 rounded-lg bg-amber-50/90 px-3 py-2 text-xs text-amber-700 shadow ring-2 ring-amber-200 backdrop-blur">
            ⚠ Home location not set — use the ⚙ button above to configure.
          </div>
        )}
      </aside>

      {dialogs}
    </div>
  );
}
