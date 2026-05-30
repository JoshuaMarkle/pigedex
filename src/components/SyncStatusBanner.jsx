"use client";

import { useEffect, useState } from "react";
import { pendingOpsCount } from "@/lib/syncEngine";

export default function SyncStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Initialise with current state
    setIsOnline(navigator.onLine);

    function onOnline() {
      setIsOnline(true);
    }
    function onOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Poll pending ops count every 5 seconds when online (cheap IDB read)
  useEffect(() => {
    async function check() {
      try {
        const count = await pendingOpsCount();
        setPendingCount(count);
      } catch {
        setPendingCount(0);
      }
    }

    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-xs font-medium shadow-lg backdrop-blur ${
        !isOnline
          ? "bg-red-500/90 text-white"
          : "bg-amber-400/90 text-amber-900"
      }`}
    >
      {!isOnline ? "Offline" : `${pendingCount} unsynced change${pendingCount === 1 ? "" : "s"}`}
    </div>
  );
}
