import { supabase } from "@/lib/supabaseClient";
import { COOP_ID } from "@/lib/constants";

// Cache key stores { userId, isAdmin } so we can fall back even when the
// Supabase session has been cleared offline (expired JWT).
const ADMIN_CACHE_KEY = `pigedex_admin_${COOP_ID}`;

function readAdminCache() {
  try {
    const raw = localStorage.getItem(ADMIN_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw); // { userId, isAdmin }
  } catch {
    return null;
  }
}

function writeAdminCache(userId, isAdmin) {
  try {
    localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify({ userId, isAdmin }));
  } catch {
    // Private mode or storage full — not critical
  }
}

function clearAdminCache() {
  try {
    localStorage.removeItem(ADMIN_CACHE_KEY);
  } catch {}
}

export async function signInAdmin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  return data;
}

export async function signOutAdmin() {
  clearAdminCache();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getIsCoopAdmin() {
  // getSession() reads from localStorage — works offline.
  const session = await getCurrentSession().catch(() => null);

  if (session) {
    // Session exists — try the live network check.
    const { data, error } = await supabase
      .from("coop_members")
      .select("role")
      .eq("coop_id", COOP_ID)
      .eq("user_id", session.user.id)
      .single();

    if (!error) {
      // Online: cache the fresh result and return it.
      const isAdmin = data?.role === "owner" || data?.role === "admin";
      writeAdminCache(session.user.id, isAdmin);
      return isAdmin;
    }

    // Network failure with valid session — use cached value for this user.
    const cached = readAdminCache();
    if (cached?.userId === session.user.id) return cached.isAdmin;
    return false;
  }

  // No session at all (JWT may have expired while offline).
  // Trust the cache only when offline — if online, the user truly isn't signed in.
  if (!navigator.onLine) {
    const cached = readAdminCache();
    if (cached) return cached.isAdmin;
  }

  return false;
}
