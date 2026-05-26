"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PiBirdBold } from "react-icons/pi";

import { fetchPigeonsWithParents } from "@/lib/pigeonDb";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function parseBirthday(value) {
  if (!value) return null;

  // Current project format appears to be MM-dd-yyyy.
  const parts = value.split("-");
  if (parts.length !== 3) return null;

  const [month, day, year] = parts.map(Number);
  if (!month || !day || !year) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatBirthdayLabel(birthday) {
  const date = parseBirthday(birthday);
  if (!date) return "Unknown";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getAgeLabel(birthday) {
  const birthDate = parseBirthday(birthday);
  if (!birthDate) return "Unknown";

  const today = new Date();
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const days = Math.max(
    0,
    Math.floor((today - birthDate) / millisecondsPerDay),
  );

  if (days < 14) {
    return `${days} ${days === 1 ? "day" : "days"}`;
  }

  if (days < 56) {
    const weeks = Math.floor(days / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  }

  if (days < 366) {
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? "month" : "months"}`;
  }

  const years = Math.floor(days / 365);
  const remainingMonths = Math.floor((days % 365) / 30);

  if (remainingMonths <= 0) {
    return `${years} ${years === 1 ? "year" : "years"}`;
  }

  return `${years} ${years === 1 ? "year" : "years"} ${remainingMonths} ${
    remainingMonths === 1 ? "month" : "months"
  }`;
}

function getBirthdayThisYear(birthday) {
  const birthDate = parseBirthday(birthday);
  if (!birthDate) return null;

  const today = new Date();
  return new Date(
    today.getFullYear(),
    birthDate.getMonth(),
    birthDate.getDate(),
  );
}

function isSameMonthAndDay(dateA, dateB) {
  return (
    dateA.getMonth() === dateB.getMonth() && dateA.getDate() === dateB.getDate()
  );
}

function getDaysUntilBirthday(birthday) {
  const birthdayThisYear = getBirthdayThisYear(birthday);
  if (!birthdayThisYear) return null;

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  let nextBirthday = birthdayThisYear;

  if (nextBirthday < todayStart) {
    nextBirthday = new Date(
      todayStart.getFullYear() + 1,
      birthdayThisYear.getMonth(),
      birthdayThisYear.getDate(),
    );
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.round((nextBirthday - todayStart) / millisecondsPerDay);
}

function getNextBirthday(pigeons) {
  const pigeonsWithBirthdays = pigeons
    .map((pigeon) => ({
      pigeon,
      daysUntil: getDaysUntilBirthday(pigeon.birthday),
      birthDate: parseBirthday(pigeon.birthday),
    }))
    .filter((item) => item.daysUntil !== null && item.birthDate);

  if (pigeonsWithBirthdays.length === 0) {
    return null;
  }

  const fewestDays = Math.min(
    ...pigeonsWithBirthdays.map((item) => item.daysUntil),
  );

  const matchingPigeons = pigeonsWithBirthdays
    .filter((item) => item.daysUntil === fewestDays)
    .sort((a, b) => a.birthDate.getTime() - b.birthDate.getTime())
    .map((item) => item.pigeon);

  return {
    daysUntil: fewestDays,
    pigeons: matchingPigeons,
    birthday: matchingPigeons[0]?.birthday || null,
  };
}

function getNextBirthdayTitle(nextBirthday) {
  if (!nextBirthday) return "Unknown";

  if (nextBirthday.daysUntil === 0) {
    return "Today!";
  }

  if (nextBirthday.daysUntil === 1) {
    return "1 day";
  }

  return `${nextBirthday.daysUntil} days`;
}

function getNextBirthdaySubtitle(nextBirthday) {
  if (!nextBirthday) return "No birthdays set";

  const names = nextBirthday.pigeons
    .map((pigeon) => pigeon.name || "Unnamed bird")
    .join(", ");

  return `${names} · ${formatBirthdayLabel(nextBirthday.birthday)}`;
}

function getStatusLabel(status) {
  if (status === "home") return "Home";
  if (status === "flying") return "Flying";
  if (status === "lost") return "Lost";
  return "Unknown";
}

function getStatusClass(status) {
  if (status === "home") return "bg-green-100 text-green-800";
  if (status === "flying") return "bg-blue-100 text-blue-800";
  if (status === "lost") return "bg-red-100 text-red-800";
  return "bg-muted text-muted-foreground";
}

function sortPigeons(pigeons, sortBy) {
  const sorted = [...pigeons];

  sorted.sort((a, b) => {
    if (sortBy === "birthday-newest") {
      const dateA = parseBirthday(a.birthday);
      const dateB = parseBirthday(b.birthday);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateB.getTime() - dateA.getTime();
    }

    if (sortBy === "birthday-oldest") {
      const dateA = parseBirthday(a.birthday);
      const dateB = parseBirthday(b.birthday);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateA.getTime() - dateB.getTime();
    }

    if (sortBy === "name-az") {
      return (a.name || "").localeCompare(b.name || "");
    }

    if (sortBy === "name-za") {
      return (b.name || "").localeCompare(a.name || "");
    }

    if (sortBy === "status") {
      return (a.status || "").localeCompare(b.status || "");
    }

    return 0;
  });

  return sorted;
}

function CatalogCard({ pigeon }) {
  return (
    <Link href={`/pigeons/${pigeon.id}`} className="block">
      <Card className="h-full border-b-4 transition-transform hover:-translate-y-1 hover:shadow-md">
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <Avatar className="h-14 w-14">
            <AvatarImage src={pigeon.imageUrl || ""} />
            <AvatarFallback>
              <PiBirdBold className="size-6" />
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-lg">
              {pigeon.name || "Unnamed bird"}
            </CardTitle>

            <p className="text-sm text-muted-foreground">
              {pigeon.bandId || "Unbanded"}
              {pigeon.bandColor && pigeon.bandColor !== "none"
                ? ` (${pigeon.bandColor})`
                : ""}
            </p>
          </div>

          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(
              pigeon.status,
            )}`}
          >
            {getStatusLabel(pigeon.status)}
          </span>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Age</p>
              <p className="font-medium">{getAgeLabel(pigeon.birthday)}</p>
            </div>

            <div>
              <p className="text-muted-foreground">Birthday</p>
              <p className="font-medium">
                {formatBirthdayLabel(pigeon.birthday)}
              </p>
            </div>
          </div>

          {pigeon.notes ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {pigeon.notes}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function StatCard({ label, value, detail }) {
  return (
    <Card>
      <CardContent className="px-5">
        <p className="text-sm text-muted-foreground">{label}</p>

        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-3xl font-bold">{value}</p>
          {detail ? (
            <p className="text-sm text-muted-foreground">{detail}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function BirthdayStatCard({ nextBirthday }) {
  const names =
    nextBirthday?.pigeons
      ?.map((pigeon) => pigeon.name || "Unnamed bird")
      .join(", ") || "No birthdays set";

  return (
    <Card>
      <CardContent className="flex h-full items-center justify-between gap-6 px-6">
        <div className="min-w-[96px] shrink-0">
          <p className="text-sm text-muted-foreground">Next birthday</p>

          <p className="mt-1 whitespace-nowrap text-3xl font-bold leading-tight">
            {getNextBirthdayTitle(nextBirthday)}
          </p>
        </div>

        <div className="min-w-0 flex-1 mt-auto text-sm text-muted-foreground">
          <p className="line-clamp-2">{names}</p>

          <p className="mt-1 whitespace-nowrap">
            {nextBirthday
              ? `/ ${formatBirthdayLabel(nextBirthday.birthday)}`
              : "Unknown"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CatalogPage() {
  const [pigeons, setPigeons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("birthday-newest");

  useEffect(() => {
    let mounted = true;

    async function loadPigeons() {
      try {
        setLoading(true);
        setLoadError("");

        const loadedPigeons = await fetchPigeonsWithParents();

        if (mounted) {
          setPigeons(loadedPigeons);
        }
      } catch (error) {
        console.error("loadPigeons failed:", error);

        if (mounted) {
          setLoadError(error?.message || "Failed to load pigeons.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPigeons();

    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const totalPigeons = pigeons.length;
    const pigeonsHome = pigeons.filter(
      (pigeon) => pigeon.status === "home",
    ).length;

    return {
      pigeonsHome,
      totalPigeons,
      successfulFlights: 0,
      totalFlights: 0,
      nextBirthday: getNextBirthday(pigeons),
    };
  }, [pigeons]);

  const visiblePigeons = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    const filtered = pigeons.filter((pigeon) => {
      const matchesStatus =
        statusFilter === "all" || pigeon.status === statusFilter;

      const matchesSearch =
        !searchValue ||
        pigeon.name?.toLowerCase().includes(searchValue) ||
        pigeon.bandId?.toLowerCase().includes(searchValue) ||
        pigeon.birthday?.toLowerCase().includes(searchValue) ||
        pigeon.notes?.toLowerCase().includes(searchValue);

      return matchesStatus && matchesSearch;
    });

    return sortPigeons(filtered, sortBy);
  }, [pigeons, search, statusFilter, sortBy]);

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <h1 className="text-2xl font-semibold m-0">Catalog</h1>
        <p className="text-muted-foreground">
          See the whole family in one place
        </p>
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Pigeons home"
            value={stats.pigeonsHome}
            detail={`/ ${stats.totalPigeons} total`}
          />

          <StatCard
            label="Successful flights"
            value={stats.successfulFlights}
            detail={`/ ${stats.totalFlights} total`}
          />

          <BirthdayStatCard nextBirthday={stats.nextBirthday} />
        </section>

        <Card>
          <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_180px_220px]">
            <div className="space-y-2">
              <Label htmlFor="catalog-search">Search</Label>
              <Input
                id="catalog-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, band ID, birthday, notes..."
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="flying">Flying</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sort</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort pigeons" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="birthday-newest">
                    Birthday, newest first
                  </SelectItem>
                  <SelectItem value="birthday-oldest">
                    Birthday, oldest first
                  </SelectItem>
                  <SelectItem value="name-az">Name, A to Z</SelectItem>
                  <SelectItem value="name-za">Name, Z to A</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Loading pigeons...
            </CardContent>
          </Card>
        ) : null}

        {loadError ? (
          <Card>
            <CardContent className="p-8 text-center text-red-600">
              {loadError}
            </CardContent>
          </Card>
        ) : null}

        {!loading && !loadError && visiblePigeons.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No pigeons match your filters.
            </CardContent>
          </Card>
        ) : null}

        {!loading && !loadError && visiblePigeons.length > 0 ? (
          <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePigeons.map((pigeon) => (
              <CatalogCard key={pigeon.id} pigeon={pigeon} />
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
