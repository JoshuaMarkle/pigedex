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

const STORAGE_BUCKET = "pigeon-images";

const MIME_TO_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export async function uploadPigeonImage(pigeonId, file, isProfile = false) {
  const ext = MIME_TO_EXT[file.type] ?? file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${pigeonId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file);
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

  // Determine next sort_order
  const { data: existing } = await supabase
    .from("pigeon_images")
    .select("sort_order")
    .eq("pigeon_id", pigeonId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSort = (existing?.[0]?.sort_order ?? 0) + 1;

  if (isProfile) {
    await supabase
      .from("pigeon_images")
      .update({ is_profile: false })
      .eq("pigeon_id", pigeonId)
      .eq("coop_id", COOP_ID);
  }

  const { data, error } = await supabase
    .from("pigeon_images")
    .insert({
      coop_id: COOP_ID,
      pigeon_id: pigeonId,
      url: publicUrl,
      is_profile: isProfile,
      sort_order: nextSort,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setPigeonProfileImage(imageId, pigeonId) {
  await supabase
    .from("pigeon_images")
    .update({ is_profile: false })
    .eq("pigeon_id", pigeonId)
    .eq("coop_id", COOP_ID);

  const { error } = await supabase
    .from("pigeon_images")
    .update({ is_profile: true })
    .eq("id", imageId)
    .eq("coop_id", COOP_ID);
  if (error) throw error;
}

export async function deletePigeonImage(imageId, imageUrl) {
  const parts = imageUrl.split(`/${STORAGE_BUCKET}/`);
  const storagePath = parts[1];
  if (storagePath) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
  }

  const { error } = await supabase
    .from("pigeon_images")
    .delete()
    .eq("id", imageId)
    .eq("coop_id", COOP_ID);
  if (error) throw error;
}

export async function archivePigeonInDb(pigeonId) {
  const { error } = await supabase
    .from("pigeons")
    .update({ archived: true })
    .eq("id", pigeonId)
    .eq("coop_id", COOP_ID);

  if (error) throw error;
}

export async function deletePigeonInDb(pigeonId) {
  // Delete all images from storage and the images table
  const { data: images } = await supabase
    .from("pigeon_images")
    .select("id, url")
    .eq("pigeon_id", pigeonId)
    .eq("coop_id", COOP_ID);

  if (images?.length) {
    const storagePaths = images
      .map((img) => img.url.split(`/${STORAGE_BUCKET}/`)[1])
      .filter(Boolean);
    if (storagePaths.length) {
      await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths);
    }
    await supabase
      .from("pigeon_images")
      .delete()
      .eq("pigeon_id", pigeonId)
      .eq("coop_id", COOP_ID);
  }

  // Delete relationships where this pigeon is a parent or child
  await supabase
    .from("pigeon_relationships")
    .delete()
    .eq("coop_id", COOP_ID)
    .or(`parent_id.eq.${pigeonId},child_id.eq.${pigeonId}`);

  const { error } = await supabase
    .from("pigeons")
    .delete()
    .eq("id", pigeonId)
    .eq("coop_id", COOP_ID);

  if (error) throw error;
}
