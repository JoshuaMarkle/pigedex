import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlaneTakeoff } from "lucide-react";
import { IoSettingsOutline } from "react-icons/io5";
import { FaCircleInfo } from "react-icons/fa6";

import { Button } from "@/components/ui/button";

export default function FlightsTopNav({ onOpenSettings, onAddFlight, isAdmin }) {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home" },
    { href: "/flights", label: "Flights" },
    { href: "/catalog", label: "Catalog" },
  ];

  return (
    <nav className="absolute top-4 left-0 z-10 w-full">
      {/* Centre pill — nav links */}
      <div className="absolute left-1/2 -translate-x-1/2 rounded-lg ring-2 ring-ring border-b-4 bg-white/90 px-2 py-2 shadow-md backdrop-blur transition-all hover:scale-105">
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return active ? (
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
            );
          })}
        </div>
      </div>

      {/* Left button — coop settings */}
      <Button
        type="button"
        onClick={onOpenSettings}
        className="absolute right-1/2 mr-36 h-[56px] w-[62px] rounded-lg border-0 border-b-4 border-dot bg-white p-0 text-muted-foreground ring-2 ring-ring shadow-md backdrop-blur hover:scale-105 hover:text-primary"
        aria-label="Coop settings"
        title="Coop settings"
      >
        <IoSettingsOutline className="size-6" />
      </Button>

      {/* Right button — add flight */}
      <Button
        type="button"
        onClick={onAddFlight}
        className="absolute left-1/2 ml-36 h-[56px] w-[62px] rounded-lg border-0 border-b-4 border-dot bg-white p-0 text-muted-foreground ring-2 ring-ring shadow-md backdrop-blur hover:scale-105 hover:text-primary"
        aria-label="Log a flight"
        title="Log a flight"
      >
        <PlaneTakeoff className="size-5" />
      </Button>

      {/* Not signed in indicator */}
      {!isAdmin && (
        <div className="absolute left-1/2 -translate-x-1/2 flex row gap-2 items-center mt-16 p-1 px-2 rounded-lg ring-2 text-sm text-accent-foreground ring-blue/50 bg-blue-bg/50">
          <FaCircleInfo className="text-blue" /> Not signed in
        </div>
      )}
    </nav>
  );
}
