import { describe, it, expect, vi, beforeEach } from "vitest";
import Dexie from "dexie";
import { IDBFactory } from "fake-indexeddb";

// Mock Supabase before any module that imports it is loaded.
// The factory must be an arrow function (no `this`) so vi.mock can hoist it.
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock constants so tests are independent of the real COOP_ID env var.
vi.mock("@/lib/constants", () => ({ COOP_ID: "test-coop" }));

import { setPigeonParentsInDb } from "@/lib/pigeonDb";
import { addPigeonToFlight } from "@/lib/flightDb";
import { supabase } from "@/lib/supabaseClient";

const COOP_ID = "test-coop";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTestDb() {
  const db = new Dexie("pigedex-test", { indexedDB: new IDBFactory() });
  db.version(1).stores({
    pigeons: "id, coop_id, updated_at, archived",
    pigeon_relationships: "id, coop_id, parent_id, child_id",
    pigeon_images: "id, coop_id, pigeon_id, updated_at",
    flights: "id, coop_id, updated_at",
    flight_pigeons: "id, coop_id, flight_id, pigeon_id, updated_at",
    pending_ops: "++id, table_name, created_at",
    sync_meta: "key",
  });
  return db;
}

// Build a Supabase chain mock that captures inserts and returns predictable data.
function makeChainMock(captured, table, singleReturn = null) {
  const chain = {
    select: () => chain,
    single: () => Promise.resolve({ data: singleReturn, error: null }),
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    delete: () => chain,
    update: () => chain,
    insert: (rows) => {
      if (!captured[table]) captured[table] = [];
      const arr = Array.isArray(rows) ? rows : [rows];
      arr.forEach((r) => captured[table].push(r));
      return makeChainMock(captured, table, arr[0]);
    },
    then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return chain;
}

// Configure the mocked supabase.from to use a fresh captured object per test.
function setupSupabaseMock() {
  const captured = {};
  supabase.from.mockImplementation((table) => makeChainMock(captured, table));
  return captured;
}

// ── Inline merge helpers (mirrors syncEngine internals) ───────────────────────

async function mergeIntoLocal(table, serverRows, timestampField) {
  if (serverRows.length === 0) return;
  const serverIds = serverRows.map((r) => r.id);
  const localRows = await table.where("id").anyOf(serverIds).toArray();
  const localById = Object.fromEntries(localRows.map((r) => [r.id, r]));
  const rowsToUpsert = serverRows.filter((serverRow) => {
    const local = localById[serverRow.id];
    if (!local) return true;
    const serverTs = serverRow[timestampField];
    const localTs = local[timestampField];
    if (!serverTs) return false;
    if (!localTs) return true;
    return serverTs > localTs;
  });
  if (rowsToUpsert.length > 0) await table.bulkPut(rowsToUpsert);
}

async function mergeRelationships(db, serverRows) {
  if (serverRows.length === 0) return;
  const serverIds = serverRows.map((r) => r.id);
  const existing = await db.pigeon_relationships
    .where("id")
    .anyOf(serverIds)
    .primaryKeys();
  const existingSet = new Set(existing);
  const toInsert = serverRows.filter((r) => !existingSet.has(r.id));
  if (toInsert.length > 0) await db.pigeon_relationships.bulkPut(toInsert);
}

// ── mergeRelationships ────────────────────────────────────────────────────────

describe("mergeRelationships", () => {
  it("inserts new server rows not present locally", async () => {
    const db = makeTestDb();
    await mergeRelationships(db, [
      { id: "rel-1", coop_id: COOP_ID, parent_id: "p1", child_id: "c1" },
    ]);
    expect(await db.pigeon_relationships.count()).toBe(1);
  });

  it("skips rows already present locally — no duplicates", async () => {
    const db = makeTestDb();
    await db.pigeon_relationships.add({
      id: "rel-1", coop_id: COOP_ID, parent_id: "p1", child_id: "c1",
    });

    // Server returns same UUID (as happens after our ID-preserving fix)
    await mergeRelationships(db, [
      { id: "rel-1", coop_id: COOP_ID, parent_id: "p1", child_id: "c1" },
    ]);

    expect(await db.pigeon_relationships.count()).toBe(1); // no duplicate
  });

  it("adds only rows whose IDs are new", async () => {
    const db = makeTestDb();
    await db.pigeon_relationships.add({
      id: "rel-1", coop_id: COOP_ID, parent_id: "p1", child_id: "c1",
    });

    await mergeRelationships(db, [
      { id: "rel-1", coop_id: COOP_ID, parent_id: "p1", child_id: "c1" },
      { id: "rel-2", coop_id: COOP_ID, parent_id: "p2", child_id: "c1" },
    ]);

    expect(await db.pigeon_relationships.count()).toBe(2);
  });

  it("demonstrates the old bug: different server UUID → duplicate row", async () => {
    const db = makeTestDb();
    await db.pigeon_relationships.add({
      id: "local-uuid", coop_id: COOP_ID, parent_id: "p1", child_id: "c1",
    });

    // Server auto-generated a different UUID (pre-fix)
    await mergeRelationships(db, [
      { id: "server-uuid", coop_id: COOP_ID, parent_id: "p1", child_id: "c1" },
    ]);

    // This is 2 — the bug that the fix prevents
    expect(await db.pigeon_relationships.count()).toBe(2);
  });
});

// ── mergeIntoLocal ────────────────────────────────────────────────────────────

describe("mergeIntoLocal", () => {
  it("inserts rows not present locally", async () => {
    const db = makeTestDb();
    await mergeIntoLocal(db.pigeons, [
      { id: "p-1", coop_id: COOP_ID, name: "Percy", updated_at: "2024-01-01T00:00:00Z", archived: false },
    ], "updated_at");

    const row = await db.pigeons.get("p-1");
    expect(row.name).toBe("Percy");
  });

  it("replaces local row when server version is newer (last-write-wins)", async () => {
    const db = makeTestDb();
    await db.pigeons.add({
      id: "p-1", coop_id: COOP_ID, name: "Old Name",
      updated_at: "2024-01-01T00:00:00Z", archived: false,
    });

    await mergeIntoLocal(db.pigeons, [
      { id: "p-1", coop_id: COOP_ID, name: "New Name", updated_at: "2024-01-02T00:00:00Z", archived: false },
    ], "updated_at");

    expect((await db.pigeons.get("p-1")).name).toBe("New Name");
  });

  it("preserves local row when it is newer than the server version", async () => {
    const db = makeTestDb();
    await db.pigeons.add({
      id: "p-1", coop_id: COOP_ID, name: "Local Edit",
      updated_at: "2024-01-03T00:00:00Z", archived: false,
    });

    await mergeIntoLocal(db.pigeons, [
      { id: "p-1", coop_id: COOP_ID, name: "Server Old", updated_at: "2024-01-01T00:00:00Z", archived: false },
    ], "updated_at");

    expect((await db.pigeons.get("p-1")).name).toBe("Local Edit");
  });
});

// ── Supabase ID-preservation: setPigeonParentsInDb ────────────────────────────

describe("setPigeonParentsInDb — ID preservation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends provided relationship IDs to Supabase", async () => {
    const captured = setupSupabaseMock();

    await setPigeonParentsInDb("child-1", ["parent-1"], [
      { id: "rel-uuid-1", parentId: "parent-1" },
    ]);

    const rows = captured["pigeon_relationships"] ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("rel-uuid-1");
    expect(rows[0].parent_id).toBe("parent-1");
    expect(rows[0].child_id).toBe("child-1");
  });

  it("omits ID when no relationships array is provided", async () => {
    const captured = setupSupabaseMock();

    await setPigeonParentsInDb("child-1", ["parent-1"]);

    const rows = captured["pigeon_relationships"] ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBeUndefined(); // server auto-generates
  });

  it("handles two parents — passes both IDs", async () => {
    const captured = setupSupabaseMock();

    await setPigeonParentsInDb("child-1", ["p1", "p2"], [
      { id: "rel-1", parentId: "p1" },
      { id: "rel-2", parentId: "p2" },
    ]);

    const rows = captured["pigeon_relationships"] ?? [];
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id)).toEqual(["rel-1", "rel-2"]);
  });
});

