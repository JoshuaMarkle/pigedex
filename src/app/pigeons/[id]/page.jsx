"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  CalendarIcon,
  Save,
  Archive,
  Loader2,
  ImageIcon,
  MapPin,
  PlaneTakeoff,
} from "lucide-react";
import { PiBirdBold } from "react-icons/pi";

import {
  fetchPigeonsWithParents,
  updatePigeonInDb,
  setPigeonParentsInDb,
  archivePigeonInDb,
} from "@/lib/pigeonDb";
import { fetchFlightsWithPigeons, fetchCoopSettings } from "@/lib/flightDb";
import {
  formatSecondsAsDuration,
  returnedAtToDurationSeconds,
} from "@/lib/durationUtils";
import { getIsCoopAdmin } from "@/lib/auth";

import SimpleTopNav from "@/components/SimpleTopNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL = {
  home: "Home",
  flying: "Flying",
  lost: "Lost",
};

const STATUS_CLASS = {
  home: "bg-green-100 text-green-800",
  flying: "bg-blue-100 text-blue-800",
  lost: "bg-red-100 text-red-800",
};

const RESULT_CLASS = {
  returned: "text-green-600",
  lost: "text-red-500",
  unknown: "text-muted-foreground",
};

function formatBirthdayLabel(value) {
  if (!value) return "Unknown";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  const [month, day, year] = parts.map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PigeonDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();

  const [pigeon, setPigeon] = useState(null);
  const [allPigeons, setAllPigeons] = useState([]);
  const [flights, setFlights] = useState([]);
  const [distanceUnit, setDistanceUnit] = useState("miles");
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Editable form (mirrors the pigeon's editable fields)
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  // ── Load ──
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setLoadError("");

        const [loadedPigeons, loadedFlights, settings, adminStatus] =
          await Promise.all([
            fetchPigeonsWithParents(),
            fetchFlightsWithPigeons().catch(() => []),
            fetchCoopSettings().catch(() => null),
            getIsCoopAdmin().catch(() => false),
          ]);

        if (!mounted) return;

        const found = loadedPigeons.find((p) => p.id === id);
        if (!found) {
          setLoadError("Pigeon not found.");
          return;
        }

        setPigeon(found);
        setAllPigeons(loadedPigeons);
        setFlights(loadedFlights);
        setDistanceUnit(settings?.distanceUnit ?? "miles");
        setIsAdmin(adminStatus);

        // Seed form from loaded pigeon
        setForm({
          name: found.name ?? "",
          birthday: found.birthday ?? "",
          status: found.status ?? "home",
          sex: found.sex ?? "unknown",
          bandId: found.bandId ?? "",
          bandColor: found.bandColor ?? "none",
          notes: found.notes ?? "",
          parentOneId: found.parentIds?.[0] ?? "",
          parentTwoId: found.parentIds?.[1] ?? "",
        });
      } catch (err) {
        if (mounted) setLoadError(err?.message ?? "Failed to load pigeon.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Other pigeons available as parents
  const otherPigeons = useMemo(
    () => allPigeons.filter((p) => p.id !== id),
    [allPigeons, id],
  );

  // Flights this pigeon participated in
  const myFlights = useMemo(() => {
    if (!pigeon) return [];
    return flights
      .filter((f) => f.pigeons.some((fp) => fp.pigeonId === pigeon.id))
      .map((f) => {
        const fp = f.pigeons.find((p) => p.pigeonId === pigeon.id);
        const durationSec = returnedAtToDurationSeconds(
          f.flightDate,
          fp?.returnedAt,
        );
        return {
          flight: f,
          fp,
          durationStr: durationSec
            ? formatSecondsAsDuration(durationSec)
            : null,
        };
      });
  }, [pigeon, flights]);

  const flightStats = useMemo(() => {
    if (myFlights.length === 0) return null;
    const total = myFlights.length;
    const returned = myFlights.filter(
      (r) => r.fp?.result === "returned",
    ).length;
    const rate = total > 0 ? Math.round((returned / total) * 100) : 0;
    return { total, returned, rate };
  }, [myFlights]);

  // ── Save ──
  async function handleSave() {
    if (!isAdmin || !pigeon || !form) return;

    setSaving(true);
    setSaveMessage("");
    setSaveError("");

    try {
      if (!form.name.trim()) {
        throw new Error("Name is required.");
      }

      await updatePigeonInDb(pigeon.id, {
        name: form.name.trim(),
        birthday: form.birthday || null,
        status: form.status,
        sex: form.sex,
        bandId: form.bandId.trim() || null,
        bandColor: form.bandColor,
        notes: form.notes,
      });

      // Persist parents only if they changed
      const newParents = [form.parentOneId, form.parentTwoId].filter(Boolean);
      const oldParents = pigeon.parentIds ?? [];
      const sameParents =
        newParents.length === oldParents.length &&
        newParents.every((pid) => oldParents.includes(pid));

      if (!sameParents) {
        await setPigeonParentsInDb(pigeon.id, newParents);
      }

      setPigeon((prev) => ({
        ...prev,
        name: form.name.trim(),
        birthday: form.birthday || null,
        status: form.status,
        sex: form.sex,
        bandId: form.bandId.trim() || null,
        bandColor: form.bandColor,
        notes: form.notes,
        parentIds: newParents,
      }));

      setSaveMessage("Saved.");
      setTimeout(() => setSaveMessage(""), 2500);
    } catch (err) {
      setSaveError(err?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!isAdmin || !pigeon) return;
    if (
      !confirm(
        `Archive ${pigeon.name}? They will no longer appear in the catalog.`,
      )
    )
      return;
    try {
      await archivePigeonInDb(pigeon.id);
      router.push("/catalog");
    } catch (err) {
      setSaveError(err?.message ?? "Failed to archive.");
    }
  }

  function getPigeonName(pid) {
    return allPigeons.find((p) => p.id === pid)?.name ?? "Unknown";
  }

  // ── Render states ──
  if (loading) {
    return (
      <main className="relative min-h-screen bg-background">
        <SimpleTopNav />
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 px-6 pt-32 pb-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading pigeon…
        </div>
      </main>
    );
  }

  if (loadError || !pigeon || !form) {
    return (
      <main className="relative min-h-screen bg-background">
        <SimpleTopNav />
        <div className="mx-auto max-w-5xl px-6 pt-32 pb-12">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-red-600">{loadError ?? "Pigeon not found."}</p>
              <Link
                href="/catalog"
                className="mt-3 inline-block text-sm text-blue underline"
              >
                Back to catalog
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-background space-y-4">
      <SimpleTopNav />

      <header className="relative isolate grid place-items-center overflow-hidden bg-background mt-24 text-center">
        <h1 className="text-2xl font-semibold">{pigeon.name}</h1>
      </header>

      <div className="mx-auto max-w-5xl px-6 pb-12 space-y-6">
        {/* ── Image + Details ── */}
        <section className="grid gap-6 md:grid-cols-[280px_1fr]">
          {/* Image card */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="aspect-square w-full overflow-hidden rounded-md bg-muted">
                {pigeon.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pigeon.imageUrl}
                    alt={pigeon.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <PiBirdBold className="size-20 opacity-40" />
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              <div className="grid grid-cols-4 gap-2">
                {pigeon.images?.length > 0
                  ? pigeon.images.map((img) => (
                      <div
                        key={img.id}
                        className="aspect-square overflow-hidden rounded bg-muted"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))
                  : Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex aspect-square items-center justify-center rounded border border-dashed border-muted-foreground/20 text-muted-foreground/30"
                      >
                        <ImageIcon className="size-4" />
                      </div>
                    ))}
              </div>

              <p className="text-center text-[11px] text-muted-foreground">
                Image uploads coming soon
              </p>
            </CardContent>
          </Card>

          {/* Details form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name + Status */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pd-name">Name</Label>
                  <Input
                    id="pd-name"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => updateField("status", v)}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
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

              {/* Birthday + Sex */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Birthday</Label>
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          disabled={!isAdmin}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.birthday
                            ? formatBirthdayLabel(form.birthday)
                            : "Unknown"}
                        </Button>
                      }
                    />
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
                        onSelect={(date) =>
                          updateField(
                            "birthday",
                            date ? format(date, "MM-dd-yyyy") : "",
                          )
                        }
                        captionLayout="dropdown"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Sex</Label>
                  <Select
                    value={form.sex}
                    onValueChange={(v) => updateField("sex", v)}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">Unknown</SelectItem>
                      <SelectItem value="cock">Cock</SelectItem>
                      <SelectItem value="hen">Hen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Band ID + Color */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pd-band">Band ID</Label>
                  <Input
                    id="pd-band"
                    value={form.bandId}
                    onChange={(e) => updateField("bandId", e.target.value)}
                    placeholder="Unbanded"
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Band color</Label>
                  <Select
                    value={form.bandColor}
                    onValueChange={(v) => updateField("bandColor", v)}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue />
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

              {/* Parents */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Parent 1</Label>
                  <Select
                    value={form.parentOneId || "none"}
                    onValueChange={(v) =>
                      updateField("parentOneId", v === "none" ? "" : v)
                    }
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {form.parentOneId
                          ? getPigeonName(form.parentOneId)
                          : "Unknown"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unknown</SelectItem>
                      {otherPigeons
                        .filter((p) => p.id !== form.parentTwoId)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Parent 2</Label>
                  <Select
                    value={form.parentTwoId || "none"}
                    onValueChange={(v) =>
                      updateField("parentTwoId", v === "none" ? "" : v)
                    }
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {form.parentTwoId
                          ? getPigeonName(form.parentTwoId)
                          : "Unknown"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unknown</SelectItem>
                      {otherPigeons
                        .filter((p) => p.id !== form.parentOneId)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="pd-notes">Notes</Label>
                <Textarea
                  id="pd-notes"
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Random information, medical notes, behavior…"
                  rows={3}
                  disabled={!isAdmin}
                />
              </div>

              {saveError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                  {saveError}
                </p>
              )}

              {isAdmin && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={handleArchive}
                    >
                      <Archive className="mr-1.5 h-3.5 w-3.5" />
                      Archive
                    </Button>

                    <div className="flex items-center gap-3">
                      {saveMessage && (
                        <span className="text-xs text-green-600">
                          {saveMessage}
                        </span>
                      )}
                      <Button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          <>
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                            Save changes
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {!isAdmin && (
                <p className="text-xs text-muted-foreground italic">
                  Sign in as an admin to edit this pigeon.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Flights section ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <PlaneTakeoff className="h-4 w-4" />
              Flights ({myFlights.length})
            </CardTitle>
            {flightStats && (
              <span className="text-xs text-muted-foreground">
                {flightStats.returned}/{flightStats.total} returned ·{" "}
                <span className="font-medium text-foreground">
                  {flightStats.rate}%
                </span>
              </span>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {myFlights.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No flights logged yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-5 py-2 font-medium">Date</th>
                      <th className="px-5 py-2 font-medium">Location</th>
                      <th className="px-5 py-2 font-medium text-right">
                        Distance
                      </th>
                      <th className="px-5 py-2 font-medium">Result</th>
                      <th className="px-5 py-2 font-medium">Flight time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {myFlights.map(({ flight, fp, durationStr }) => (
                      <tr key={flight.id} className="hover:bg-muted/40">
                        <td className="px-5 py-2.5 whitespace-nowrap">
                          {formatFlightDate(flight.flightDate)}
                        </td>
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0 text-red-500" />
                            <span className="truncate">
                              {flight.locationName ?? "Unknown"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-2.5 text-right whitespace-nowrap">
                          {flight.distance != null
                            ? `${Math.round(flight.distance)} ${distanceUnit}`
                            : "—"}
                        </td>
                        <td className="px-5 py-2.5">
                          <span
                            className={`capitalize ${RESULT_CLASS[fp?.result] ?? ""}`}
                          >
                            {fp?.result ?? "—"}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 font-mono text-xs">
                          {durationStr ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
