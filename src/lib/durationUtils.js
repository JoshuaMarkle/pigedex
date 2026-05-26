// ── Flight-time duration utilities ─────────────────────────────────────────
// Format: "Xd Xh Xm Xs"  e.g.  "1d 2h 30m 15s", "3h 45m", "2h"
// Stored in DB as: returned_at = flight_date (UTC midnight) + duration seconds

/**
 * Parse a duration string like "2h 30m" into total seconds.
 * Returns null if the string is empty or unrecognisable.
 */
export function parseDurationToSeconds(str) {
  if (!str?.trim()) return null;
  const s = str.trim().toLowerCase();
  let total = 0;
  const d = s.match(/(\d+)\s*d/);
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m(?!s)/); // 'm' not followed by 's' (avoid 'ms')
  const sec = s.match(/(\d+)\s*s/);
  if (d) total += parseInt(d[1], 10) * 86400;
  if (h) total += parseInt(h[1], 10) * 3600;
  if (m) total += parseInt(m[1], 10) * 60;
  if (sec) total += parseInt(sec[1], 10);
  return total > 0 ? total : null;
}

/**
 * Format total seconds as a human-readable duration string.
 * e.g. 5415 → "1h 30m 15s"
 */
export function formatSecondsAsDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return "";
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(" ");
}

/**
 * Compute the returned_at ISO timestamp from a flight date + duration seconds.
 * Uses UTC midnight of the flight date as origin.
 */
export function durationToReturnedAt(flightDateStr, durationSeconds) {
  if (!flightDateStr || !durationSeconds) return null;
  const [year, month, day] = flightDateStr.split("-").map(Number);
  const base = Date.UTC(year, month - 1, day, 0, 0, 0);
  return new Date(base + durationSeconds * 1000).toISOString();
}

/**
 * Compute duration in seconds from a flight date and a returned_at timestamp.
 * Returns null if either is missing or the result is negative.
 */
export function returnedAtToDurationSeconds(flightDateStr, returnedAtStr) {
  if (!flightDateStr || !returnedAtStr) return null;
  const [year, month, day] = flightDateStr.split("-").map(Number);
  const base = Date.UTC(year, month - 1, day, 0, 0, 0);
  const returned = new Date(returnedAtStr).getTime();
  const diff = Math.round((returned - base) / 1000);
  return diff > 0 ? diff : null;
}