// ── Supabase ID-preservation: addPigeonToFlight ───────────────────────────────

describe("addPigeonToFlight — ID preservation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes the provided ID in the Supabase insert", async () => {
    const captured = {};
    supabase.from.mockImplementation((table) => ({
      insert: (row) => {
        if (!captured[table]) captured[table] = [];
        captured[table].push(row);
        return {
          select: () => ({
            single: () => Promise.resolve({
              data: { id: row.id ?? "auto", pigeon_id: row.pigeon_id, flight_id: row.flight_id, returned_at: null, result: row.result, notes: row.notes },
              error: null,
            }),
          }),
        };
      },
    }));

    await addPigeonToFlight("flight-1", "pig-1", "fp-uuid-1");

    const rows = captured["flight_pigeons"] ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("fp-uuid-1");
  });

  it("omits ID when not provided (server auto-generates)", async () => {
    const captured = {};
    supabase.from.mockImplementation((table) => ({
      insert: (row) => {
        if (!captured[table]) captured[table] = [];
        captured[table].push(row);
        return {
          select: () => ({
            single: () => Promise.resolve({
              data: { id: "auto-gen", pigeon_id: row.pigeon_id, flight_id: row.flight_id, returned_at: null, result: row.result, notes: row.notes },
              error: null,
            }),
          }),
        };
      },
    }));

    await addPigeonToFlight("flight-1", "pig-1"); // no id

    const rows = captured["flight_pigeons"] ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBeUndefined();
  });
});

// ── Round-trip: no duplicates when IDs are preserved ─────────────────────────

describe("round-trip: flight_pigeons — no duplicates after ID-preserving sync", () => {
  it("no duplicate when server returns the same UUID as local", async () => {
    const db = makeTestDb();
    const localFpId = "fp-local-uuid";

    await db.flight_pigeons.add({
      id: localFpId, coop_id: COOP_ID, flight_id: "f1", pigeon_id: "p1",
      result: "unknown", notes: "", updated_at: "2024-01-01T00:00:00Z",
    });

    // Server returns the same UUID (because our fix preserved it)
    await mergeIntoLocal(db.flight_pigeons, [
      { id: localFpId, coop_id: COOP_ID, flight_id: "f1", pigeon_id: "p1",
        result: "unknown", notes: "", updated_at: "2024-01-01T00:00:00Z" },
    ], "updated_at");

    expect(await db.flight_pigeons.count()).toBe(1);
  });

  it("duplicate appears when server returns a different UUID (demonstrates the old bug)", async () => {
    const db = makeTestDb();

    await db.flight_pigeons.add({
      id: "fp-local-uuid", coop_id: COOP_ID, flight_id: "f1", pigeon_id: "p1",
      result: "unknown", notes: "", updated_at: "2024-01-01T00:00:00Z",
    });

    // Server auto-generated a different UUID (pre-fix behavior)
    await mergeIntoLocal(db.flight_pigeons, [
      { id: "fp-server-uuid", coop_id: COOP_ID, flight_id: "f1", pigeon_id: "p1",
        result: "unknown", notes: "", updated_at: "2024-01-01T00:00:00Z" },
    ], "updated_at");

    expect(await db.flight_pigeons.count()).toBe(2); // the old bug
  });
});
