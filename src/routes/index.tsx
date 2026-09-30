import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardPlus,
  Database,
  FileText,
  GitCompareArrows,
  History,
  LineChart,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AppLayout } from "@/components/app-layout";
import { ClientOnly } from "@/components/client-only";
import { OfflineBadge } from "@/components/offline-badge";
import { fmtDate } from "@/lib/calc";
import { useControls, usePlayers } from "@/lib/hooks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Consultorio Nutricional · Lic. Luna Barrozo",
      },
      {
        name: "description",
        content:
          "Gestión nutricional y seguimiento antropométrico de pacientes.",
      },
      {
        property: "og:title",
        content: "Consultorio Nutricional · Lic. Luna Barrozo",
      },
      {
        property: "og:description",
        content:
          "Seguimiento nutricional, antropometría, evolución e informes de pacientes.",
      },
    ],
  }),

  component: () => (
    <ClientOnly>
      <Inicio />
    </ClientOnly>
  ),
});

const TILES = [
  {
    to: "/jugadoras",
    label: "Pacientes",
    desc: "Fichas, datos y último control",
    icon: Users,
  },
  {
    to: "/control",
    label: "Nuevo control",
    desc: "Cargar nueva medición",
    icon: ClipboardPlus,
  },
  {
    to: "/historial",
    label: "Historial",
    desc: "Todos los controles realizados",
    icon: History,
  },
  {
    to: "/comparativa",
    label: "Comparativas",
    desc: "Comparar controles",
    icon: GitCompareArrows,
  },
  {
    to: "/evolucion",
    label: "Evolución",
    desc: "Seguimiento y gráficos temporales",
    icon: LineChart,
  },
  {
    to: "/informes",
    label: "Informes",
    desc: "Generar informes personalizados",
    icon: FileText,
  },
  {
    to: "/datos",
    label: "Importar / Exportar",
    desc: "Backup y restauración de datos",
    icon: Database,
  },
] as const;

function Inicio() {
  const players = usePlayers();
  const controls = useControls();

  const [ready, setReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  const ultimo =
    controls && controls.length > 0
      ? controls[0]
      : undefined;

  useEffect(() => {
    const alreadyEntered =
      sessionStorage.getItem(
        "consultorio-luna-barrozo-entered",
      ) === "1";

    setShowWelcome(!alreadyEntered);
    setReady(true);
  }, []);

  function ingresar() {
    sessionStorage.setItem(
      "consultorio-luna-barrozo-entered",
      "1",
    );

    setShowWelcome(false);
  }

  if (!ready) {
    return null;
  }

  if (showWelcome) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 py-8">
        <div className="animate-in w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl fade-in zoom-in-95 duration-700">
          <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-accent px-6 py-10 text-white sm:px-12 sm:py-14">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/5" />
            <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-white/5" />

            <div className="relative flex flex-col items-center text-center">
              <div className="animate-in flex h-32 w-32 items-center justify-center rounded-3xl bg-white shadow-xl fade-in zoom-in-90 duration-700 sm:h-36 sm:w-36">
                <span className="font-display text-4xl font-bold tracking-tight text-primary sm:text-5xl">
                  LB
                </span>
              </div>

              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
                Consultorio privado
              </p>

              <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-wide text-white sm:text-5xl">
                Consultorio Nutricional
              </h1>

              <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-white/30" />

              <p className="mt-5 text-base font-semibold text-white sm:text-lg">
                Lic. Luna Barrozo
              </p>

              <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/70">
                Gestión integral de pacientes, controles
                antropométricos, evolución nutricional e informes.
              </p>

              <button
                type="button"
                onClick={ingresar}
                className="mt-8 inline-flex min-w-[220px] items-center justify-center rounded-xl bg-white px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-primary shadow-lg transition-all duration-200 hover:scale-[1.02] hover:bg-white/95 active:scale-[0.98]"
              >
                Ingresar al consultorio
              </button>
            </div>
          </div>

          <div className="flex h-2">
            <div className="w-2/3 bg-primary" />
            <div className="w-1/3 bg-accent" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout title="Inicio">
      <div className="mb-5 overflow-hidden rounded-xl border border-border bg-card shadow-panel">
        <div className="flex flex-col items-center gap-4 bg-gradient-to-r from-primary to-accent px-6 py-5 text-center text-white sm:flex-row sm:text-left">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-white shadow">
            <span className="font-display text-2xl font-bold text-primary">
              LB
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              Consultorio privado
            </p>

            <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">
              Consultorio Nutricional
            </h2>

            <p className="mt-1 text-sm font-semibold text-white/90">
              Lic. Luna Barrozo
            </p>

            <p className="mt-1 text-sm text-white/70">
              Seguimiento nutricional y antropométrico
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Pacientes"
          value={
            players
              ? String(players.length)
              : "—"
          }
        />

        <Stat
          label="Controles cargados"
          value={
            controls
              ? String(controls.length)
              : "—"
          }
        />

        <Stat
          label="Último control"
          value={fmtDate(ultimo?.date)}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TILES.map((t) => {
          const Icon = t.icon;

          return (
            <Link
              key={t.to}
              to={t.to}
              className="group rounded-lg border border-border bg-card p-4 shadow-panel transition-all duration-200 hover:-translate-y-0.5 hover:border-accent"
            >
              <Icon className="h-5 w-5 text-accent" />

              <p className="mt-3 font-display text-base font-semibold uppercase tracking-wide">
                {t.label}
              </p>

              <p className="text-sm text-muted-foreground">
                {t.desc}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="mt-5 max-w-md">
        <OfflineBadge />
      </div>
    </AppLayout>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-panel">
      <p className="panel-title text-xs text-muted-foreground">
        {label}
      </p>

      <p className="numeric mt-1 font-display text-2xl font-bold">
        {value}
      </p>
    </div>
  );
}
