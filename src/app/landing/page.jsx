"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { GitFork, PlaneTakeoff, Library } from "lucide-react";
import { FaGithub } from "react-icons/fa";

import { Card, CardContent } from "@/components/ui/card";

// React Flow needs the browser — skip SSR for the demo tree.
const DemoFamilyTree = dynamic(
  () => import("@/components/landing/DemoFamilyTree"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] w-full animate-pulse rounded-xl bg-muted/40" />
    ),
  },
);

// ── Feature card ──────────────────────────────────────────────────────────────

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <Card>
      <CardContent className="space-y-3 py-2">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-bg/50 text-blue border-2 border-blue/50">
            <Icon className="size-5" />
          </div>
          <h3 className="font-heading text-lg font-medium leading-none">
            {title}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ── */}
      <header className="relative isolate grid place-items-center overflow-hidden bg-background px-6 p-32 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10 mx-auto w-8xl bg-[radial-gradient(circle,var(--color-dot)_2px,transparent_2px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_at_50%_30%,blue_50%,transparent_65%)] [-webkit-mask-image:radial-gradient(ellipse_at_50%_30%,blue_50%,transparent_65%)]" />

        <div className="space-y-8">
          <h1
            data-text="Every pigeon, confidently managed all in one place."
            className="relative inline-block text-[clamp(2.5rem,1.757rem+3.05vw,4.5rem)] font-medium leading-none -rotate-1 tracking-tight text-foreground before:absolute before:inset-0 before:-z-10 before:content-[attr(data-text)] before:text-white before:[-webkit-text-stroke:16px_white] before:[paint-order:stroke_fill] before:drop-shadow-[0px_2px_5px_rgb(0_0_0_/_0.25)]"
          >
            <span className="text-blue">Every pigeon, </span>
            confidently
            <br />
            managed all in one place.
          </h1>

          <p className="text-xl font-medium text-muted-foreground">
            Pigedex is the all in one platform for modern loft management.
          </p>

          <Link
            href="/"
            className="mt-8 inline-block p-2 px-16 rounded-full shadow-lg font-medium text-white bg-blue hover:bg-blue/80 border-6 border-white rotate-1 hover:rotate-0 transition-all"
          >
            Start now
          </Link>
        </div>
      </header>

      {/* ── Demo family tree ── */}
      <section className="bg-background px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight">
              See your <span className="text-blue">whole family</span>
            </h2>
            <p className="mt-3 text-muted-foreground">
              Generations, parents, and siblings — laid out automatically.
            </p>
          </div>

          <DemoFamilyTree />
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-background px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight">
              Everything you need
            </h2>
            <p className="mt-3 text-muted-foreground">
              Built for hobbyists who care about their birds.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              icon={GitFork}
              title="Family tree"
              description="Visualize generations of birds. Track parents, siblings, and offspring at a glance."
            />
            <FeatureCard
              icon={PlaneTakeoff}
              title="Flight tracking"
              description="Log every release with maps, distances, and per-bird return times."
            />
            <FeatureCard
              icon={Library}
              title="Catalog"
              description="Every pigeon in one searchable list with band IDs, birthdays, and notes."
            />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t bg-background px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Pigedex</span>

          <a
            href="https://github.com/JoshuaMarkle/pigedex"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <FaGithub className="size-4" />
            JoshuaMarkle/pigedex
          </a>
        </div>
      </footer>
    </>
  );
}
