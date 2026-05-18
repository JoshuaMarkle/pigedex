import { supabase } from "@/lib/supabaseClient";
import { COOP_ID } from "@/lib/constants";

export async function fetchPigeonsWithParents() {
  const [pigeonsResult, relationshipsResult, imagesResult] = await Promise.all([
    supabase
      .from("pigeons")
      .select("*")
      .eq("coop_id", COOP_ID)
      .eq("archived", false)
      .order("created_at", { ascending: true }),

    supabase.from("pigeon_relationships").select("*").eq("coop_id", COOP_ID),

    supabase
      .from("pigeon_images")
      .select("*")
      .eq("coop_id", COOP_ID)
      .order("sort_order", { ascending: true }),
  ]);

  if (pigeonsResult.error) throw pigeonsResult.error;
  if (relationshipsResult.error) throw relationshipsResult.error;
  if (imagesResult.error) throw imagesResult.error;

  const relationships = relationshipsResult.data || [];
  const images = imagesResult.data || [];

  return (pigeonsResult.data || []).map((row) => {
    const pigeonImages = images.filter((image) => image.pigeon_id === row.id);

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
        pigeonImages.find((image) => image.is_profile)?.url ||
        pigeonImages[0]?.url ||
        null,
      images: pigeonImages,
      parentIds: relationships
        .filter((relationship) => relationship.child_id === row.id)
        .map((relationship) => relationship.parent_id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export async function createPigeonInDb(pigeon) {
  const { data, error } = await supabase
    .from("pigeons")
    .insert({
      coop_id: COOP_ID,
      name: pigeon.name,
      birthday: pigeon.birthday || null,
      status: pigeon.status || "home",
      band_id: pigeon.bandId || null,
      band_color: pigeon.bandColor || null,
      sex: pigeon.sex || "unknown",
      notes: pigeon.notes || "",
      archived: false,
    })
    .select()
    .single();

  if (error) throw error;

  const parentIds = pigeon.parentIds || [];

  if (parentIds.length > 0) {
    await setPigeonParentsInDb(data.id, parentIds);
  }

  return {
    id: data.id,
    name: data.name,
    birthday: data.birthday,
    status: data.status,
    bandId: data.band_id,
    bandColor: data.band_color,
    sex: data.sex,
    notes: data.notes,
    imageUrl: null,
    images: [],
    parentIds,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updatePigeonInDb(pigeonId, updates) {
  const dbUpdates = {};

  if ("name" in updates) dbUpdates.name = updates.name;
  if ("birthday" in updates) dbUpdates.birthday = updates.birthday || null;
  if ("status" in updates) dbUpdates.status = updates.status;
  if ("bandId" in updates) dbUpdates.band_id = updates.bandId || null;
  if ("bandColor" in updates) dbUpdates.band_color = updates.bandColor || null;
  if ("sex" in updates) dbUpdates.sex = updates.sex || "unknown";
  if ("notes" in updates) dbUpdates.notes = updates.notes || "";

  const { data, error } = await supabase
    .from("pigeons")
    .update(dbUpdates)
    .eq("id", pigeonId)
    .eq("coop_id", COOP_ID)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function setPigeonParentsInDb(childId, parentIds) {
  if (parentIds.length > 2) {
    throw new Error("A pigeon cannot have more than 2 parents.");
  }

  const { error: deleteError } = await supabase
    .from("pigeon_relationships")
    .delete()
    .eq("coop_id", COOP_ID)
    .eq("child_id", childId);

  if (deleteError) throw deleteError;

  if (parentIds.length === 0) return;

  const rows = parentIds.map((parentId) => ({
    coop_id: COOP_ID,
    parent_id: parentId,
    child_id: childId,
  }));

  const { error: insertError } = await supabase
    .from("pigeon_relationships")
    .insert(rows);

  if (insertError) throw insertError;
}

export async function archivePigeonInDb(pigeonId) {
  const { error } = await supabase
    .from("pigeons")
    .update({ archived: true })
    .eq("id", pigeonId)
    .eq("coop_id", COOP_ID);

  if (error) throw error;
}
