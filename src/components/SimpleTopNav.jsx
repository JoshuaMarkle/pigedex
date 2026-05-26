import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SimpleTopNav() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home" },
    { href: "/flights", label: "Flights" },
    { href: "/catalog", label: "Catalog" },
  ];

  function isActive(href) {
    if (href === pathname) return true;
    // Pigeon detail pages live under Catalog
    if (href === "/catalog" && pathname.startsWith("/pigeons/")) return true;
    return false;
  }

  return (
    <nav className="absolute top-4 left-0 z-10 w-full">
      <div className="absolute left-1/2 -translate-x-1/2 rounded-lg ring-2 ring-ring border-b-4 bg-white/90 px-2 py-2 shadow-md backdrop-blur transition-all hover:scale-105">
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
    </nav>
  );
}
