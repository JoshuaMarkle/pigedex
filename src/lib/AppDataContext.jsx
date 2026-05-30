"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { COOP_ID } from "@/lib/constants";
import {
  db,
  readPigeonsFromLocal,
  readFlightsFromLocal,
} from "@/lib/localDb";

import {
  createPigeonInDb,
  updatePigeonInDb,
  setPigeonParentsInDb,
  uploadPigeonImage,
  setPigeonProfileImage,
  deletePigeonImage,
  deletePigeonInDb,
} from "@/lib/pigeonDb";

import {
  fetchCoopSettings,
  upsertCoopSettings,
  createFlight as createFlightInDb,
  updateFlight as updateFlightInDb,
  deleteFlight as deleteFlightInDb,
  addPigeonToFlight,
  removePigeonFromFlight,
  updateFlightPigeon,
} from "@/lib/flightDb";

import { syncAll, queueOp } from "@/lib/syncEngine";

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const [pigeons, setPigeons] = useState([]);
  const [pigeonsLoading, setPigeonsLoading] = useState(true);
  const [pigeonsError, setPigeonsError] = useState("");

  const [flights, setFlights] = useState([]);
  const [flightsLoading, setFlightsLoading] = useState(true);
  const [flightsError, setFlightsError] = useState("");

  const [coopSettings, setCoopSettings] = useState(null);

  // Stable ref to pigeons for use in callbacks that need fresh state
  const pigeonsRef = useRef([]);
  useEffect(() => {
    pigeonsRef.current = pigeons;
  }, [pigeons]);

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    async function load() {
      // Phase 1: read from Dexie (instant, works offline)
      try {
        const [localPigeons, localFlights] = await Promise.all([
          readPigeonsFromLocal(COOP_ID),
          readFlightsFromLocal(COOP_ID),
        ]);
        if (!mounted) return;
        setPigeons(localPigeons);
        pigeonsRef.current = localPigeons;
        setFlights(localFlights);
      } catch {
        // Dexie not populated yet — that's fine, server pull will fill it
      } finally {
        if (mounted) {
          setPigeonsLoading(false);
          setFlightsLoading(false);
        }
      }

      // Phase 2: sync with server (background, requires network)
      if (navigator.onLine) {
        try {
          await syncAll();
          if (!mounted) return;
          const [syncedPigeons, syncedFlights] = await Promise.all([
            readPigeonsFromLocal(COOP_ID),
            readFlightsFromLocal(COOP_ID),
          ]);
          if (!mounted) return;
          setPigeons(syncedPigeons);
          pigeonsRef.current = syncedPigeons;
          setFlights(syncedFlights);
        } catch {
          // Network errors are expected offline — silently ignore
        }
      }

      // Load coop settings (always from server when online)
      if (navigator.onLine) {
        try {
          const settings = await fetchCoopSettings();
          if (mounted) setCoopSettings(settings);
        } catch {
          // ignore
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Reload state from Dexie (called after any mutation that writes to Dexie)
  const refreshFromLocal = useCallback(async () => {
    const [p, f] = await Promise.all([
      readPigeonsFromLocal(COOP_ID),
      readFlightsFromLocal(COOP_ID),
    ]);
    setPigeons(p);
    pigeonsRef.current = p;
    setFlights(f);
  }, []);

  // ── Pigeon mutations ────────────────────────────────────────────────────────

  const createPigeon = useCallback(async (draft) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const row = {
      id,
      coop_id: COOP_ID,
      name: draft.name,
      birthday: draft.birthday || null,
      status: draft.status || "home",
      band_id: draft.bandId || null,
      band_color: draft.bandColor || null,
      sex: draft.sex || "unknown",
      notes: draft.notes || "",
      archived: false,
      created_at: now,
      updated_at: now,
    };

    // Write to Dexie
    await db.pigeons.add(row);

    // Write parent relationships locally, preserving the same IDs for Supabase
    const parentIds = draft.parentIds || [];
    const parentRelationships = parentIds.map((parentId) => ({
      id: crypto.randomUUID(),
      parentId,
    }));
    for (const { id: relId, parentId } of parentRelationships) {
      await db.pigeon_relationships.add({
        id: relId,
        coop_id: COOP_ID,
        parent_id: parentId,
        child_id: id,
        created_at: now,
      });
    }

    // Queue for server sync (include relationship IDs so Supabase uses the same ones)
    await queueOp("pigeons", "insert", {
      id,
      ...draft,
      parentRelationships,
      created_at: now,
      updated_at: now,
    });

    await refreshFromLocal();

    // Trigger a background sync — syncAll is protected by syncInProgress so
    // concurrent calls from event listeners are safely no-ops.
    if (navigator.onLine) syncAll().catch(() => {});

    return { id };
  }, [refreshFromLocal]);

  const updatePigeon = useCallback(async (pigeonId, updates) => {
    const now = new Date().toISOString();
    const dbUpdates = {};
    if ("name" in updates) dbUpdates.name = updates.name;
    if ("birthday" in updates) dbUpdates.birthday = updates.birthday || null;
    if ("status" in updates) dbUpdates.status = updates.status;
    if ("bandId" in updates) dbUpdates.band_id = updates.bandId || null;
    if ("bandColor" in updates) dbUpdates.band_color = updates.bandColor || null;
    if ("sex" in updates) dbUpdates.sex = updates.sex || "unknown";
    if ("notes" in updates) dbUpdates.notes = updates.notes || "";
    dbUpdates.updated_at = now;

    // Optimistic local state update (fast path — avoids waiting for Dexie read)
    setPigeons((prev) =>
      prev.map((p) => (p.id === pigeonId ? { ...p, ...updates } : p)),
    );

    // Persist to Dexie
    await db.pigeons.update(pigeonId, dbUpdates);

    const opId = await queueOp("pigeons", "update", {
      id: pigeonId,
      updates,
      updated_at: now,
    });

    if (navigator.onLine) {
      try {
        await updatePigeonInDb(pigeonId, updates);
        await db.pending_ops.delete(opId);
      } catch {
        // Queued for next sync
      }
    }
  }, []);

  const setPigeonParents = useCallback(async (pigeonId, parentIds) => {
    const now = new Date().toISOString();

    // Optimistic local update
    setPigeons((prev) =>
      prev.map((p) => (p.id === pigeonId ? { ...p, parentIds } : p)),
    );

    // Replace relationships in Dexie, preserving IDs for Supabase
    await db.pigeon_relationships
      .where("coop_id")
      .equals(COOP_ID)
      .and((r) => r.child_id === pigeonId)
      .delete();

    const relationships = parentIds.map((parentId) => ({
      id: crypto.randomUUID(),
      parentId,
    }));
    for (const { id: relId, parentId } of relationships) {
      await db.pigeon_relationships.add({
        id: relId,
        coop_id: COOP_ID,
        parent_id: parentId,
        child_id: pigeonId,
        created_at: now,
      });
    }

    const opId = await queueOp("pigeon_relationships", "set_parents", {
      pigeonId,
      parentIds,
      relationships,
    });

    if (navigator.onLine) {
      try {
        await setPigeonParentsInDb(pigeonId, parentIds, relationships);
        await db.pending_ops.delete(opId);
      } catch {
        // Queued for next sync
      }
    }
  }, []);

  const deletePigeon = useCallback(async (pigeonId) => {
    // Delete from Dexie first
    await db.pigeons.delete(pigeonId);
    await db.pigeon_relationships
      .where("coop_id")
      .equals(COOP_ID)
      .and((r) => r.parent_id === pigeonId || r.child_id === pigeonId)
      .delete();
    await db.pigeon_images
      .where("pigeon_id")
      .equals(pigeonId)
      .delete();

    setPigeons((prev) => prev.filter((p) => p.id !== pigeonId));
    setFlights((prev) =>
      prev.map((f) => ({
        ...f,
        pigeons: f.pigeons.filter((fp) => fp.pigeonId !== pigeonId),
      })),
    );

    const opId = await queueOp("pigeons", "delete", { id: pigeonId });

    if (navigator.onLine) {
      try {
        await deletePigeonInDb(pigeonId);
        await db.pending_ops.delete(opId);
      } catch {
        // Queued for next sync
      }
    }
  }, []);

  const uploadImage = useCallback(async (pigeonId, file, isProfile) => {
    // Image uploads always require network (file must reach Supabase Storage)
    const row = await uploadPigeonImage(pigeonId, file, isProfile);

    // Persist image row to Dexie so it's available offline
    await db.pigeon_images.put({
      ...row,
      updated_at: row.updated_at ?? new Date().toISOString(),
    });

    setPigeons((prev) =>
      prev.map((p) => {
        if (p.id !== pigeonId) return p;
        const nextImages = isProfile
          ? [
              ...p.images.map((img) => ({ ...img, is_profile: false })),
              { ...row, is_profile: true },
            ]
          : [...p.images, { ...row, is_profile: false }];
        const profileImg = nextImages.find((img) => img.is_profile);
        return {
          ...p,
          images: nextImages,
          imageUrl: profileImg?.url ?? nextImages[0]?.url ?? null,
        };
      }),
    );
    return row;
  }, []);

  const setProfileImage = useCallback(async (imageId, pigeonId) => {
    const now = new Date().toISOString();

    // Update Dexie
    await db.pigeon_images
      .where("pigeon_id")
      .equals(pigeonId)
      .modify({ is_profile: false, updated_at: now });
    await db.pigeon_images.update(imageId, { is_profile: true, updated_at: now });

    setPigeons((prev) =>
      prev.map((p) => {
        if (p.id !== pigeonId) return p;
        const nextImages = p.images.map((img) => ({
          ...img,
          is_profile: img.id === imageId,
        }));
        const profileImg = nextImages.find((img) => img.is_profile);
        return {
          ...p,
          images: nextImages,
          imageUrl: profileImg?.url ?? p.imageUrl,
        };
      }),
    );

    const opId = await queueOp("pigeon_images", "set_profile", {
      imageId,
      pigeonId,
    });

    if (navigator.onLine) {
      try {
        await setPigeonProfileImage(imageId, pigeonId);
        await db.pending_ops.delete(opId);
      } catch {
        // Queued for next sync
      }
    }
  }, []);

  const deleteImage = useCallback(async (imageId, imageUrl, pigeonId) => {
    const pigeon = pigeonsRef.current.find((p) => p.id === pigeonId);
    const wasProfile =
      pigeon?.images.find((img) => img.id === imageId)?.is_profile ?? false;
    const remaining = (pigeon?.images ?? []).filter(
      (img) => img.id !== imageId,
    );
    const newProfileId =
      wasProfile && remaining.length > 0 ? remaining[0].id : null;

    // Update Dexie
    await db.pigeon_images.delete(imageId);
    if (newProfileId) {
      const now = new Date().toISOString();
      await db.pigeon_images
        .where("pigeon_id")
        .equals(pigeonId)
        .modify({ is_profile: false, updated_at: now });
      await db.pigeon_images.update(newProfileId, {
        is_profile: true,
        updated_at: now,
      });
    }

    setPigeons((prev) =>
      prev.map((p) => {
        if (p.id !== pigeonId) return p;
        const nextImages = remaining.map((img) => ({
          ...img,
          is_profile: newProfileId ? img.id === newProfileId : img.is_profile,
        }));
        const profileImg = nextImages.find((img) => img.is_profile);
        return {
          ...p,
          images: nextImages,
          imageUrl: profileImg?.url ?? null,
        };
      }),
    );

    // Queue both operations for sync
    const opId = await queueOp("pigeon_images", "delete", {
      imageId,
      imageUrl,
    });
    let profileOpId = null;
    if (newProfileId) {
      profileOpId = await queueOp("pigeon_images", "set_profile", {
        imageId: newProfileId,
        pigeonId,
      });
    }

    if (navigator.onLine) {
      try {
        await deletePigeonImage(imageId, imageUrl);
        await db.pending_ops.delete(opId);
        if (newProfileId) {
          await setPigeonProfileImage(newProfileId, pigeonId);
          if (profileOpId) await db.pending_ops.delete(profileOpId);
        }
      } catch {
        // Queued for next sync
      }
    }
  }, []);

  // ── Flight mutations ────────────────────────────────────────────────────────

  const createFlight = useCallback(async (flightData) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const row = {
      id,
      coop_id: COOP_ID,
      flight_date: flightData.flightDate,
      location_name: flightData.locationName || null,
      release_lat: flightData.releaseLat ?? null,
      release_lng: flightData.releaseLng ?? null,
      distance: flightData.distance ?? null,
      status: flightData.status ?? "completed",
      notes: flightData.notes ?? "",
      created_at: now,
      updated_at: now,
    };

    await db.flights.add(row);

    const pigeonIds = flightData.pigeonIds ?? [];
    const defaultResult = flightData.defaultPigeonResult ?? "unknown";
    const fpRows = [];
    for (const pigeonId of pigeonIds) {
      const fpRow = {
        id: crypto.randomUUID(),
        coop_id: COOP_ID,
        flight_id: id,
        pigeon_id: pigeonId,
        result: defaultResult,
        notes: "",
        created_at: now,
        updated_at: now,
      };
      await db.flight_pigeons.add(fpRow);
      fpRows.push(fpRow);
    }

    if (flightData.setPigeonsFlying && pigeonIds.length > 0) {
      await Promise.all(
        pigeonIds.map((pid) =>
          db.pigeons.update(pid, {
            status: "flying",
            updated_at: now,
          }),
        ),
      );
      setPigeons((prev) =>
        prev.map((p) =>
          pigeonIds.includes(p.id) ? { ...p, status: "flying" } : p,
        ),
      );
    }

    await queueOp("flights", "insert", {
      id,
      ...flightData,
      created_at: now,
      pigeonRows: fpRows.map((fp) => ({ id: fp.id, pigeonId: fp.pigeon_id })),
    });

    await refreshFromLocal();

    const created = {
      id,
      flightDate: row.flight_date,
      locationName: row.location_name,
      releaseLat: row.release_lat,
      releaseLng: row.release_lng,
      distance: row.distance,
      status: row.status,
      notes: row.notes,
      createdAt: now,
      updatedAt: now,
      pigeons: fpRows.map((fp) => ({
        id: fp.id,
        pigeonId: fp.pigeon_id,
        returnedAt: fp.returned_at ?? null,
        result: fp.result,
        notes: fp.notes,
      })),
    };

    if (navigator.onLine) syncAll().catch(() => {});

    return created;
  }, [refreshFromLocal]);

  const saveFlight = useCallback(
    async (
      flightId,
      flightUpdates,
      pigeonUpdates,
      { addPigeonIds = [], removePigeonIds = [] } = {},
    ) => {
      const now = new Date().toISOString();

      // Update flight in Dexie
      const dbFlightUpdates = {};
      if ("flightDate" in flightUpdates) dbFlightUpdates.flight_date = flightUpdates.flightDate;
      if ("locationName" in flightUpdates) dbFlightUpdates.location_name = flightUpdates.locationName || null;
      if ("releaseLat" in flightUpdates) dbFlightUpdates.release_lat = flightUpdates.releaseLat ?? null;
      if ("releaseLng" in flightUpdates) dbFlightUpdates.release_lng = flightUpdates.releaseLng ?? null;
      if ("distance" in flightUpdates) dbFlightUpdates.distance = flightUpdates.distance ?? null;
      if ("status" in flightUpdates) dbFlightUpdates.status = flightUpdates.status;
      if ("notes" in flightUpdates) dbFlightUpdates.notes = flightUpdates.notes ?? "";
      dbFlightUpdates.updated_at = now;
      await db.flights.update(flightId, dbFlightUpdates);

      // Update flight_pigeons in Dexie
      for (const u of pigeonUpdates) {
        await db.flight_pigeons.update(u.id, {
          result: u.result,
          returned_at: u.returnedAt,
          updated_at: now,
        });
      }
      for (const fpId of removePigeonIds) {
        await db.flight_pigeons.delete(fpId);
      }
      const newFpRows = [];
      for (const pigeonId of addPigeonIds) {
        const fpRow = {
          id: crypto.randomUUID(),
          coop_id: COOP_ID,
          flight_id: flightId,
          pigeon_id: pigeonId,
          result: "unknown",
          notes: "",
          created_at: now,
          updated_at: now,
        };
        await db.flight_pigeons.add(fpRow);
        newFpRows.push({
          id: fpRow.id,
          pigeonId: fpRow.pigeon_id,
          returnedAt: null,
          result: fpRow.result,
          notes: fpRow.notes,
        });
      }

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
            pigeons: [...updatedExisting, ...newFpRows],
          };
        }),
      );

      if (navigator.onLine) {
        try {
          await updateFlightInDb(flightId, flightUpdates);
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
          await Promise.all(
            newFpRows.map((fp) => addPigeonToFlight(flightId, fp.pigeonId, fp.id)),
          );
        } catch {
          // Will be picked up on next sync
          await queueOp("flights", "update", {
            id: flightId,
            updates: flightUpdates,
          });
        }
      } else {
        await queueOp("flights", "update", {
          id: flightId,
          updates: flightUpdates,
        });
      }
    },
    [],
  );

  const deleteFlight = useCallback(async (flightId) => {
    await db.flights.delete(flightId);
    await db.flight_pigeons.where("flight_id").equals(flightId).delete();

    setFlights((prev) => prev.filter((f) => f.id !== flightId));

    const opId = await queueOp("flights", "delete", { id: flightId });

    if (navigator.onLine) {
      try {
        await deleteFlightInDb(flightId);
        await db.pending_ops.delete(opId);
      } catch {
        // Queued for next sync
      }
    }
  }, []);

  // ── Coop settings ───────────────────────────────────────────────────────────

  const updateCoopSettings = useCallback(async (settings) => {
    await upsertCoopSettings(settings);
    setCoopSettings(settings);
  }, []);

  // ── Context value ───────────────────────────────────────────────────────────

  const value = {
    pigeons,
    pigeonsLoading,
    pigeonsError,
    flights,
    flightsLoading,
    flightsError,
    coopSettings,
    createPigeon,
    updatePigeon,
    setPigeonParents,
    deletePigeon,
    uploadImage,
    setProfileImage,
    deleteImage,
    createFlight,
    saveFlight,
    deleteFlight,
    updateCoopSettings,
  };

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function usePigeons() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("usePigeons must be used within AppDataProvider");
  return {
    pigeons: ctx.pigeons,
    pigeonsLoading: ctx.pigeonsLoading,
    pigeonsError: ctx.pigeonsError,
    createPigeon: ctx.createPigeon,
    updatePigeon: ctx.updatePigeon,
    setPigeonParents: ctx.setPigeonParents,
    deletePigeon: ctx.deletePigeon,
    uploadImage: ctx.uploadImage,
    setProfileImage: ctx.setProfileImage,
    deleteImage: ctx.deleteImage,
  };
}

export function useFlights() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useFlights must be used within AppDataProvider");
  return {
    flights: ctx.flights,
    flightsLoading: ctx.flightsLoading,
    flightsError: ctx.flightsError,
    createFlight: ctx.createFlight,
    saveFlight: ctx.saveFlight,
    deleteFlight: ctx.deleteFlight,
  };
}

export function useCoopSettings() {
  const ctx = useContext(AppDataContext);
  if (!ctx)
    throw new Error("useCoopSettings must be used within AppDataProvider");
  return {
    coopSettings: ctx.coopSettings,
    updateCoopSettings: ctx.updateCoopSettings,
  };
}
