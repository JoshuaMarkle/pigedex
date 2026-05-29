"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { IoSettingsOutline } from "react-icons/io5";
import { IoPersonOutline } from "react-icons/io5";

import { Button } from "@/components/ui/button";
import AdminLoginDialog from "@/components/dialogs/AdminLoginDialog";
import FlightSettingsDialog from "@/components/dialogs/FlightSettingsDialog";
import { getIsCoopAdmin } from "@/lib/auth";
import { fetchCoopSettings } from "@/lib/flightDb";
import { supabase } from "@/lib/supabaseClient";

const links = [
  { href: "/", label: "Home" },
  { href: "/flights", label: "Flights" },
  { href: "/catalog", label: "Catalog" },
];

export default function TopNav({ onAdd, onAdminChange, onSettingsChange }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [coopSettings, setCoopSettings] = useState(null);
  const pendingAdd = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mounted) return;
        const admin = session ? await getIsCoopAdmin() : false;
        if (mounted) {
          setIsAdmin(admin ?? false);
          onAdminChange?.(admin ?? false);
        }
      } catch {
        if (mounted) {
          setIsAdmin(false);
          onAdminChange?.(false);
        }
      }

      try {
        const settings = await fetchCoopSettings();
        if (mounted) {
          setCoopSettings(settings);
          onSettingsChange?.(settings);
        }
      } catch {}
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (!session || event === "SIGNED_OUT") {
        setIsAdmin(false);
        onAdminChange?.(false);
        return;
      }
      const admin = await getIsCoopAdmin();
      if (mounted) {
        setIsAdmin(admin ?? false);
        onAdminChange?.(admin ?? false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLeftButton() {
    if (isAdmin) {
      setShowSettings(true);
    } else {
      setShowLogin(true);
    }
  }

  function handleAddClick() {
    if (!onAdd) return;
    if (isAdmin) {
      onAdd();
    } else {
      pendingAdd.current = true;
      setShowLogin(true);
    }
  }

  function handleLogin() {
    setIsAdmin(true);
    onAdminChange?.(true);
    if (pendingAdd.current) {
      pendingAdd.current = false;
      onAdd?.();
    }
  }

  function handleSettingsSave(newSettings) {
    setCoopSettings(newSettings);
    onSettingsChange?.(newSettings);
  }

  function isActive(href) {
    return href === pathname;
  }

  return (
    <>
      <nav className="absolute top-4 left-0 z-10 w-full">
        {/* Center pill */}
        <div className="absolute left-1/2 -translate-x-1/2 rounded-lg ring-2 ring-ring border-b-4 bg-white/90 px-2 py-2 shadow-md backdrop-blur transition-all hover:scale-102">
          <div className="flex items-center gap-1">
            {links.map((link) =>
              isActive(link.href) ? (
                <span
                  key={link.href}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  {link.label}
                </span>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ),
            )}
          </div>
        </div>

        {/* Left: account / settings */}
        <Button
          type="button"
          onClick={handleLeftButton}
          className="absolute right-1/2 mr-34 h-[56px] w-[56px] rounded-lg border-0 border-b-4 border-dot bg-white p-0 ring-2 ring-ring shadow-md backdrop-blur hover:scale-105 text-muted-foreground hover:text-primary"
          aria-label={isAdmin ? "Settings" : "Sign in"}
          title={isAdmin ? "Settings" : "Sign in"}
        >
          {isAdmin ? (
            <IoSettingsOutline className="size-6" />
          ) : (
            <IoPersonOutline className="size-6" />
          )}
        </Button>

        {/* Right: add button (only when an add action is provided) */}
        {onAdd !== undefined && (
          <Button
            type="button"
            onClick={handleAddClick}
            className="absolute left-1/2 ml-34 h-[56px] w-[56px] rounded-lg border-0 border-b-4 border-dot bg-white p-0 text-muted-foreground ring-2 ring-ring shadow-md backdrop-blur hover:scale-105 hover:text-primary"
            aria-label="Add"
          >
            <Plus className="size-5" />
          </Button>
        )}
      </nav>

      <AdminLoginDialog
        open={showLogin}
        onOpenChange={setShowLogin}
        onLogin={handleLogin}
      />

      <FlightSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        coopSettings={coopSettings}
        isAdmin={!!isAdmin}
        onSave={handleSettingsSave}
      />
    </>
  );
}
