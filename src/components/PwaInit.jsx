"use client";

import { useEffect } from "react";
import { initSyncListeners } from "@/lib/syncEngine";

export default function PwaInit() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("SW registration failed:", err));
    }

    const cleanup = initSyncListeners();
    return cleanup;
  }, []);

  return null;
}
