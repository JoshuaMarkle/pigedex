import Dexie from "dexie";

export const db = new Dexie("pigedex");

db.version(1).stores({
  pigeons: "id, coop_id, updated_at, archived",
  pigeon_relationships: "id, coop_id, parent_id, child_id",
  pigeon_images: "id, coop_id, pigeon_id, updated_at",
  flights: "id, coop_id, updated_at",
  flight_pigeons: "id, coop_id, flight_id, pigeon_id, updated_at",
  // Offline write queue. ++id = auto-increment integer primary key.
  pending_ops: "++id, table_name, created_at",
  // Single row { key: 'main', last_synced_at: ISO string }
  sync_meta: "key",
});

export async function getSyncMeta() {
  return db.sync_meta.get("main");
}

export async function setSyncMeta(lastSyncedAt) {
  return db.sync_meta.put({ key: "main", last_synced_at: lastSyncedAt });
}

// Convert raw Supabase snake_case pigeon rows into the in-app camelCase shape.
// Mirror of fetchPigeonsWithParents() but reads from local tables.
export function mapPigeonRows(pigeonRows, relationshipRows, imageRows) {
  return pigeonRows
    .filter((row) => !row.archived)
    .map((row) => {
      const pigeonImages = imageRows
        .filter((img) => img.pigeon_id === row.id)
        .sort((a, b) => a.sort_order - b.sort_order);

      return {
        id: row.id,
        name: row.name,
        birthday: row.birthday,
        status: row.status,
        bandId: row.band_id,
        bandColor: row.band_color,
        sex: row.sex,
        notes: row.notes,
        imageUrl:
          pigeonImages.find((img) => img.is_profile)?.url ||
          pigeonImages[0]?.url ||
          null,
        images: pigeonImages,
        parentIds: relationshipRows
          .filter((r) => r.child_id === row.id)
          .map((r) => r.parent_id),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
}

// Convert raw Supabase flight rows into the in-app shape.
export function mapFlightRows(flightRows, flightPigeonRows) {
  return flightRows.map((row) => {
    const pigeons = flightPigeonRows
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
  });
}

// Read all pigeons from Dexie in the in-app shape.
export async function readPigeonsFromLocal(coopId) {
  const [pigeonRows, relRows, imgRows] = await Promise.all([
    db.pigeons.where("coop_id").equals(coopId).toArray(),
    db.pigeon_relationships.where("coop_id").equals(coopId).toArray(),
    db.pigeon_images.where("coop_id").equals(coopId).toArray(),
  ]);
  return mapPigeonRows(pigeonRows, relRows, imgRows);
}

// Read all flights from Dexie in the in-app shape.
export async function readFlightsFromLocal(coopId) {
  const [flightRows, fpRows] = await Promise.all([
    db.flights.where("coop_id").equals(coopId).toArray(),
    db.flight_pigeons.where("coop_id").equals(coopId).toArray(),
  ]);
  // Sort newest first (mirrors the Supabase query order)
  flightRows.sort((a, b) => {
    if (a.flight_date < b.flight_date) return 1;
    if (a.flight_date > b.flight_date) return -1;
    return 0;
  });
  return mapFlightRows(flightRows, fpRows);
}
