import { supabase } from "@/lib/supabaseClient";
import { COOP_ID } from "@/lib/constants";

export async function signInAdmin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  return data;
}

export async function signOutAdmin() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  return data.session;
}

export async function getIsCoopAdmin() {
  const session = await getCurrentSession();

  if (!session) return false;

  const { data, error } = await supabase
    .from("coop_members")
    .select("role")
    .eq("coop_id", COOP_ID)
    .eq("user_id", session.user.id)
    .single();

  if (error) return false;

  return data?.role === "owner" || data?.role === "admin";
}
