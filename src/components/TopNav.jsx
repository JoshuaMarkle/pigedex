import Link from "next/link";
import { usePathname } from "next/navigation";
import { PiBird } from "react-icons/pi";
import { IoPersonOutline } from "react-icons/io5";

import { Button } from "@/components/ui/button";

// ----- Nav ----- //

export default function TopNav({ onCreateBird, onOpenAdmin, isAdmin }) {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home" },
    { href: "/flights", label: "Flights" },
    { href: "/catalog", label: "Catalog" },
  ];

  return (
    <nav className="absolute top-4 left-0 z-10 w-full">
      <div className="absolute left-1/2 -translate-x-1/2 rounded-lg ring-2 ring-ring border-b-4 bg-white/90 px-2 py-2 shadow-md backdrop-blur transition-all hover:scale-105">
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const active = pathname === link.href;

            if (active) {
              return (
                <span
                  key={link.href}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  {link.label}
                </span>
              );
            }

            return (
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

      <Button
        type="button"
        onClick={onCreateBird}
        className="absolute left-1/2 ml-36 h-[56px] w-[62px] rounded-lg border-0 border-b-4 border-dot bg-white p-0 text-muted-foreground ring-2 ring-ring shadow-md backdrop-blur hover:scale-105 hover:text-primary"
        aria-label="Add new bird"
      >
        <PiBird className="size-6" />
      </Button>

      <Button
        type="button"
        onClick={onOpenAdmin}
        className={`absolute right-1/2 mr-36 h-[56px] w-[62px] rounded-lg border-0 border-b-4 border-dot bg-white p-0 ring-2 ring-ring shadow-md backdrop-blur hover:scale-105 hover:text-primary ${
          isAdmin ? "text-primary" : "text-muted-foreground"
        }`}
        aria-label="Admin settings"
        title={isAdmin ? "Admin connected" : "Admin settings"}
      >
        <IoPersonOutline className="size-6" />
      </Button>
    </nav>
  );
}
