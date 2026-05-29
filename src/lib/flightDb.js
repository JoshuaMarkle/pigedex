import { supabase } from "@/lib/supabaseClient";
import { COOP_ID } from "@/lib/constants";

// ── Haversine distance ────────────────────────────────────────────────────────

export function haversineDistance(lat1, lng1, lat2, lng2, unit = "miles") {
  const R = unit === "km" ? 6371 : 3958.8;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Coop settings ─────────────────────────────────────────────────────────────

export async function fetchCoopSettings() {
  const { data, error } = await supabase
    .from("coop_settings")
    .select("*")
    .eq("coop_id", COOP_ID)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    homeName: data.home_name,
    homeLat: data.home_lat,
    homeLng: data.home_lng,
    distanceUnit: data.distance_unit ?? "miles",
  };
}

export async function upsertCoopSettings(settings) {
  const { error } = await supabase.from("coop_settings").upsert(
    {
      coop_id: COOP_ID,
      home_name: settings.homeName ?? "Home Coop",
      home_lat: settings.homeLat ?? null,
      home_lng: settings.homeLng ?? null,
      distance_unit: settings.distanceUnit ?? "miles",
    },
    { onConflict: "coop_id" },
  );

  if (error) throw error;
}

// ── Flights ───────────────────────────────────────────────────────────────────

function rowToFlight(row, flightPigeons) {
  const pigeons = (flightPigeons ?? [])
    .filter((fp) => fp.flight_id === row.id)
    .map((fp) => ({
      id: fp.id,
      pigeonId: fp.pigeon_id,
      returnedAt: fp.returned_at,
      result: fp.result,
      notes: fp.notes,
    }));

  return {
    id: row.id,
    flightDate: row.flight_date,
    locationName: row.location_name,
    releaseLat: row.release_lat,
    releaseLng: row.release_lng,
    distance: row.distance != null ? Number(row.distance) : null,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pigeons,
  };
}

export async function fetchFlightsWithPigeons() {
  const [flightsResult, fpResult] = await Promise.all([
    supabase
      .from("flights")
      .select("*")
      .eq("coop_id", COOP_ID)
      .order("flight_date", { ascending: false }),

    supabase.from("flight_pigeons").select("*").eq("coop_id", COOP_ID),
  ]);

  if (flightsResult.error) throw flightsResult.error;
  if (fpResult.error) throw fpResult.error;

  return (flightsResult.data ?? []).map((row) =>
    rowToFlight(row, fpResult.data ?? []),
  );
}

export async function createFlight(flight) {
  const { data, error } = await supabase
    .from("flights")
    .insert({
      coop_id: COOP_ID,
      flight_date: flight.flightDate,
      location_name: flight.locationName || null,
      release_lat: flight.releaseLat ?? null,
      release_lng: flight.releaseLng ?? null,
      distance: flight.distance ?? null,
      status: flight.status ?? "completed",
      notes: flight.notes ?? "",
    })
    .select()
    .single();

  if (error) throw error;

  // Insert flight_pigeons rows
  const pigeonIds = flight.pigeonIds ?? [];
  const defaultResult = flight.defaultPigeonResult ?? "unknown";
  let createdPigeons = [];
  if (pigeonIds.length > 0) {
    const rows = pigeonIds.map((pigeonId) => ({
      coop_id: COOP_ID,
      flight_id: data.id,
      pigeon_id: pigeonId,
      result: defaultResult,
      notes: "",
    }));
    const { data: fpData, error: fpError } = await supabase
      .from("flight_pigeons")
      .insert(rows)
      .select();
    if (fpError) throw fpError;
    createdPigeons = fpData ?? [];
  }

  return rowToFlight(data, createdPigeons);
}

export async function updateFlight(flightId, updates) {
  const db = {};
  if ("flightDate" in updates) db.flight_date = updates.flightDate;
  if ("locationName" in updates) db.location_name = updates.locationName || null;
  if ("releaseLat" in updates) db.release_lat = updates.releaseLat ?? null;
  if ("releaseLng" in updates) db.release_lng = updates.releaseLng ?? null;
  if ("distance" in updates) db.distance = updates.distance ?? null;
  if ("status" in updates) db.status = updates.status;
  if ("notes" in updates) db.notes = updates.notes ?? "";

  const { data, error } = await supabase
    .from("flights")
    .update(db)
    .eq("id", flightId)
    .eq("coop_id", COOP_ID)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFlight(flightId) {
  const { error: fpError } = await supabase
    .from("flight_pigeons")
    .delete()
    .eq("flight_id", flightId)
    .eq("coop_id", COOP_ID);
  if (fpError) throw fpError;

  const { error } = await supabase
    .from("flights")
    .delete()
    .eq("id", flightId)
    .eq("coop_id", COOP_ID);
  if (error) throw error;
}

// ── Flight pigeons ────────────────────────────────────────────────────────────

export async function addPigeonToFlight(flightId, pigeonId) {
  const { data, error } = await supabase
    .from("flight_pigeons")
    .insert({
      coop_id: COOP_ID,
      flight_id: flightId,
      pigeon_id: pigeonId,
      result: "unknown",
      notes: "",
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    pigeonId: data.pigeon_id,
    returnedAt: data.returned_at,
    result: data.result,
    notes: data.notes,
  };
}

export async function removePigeonFromFlight(flightPigeonId) {
  const { error } = await supabase
    .from("flight_pigeons")
    .delete()
    .eq("id", flightPigeonId)
    .eq("coop_id", COOP_ID);
  if (error) throw error;
}

export async function updateFlightPigeon(flightPigeonId, updates) {
  const db = {};
  if ("result" in updates) db.result = updates.result;
  if ("returnedAt" in updates) db.returned_at = updates.returnedAt;
  if ("notes" in updates) db.notes = updates.notes;

  const { error } = await supabase
    .from("flight_pigeons")
    .update(db)
    .eq("id", flightPigeonId)
    .eq("coop_id", COOP_ID);
  if (error) throw error;
}
