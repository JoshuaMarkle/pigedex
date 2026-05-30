import { supabase } from "@/lib/supabaseClient";
import { COOP_ID } from "@/lib/constants";
import { db, getSyncMeta, setSyncMeta } from "@/lib/localDb";

import {
  createPigeonInDb,
  updatePigeonInDb,
  setPigeonParentsInDb,
  deletePigeonInDb,
  setPigeonProfileImage,
  deletePigeonImage,
} from "@/lib/pigeonDb";

import {
  createFlight as createFlightInDb,
  updateFlight as updateFlightInDb,
  deleteFlight as deleteFlightInDb,
  addPigeonToFlight,
  removePigeonFromFlight,
  updateFlightPigeon,
} from "@/lib/flightDb";

// ── Push local pending ops to Supabase ───────────────────────────────────────

export async function pushToServer() {
  const ops = await db.pending_ops.orderBy("id").toArray();
  if (ops.length === 0) return;

  for (const op of ops) {
    try {
      await executePendingOp(op);
      await db.pending_ops.delete(op.id);
    } catch (err) {
      // Duplicate key → server already has this record (e.g. pushed from another device)
      const isDuplicate =
        err?.code === "23505" ||
        err?.message?.includes("duplicate key") ||
        err?.status === 409;

      if (isDuplicate) {
        await db.pending_ops.delete(op.id);
      }
      // Other errors: leave op in queue for next sync attempt
    }
  }
}

async function executePendingOp(op) {
  const { table_name, operation, payload } = op;

  if (table_name === "pigeons") {
    if (operation === "insert") {
      await createPigeonInDb({ ...payload, id: payload.id });
    } else if (operation === "update") {
      await updatePigeonInDb(payload.id, payload.updates);
    } else if (operation === "delete") {
      await deletePigeonInDb(payload.id);
    } else if (operation === "set_parents") {
      await setPigeonParentsInDb(payload.pigeonId, payload.parentIds);
    }
  } else if (table_name === "pigeon_images") {
    if (operation === "set_profile") {
      await setPigeonProfileImage(payload.imageId, payload.pigeonId);
    } else if (operation === "delete") {
      await deletePigeonImage(payload.imageId, payload.imageUrl);
    }
    // "insert" image ops require an actual file upload — not retryable offline
  } else if (table_name === "flights") {
    if (operation === "insert") {
      await createFlightInDb({ ...payload, id: payload.id });
    } else if (operation === "update") {
      await updateFlightInDb(payload.id, payload.updates);
    } else if (operation === "delete") {
      await deleteFlightInDb(payload.id);
    }
  } else if (table_name === "flight_pigeons") {
    if (operation === "insert") {
      await addPigeonToFlight(payload.flightId, payload.pigeonId, payload.id);
    } else if (operation === "delete") {
      await removePigeonFromFlight(payload.id);
    } else if (operation === "update") {
      await updateFlightPigeon(payload.id, payload.updates);
    }
  } else if (table_name === "pigeon_relationships") {
    if (operation === "set_parents") {
      await setPigeonParentsInDb(payload.pigeonId, payload.parentIds, payload.relationships);
    }
  }
}

// ── Pull remote data into local Dexie ────────────────────────────────────────

export async function pullFromServer() {
  const [pigeonsRes, relsRes, imgsRes, flightsRes, fpRes] = await Promise.all([
    supabase.from("pigeons").select("*").eq("coop_id", COOP_ID),
    supabase.from("pigeon_relationships").select("*").eq("coop_id", COOP_ID),
    supabase.from("pigeon_images").select("*").eq("coop_id", COOP_ID),
    supabase
      .from("flights")
      .select("*")
      .eq("coop_id", COOP_ID)
      .order("flight_date", { ascending: false }),
    supabase.from("flight_pigeons").select("*").eq("coop_id", COOP_ID),
  ]);

  // Abort if any query failed (likely offline)
  if (
    pigeonsRes.error ||
    relsRes.error ||
    imgsRes.error ||
    flightsRes.error ||
    fpRes.error
  ) {
    throw new Error("Pull failed");
  }

  await db.transaction(
    "rw",
    [
      db.pigeons,
      db.pigeon_relationships,
      db.pigeon_images,
      db.flights,
      db.flight_pigeons,
      db.sync_meta,
    ],
    async () => {
      await mergeIntoLocal(db.pigeons, pigeonsRes.data ?? [], "updated_at");
      await mergeRelationships(relsRes.data ?? []);
      await mergeIntoLocal(db.pigeon_images, imgsRes.data ?? [], "updated_at");
      await mergeIntoLocal(db.flights, flightsRes.data ?? [], "updated_at");
      await mergeFlightPigeons(fpRes.data ?? []);
      await setSyncMeta(new Date().toISOString());
    },
  );
}

// Merge server rows into a local Dexie table using last-write-wins on updated_at.
// - Server rows with no local match → insert (new record from another device)
// - Server rows where server.updated_at > local.updated_at → update local
// - Local rows where local.updated_at >= server.updated_at → keep local (pending offline edit)
export async function mergeIntoLocal(table, serverRows, timestampField) {
  if (serverRows.length === 0) return;

  const serverIds = serverRows.map((r) => r.id);
  const localRows = await table.where("id").anyOf(serverIds).toArray();
  const localById = Object.fromEntries(localRows.map((r) => [r.id, r]));

  const rowsToUpsert = serverRows.filter((serverRow) => {
    const local = localById[serverRow.id];
    if (!local) return true; // new record
    const serverTs = serverRow[timestampField];
    const localTs = local[timestampField];
    if (!serverTs) return false; // server has no timestamp, skip
    if (!localTs) return true;
    return serverTs > localTs; // server is newer
  });

  if (rowsToUpsert.length > 0) {
    await table.bulkPut(rowsToUpsert);
  }
}

// Relationships have no updated_at — use insert-only merge.
// Only add rows that don't exist locally. Local deletes that are queued as
// pending_ops will be pushed first (in pushToServer), so by the time we pull
// the server should reflect those deletes.
export async function mergeRelationships(serverRows) {
  if (serverRows.length === 0) return;
  const serverIds = serverRows.map((r) => r.id);
  const existing = await db.pigeon_relationships
    .where("id")
    .anyOf(serverIds)
    .primaryKeys();
  const existingSet = new Set(existing);
  const toInsert = serverRows.filter((r) => !existingSet.has(r.id));
  if (toInsert.length > 0) {
    await db.pigeon_relationships.bulkPut(toInsert);
  }
}

// flight_pigeons have updated_at after the migration — same merge logic.
async function mergeFlightPigeons(serverRows) {
  await mergeIntoLocal(db.flight_pigeons, serverRows, "updated_at");
}

// ── Full sync (push then pull) ────────────────────────────────────────────────

let syncInProgress = false;

export async function syncAll() {
  if (!navigator.onLine) return;
  if (syncInProgress) return;

  syncInProgress = true;
  try {
    await pushToServer();
    await pullFromServer();
  } catch {
    // Network errors are expected; silently swallow
  } finally {
    syncInProgress = false;
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

export function initSyncListeners() {
  function onOnline() {
    syncAll();
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") {
      syncAll();
    }
  }

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

// ── Queue helpers (used by AppDataContext mutations) ──────────────────────────

export async function queueOp(tableName, operation, payload) {
  return db.pending_ops.add({
    table_name: tableName,
    operation,
    payload,
    created_at: Date.now(),
  });
}

export async function pendingOpsCount() {
  return db.pending_ops.count();
}
