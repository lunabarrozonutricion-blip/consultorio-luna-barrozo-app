import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";
import {
  ArrowLeft,
  Printer,
} from "lucide-react";
import { useMemo } from "react";

import { AppLayout } from "@/components/app-layout";
import { ClientOnly } from "@/components/client-only";
import { PlayerNav } from "@/components/player-nav";
import { Button } from "@/components/ui/button";

import {
  fmt,
  fmtDate,
} from "@/lib/calc";

import {
  calculateAntropogimsPresentation,
} from "@/lib/antropogims-presentation";

import {
  previousFullAnthropometry,
  useFullAnthropometries,
  useFullAnthropometry,
  usePlayer,
} from "@/lib/hooks";

import {
  FULL_ANTHROPOMETRY_GROUP_LABELS,
  FULL_ANTHROPOMETRY_MEASURES,
} from "@/lib/types";

import type {
  FiveComponentMasses,
  FullAnthropometry,
  FullAnthropometryGroup,
  FullAnthropometryMeasureKey,
} from "@/lib/types";

export const Route = createFileRoute(
  "/componentes-presentacion",
)({
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    player?: number;
    id?: number;
  } => ({
    player:
      s.player != null &&
      s.player !== ""
        ? Number(s.player)
        : undefined,

    id:
      s.id != null &&
      s.id !== ""
        ? Number(s.id)
        : undefined,
  }),

  component: () => (
    <ClientOnly>
      <PresentacionAntropometrica />
    </ClientOnly>
  ),
});

const GROUP_ORDER:
  FullAnthropometryGroup[] = [
    "basicos",
    "diametros",
    "perimetros",
    "pliegues",
  ];

const MASS_ROWS: Array<{
  key: keyof FiveComponentMasses;
  label: string;
  color: string;
}> = [
  {
    key: "adipose",
    label: "Masa adiposa",
    color: "#8b5cf6",
  },
  {
    key: "muscle",
    label: "Masa muscular",
    color: "#a63a72",
  },
  {
    key: "residual",
    label: "Masa residual",
    color: "#f4d35e",
  },
  {
    key: "bone",
    label: "Masa ósea",
    color: "#8fd3c7",
  },
  {
    key: "skin",
    label: "Masa de la piel",
    color: "#6a0572",
  },
];

function currentMeasureValue(
  anthropometry:
    FullAnthropometry,
  key:
    FullAnthropometryMeasureKey,
) {
  return (
    anthropometry.measures[
      key
    ]?.median ?? null
  );
}

function numberText(
  value:
    | number
    | null
    | undefined,
  decimals = 2,
  unit = "",
) {
  if (value == null) {
    return "—";
  }

  return `${fmt(
    value,
    decimals,
  )}${unit}`;
}

function signedText(
  value:
    | number
    | null
    | undefined,
  decimals = 2,
  unit = "",
) {
  if (value == null) {
    return "—";
  }

  const sign =
    value > 0
      ? "+"
      : "";

  return `${sign}${fmt(
    value,
    decimals,
  )}${unit}`;
}

function difference(
  current:
    | number
    | null
    | undefined,
  previous:
    | number
    | null
    | undefined,
) {
  if (
    current == null ||
    previous == null
  ) {
    return null;
  }

  const result =
    current - previous;

  return Number.isFinite(
    result,
  )
    ? result
    : null;
}

function sumMasses(
  masses:
    FiveComponentMasses,
) {
  const values = [
    masses.adipose,
    masses.muscle,
    masses.residual,
    masses.bone,
    masses.skin,
  ];

  if (
    values.some(
      (value) =>
        value == null,
    )
  ) {
    return null;
  }

  return values.reduce(
    (total, value) =>
      total +
      (value as number),
    0,
  );
}

function CompositionChart({
  masses,
}: {
  masses:
    FiveComponentMasses;
}) {
  const values =
    MASS_ROWS.map(
      (row) => ({
        ...row,
        value:
          masses[row.key] ?? 0,
      }),
    );

  const stops: string[] = [];
  let accumulated = 0;

  for (const item of values) {
    const start =
      accumulated;

    const end =
      accumulated +
      Math.max(
        0,
        item.value,
      );

    stops.push(
      `${item.color} ${start}% ${end}%`,
    );

    accumulated = end;
  }

  const gradient =
    accumulated > 0
      ? `conic-gradient(${stops.join(
          ", ",
        )})`
      : "#e5e7eb";

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:items-center">
      <div className="mx-auto flex h-[240px] w-[240px] items-center justify-center rounded-full" style={{ background: gradient }}>
        <div className="flex h-[116px] w-[116px] items-center justify-center rounded-full bg-white text-center shadow-inner">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Composición
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              100%
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {values.map(
          (item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{
                    backgroundColor:
                      item.color,
                  }}
                />

                <span className="text-sm font-medium text-slate-700">
                  {item.label}
                </span>
              </div>

              <span className="numeric text-sm font-bold text-slate-950">
                {numberText(
                  item.value,
                  2,
                  "%",
                )}
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function ComparisonCard({
  label,
  previous,
  current,
  change,
  decimals = 2,
  unit = "",
}: {
  label: string;
  previous:
    | number
    | null
    | undefined;
  current:
    | number
    | null
    | undefined;
  change:
    | number
    | null
    | undefined;
  decimals?: number;
  unit?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">
        {label}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Anterior
          </p>
          <p className="mt-1 numeric text-base font-bold text-slate-800">
            {numberText(
              previous,
              decimals,
              unit,
            )}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Actual
          </p>
          <p className="mt-1 numeric text-base font-bold text-slate-950">
            {numberText(
              current,
              decimals,
              unit,
            )}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Cambio
          </p>
          <p className="mt-1 numeric text-base font-bold text-primary">
            {signedText(
              change,
              decimals,
              unit,
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function PresentacionAntropometrica() {
  const search =
    Route.useSearch();

  const playerId =
    search.player ?? null;

  const evaluationId =
    search.id ?? null;

  const player =
    usePlayer(
      playerId,
    );

  const anthropometry =
    useFullAnthropometry(
      evaluationId,
    );

  const allAnthropometries =
    useFullAnthropometries(
      playerId,
    );

  const previous =
    previousFullAnthropometry(
      allAnthropometries,
      anthropometry,
    );

  const presentation =
    useMemo(
      () =>
        anthropometry
          ? calculateAntropogimsPresentation(
              anthropometry,
              previous,
            )
          : null,
      [
        anthropometry,
        previous,
      ],
    );

  const previousPresentation =
    useMemo(
      () =>
        previous
          ? calculateAntropogimsPresentation(
              previous,
            )
          : null,
      [previous],
    );

  if (
    playerId == null ||
    evaluationId == null
  ) {
    return (
      <AppLayout title="Presentación">
        <p className="text-sm text-muted-foreground">
          No se seleccionó una evaluación.
        </p>
      </AppLayout>
    );
  }

  if (
    !player ||
    !anthropometry ||
    !presentation
  ) {
    return (
      <AppLayout title="Presentación">
        <p className="text-sm text-muted-foreground">
          Cargando presentación…
        </p>
      </AppLayout>
    );
  }

  const currentMassTotal =
    sumMasses(
      presentation.massesKg,
    );

  const comparison = {
    muscle: {
      previous:
        previousPresentation
          ?.massesKg.muscle ??
        null,
      current:
        presentation
          .massesKg.muscle,
    },
    adipose: {
      previous:
        previousPresentation
          ?.massesKg.adipose ??
        null,
      current:
        presentation
          .massesKg.adipose,
    },
    sum6: {
      previous:
        previousPresentation
          ?.additional.sum6 ??
        null,
      current:
        presentation
          .additional.sum6,
    },
    imo: {
      previous:
        previousPresentation
          ?.additional
          .muscleBoneIndex ??
        null,
      current:
        presentation
          .additional
          .muscleBoneIndex,
    },
    zAdipose: {
      previous:
        previousPresentation
          ?.massScoreZ.adipose ??
        null,
      current:
        presentation
          .massScoreZ.adipose,
    },
  };

  return (
    <AppLayout
      title={`Composición corporal · ${player.name}`}
      subtitle="Antropometría completa · 5 componentes"
    >
      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          .print-sheet {
            border: 0 !important;
            box-shadow: none !important;
            break-inside: avoid;
          }

          body {
            background: white !important;
          }
        }
      `}</style>

      <div className="no-print">
        <PlayerNav
          playerId={playerId}
          playerName={player.name}
          current="componentes"
        />

        <div className="mb-4 mt-3 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            asChild
          >
            <Link
              to="/componentes"
              search={{
                player:
                  playerId,
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>

          <Button
            onClick={() =>
              window.print()
            }
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        <section className="print-sheet overflow-hidden rounded-xl border border-slate-300 bg-white shadow-panel">
          <div className="border-b border-slate-300 px-6 py-5 text-center">
            <h1 className="text-2xl font-bold text-slate-950">
              Informe de Composición Corporal
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Fraccionamiento corporal de 5 componentes · Kerr
            </p>
          </div>

          <div className="grid gap-3 border-b border-slate-300 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <InfoBox
              label="Jugadora"
              value={player.name}
            />

            <InfoBox
              label="Fecha"
              value={fmtDate(
                anthropometry.date,
              )}
            />

            <InfoBox
              label="N.º medición"
              value={
                anthropometry
                  .measurementNumber !=
                null
                  ? String(
                      anthropometry
                        .measurementNumber,
                    )
                  : "—"
              }
            />

            <InfoBox
              label="Evaluación anterior"
              value={
                previous
                  ? fmtDate(
                      previous.date,
                    )
                  : "Sin anterior"
              }
            />
          </div>

          <div className="p-5">
            <SectionTitle
              title="Mediciones antropométricas"
              subtitle="Valor actual, medición anterior y diferencia"
            />

            <div className="mt-4 overflow-x-auto">
              <MeasurementsTable
                anthropometry={
                  anthropometry
                }
                presentation={
                  presentation
                }
              />
            </div>
          </div>
        </section>

        <section className="print-sheet rounded-xl border border-slate-300 bg-white p-5 shadow-panel">
          <SectionTitle
            title="Composición corporal"
            subtitle="Distribución porcentual de los 5 componentes"
          />

          <div className="mt-5">
            <CompositionChart
              masses={
                presentation
                  .massPercentages
              }
            />
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-y border-slate-300 bg-slate-50 text-slate-600">
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Componente
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold">
                    Porcentaje
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold">
                    Kg
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold">
                    Score-Z
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold">
                    Dif. kg
                  </th>
                </tr>
              </thead>

              <tbody>
                {MASS_ROWS.map(
                  (row) => (
                    <tr
                      key={row.key}
                      className="border-b border-slate-200"
                    >
                      <td className="px-3 py-2.5 font-medium text-slate-800">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                row.color,
                            }}
                          />
                          {row.label}
                        </span>
                      </td>

                      <td className="numeric px-3 py-2.5 text-center">
                        {numberText(
                          presentation
                            .massPercentages[
                            row.key
                          ],
                          2,
                          "%",
                        )}
                      </td>

                      <td className="numeric px-3 py-2.5 text-center">
                        {numberText(
                          presentation
                            .massesKg[
                            row.key
                          ],
                          3,
                        )}
                      </td>

                      <td className="numeric px-3 py-2.5 text-center">
                        {numberText(
                          presentation
                            .massScoreZ[
                            row.key
                          ],
                          2,
                        )}
                      </td>

                      <td className="numeric px-3 py-2.5 text-center font-semibold">
                        {signedText(
                          presentation
                            .massDifferencesKg?.[
                            row.key
                          ],
                          3,
                        )}
                      </td>
                    </tr>
                  ),
                )}

                <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold">
                  <td className="px-3 py-2.5">
                    Masa total
                  </td>
                  <td className="numeric px-3 py-2.5 text-center">
                    100,00%
                  </td>
                  <td className="numeric px-3 py-2.5 text-center">
                    {numberText(
                      currentMassTotal,
                      3,
                    )}
                  </td>
                  <td className="numeric px-3 py-2.5 text-center">
                    {numberText(
                      presentation
                        .totalMassScoreZ,
                      2,
                    )}
                  </td>
                  <td className="numeric px-3 py-2.5 text-center">
                    {previous
                      ? signedText(
                          difference(
                            currentMassTotal,
                            previousPresentation
                              ? sumMasses(
                                  previousPresentation
                                    .massesKg,
                                )
                              : null,
                          ),
                          3,
                        )
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="print-sheet rounded-xl border border-slate-300 bg-white p-5 shadow-panel">
          <SectionTitle
            title="Comparación con la evaluación anterior"
            subtitle={
              previous
                ? `${fmtDate(
                    previous.date,
                  )} → ${fmtDate(
                    anthropometry.date,
                  )}`
                : "Todavía no hay una evaluación anterior para comparar"
            }
          />

          {previous ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ComparisonCard
                label="Masa muscular"
                previous={
                  comparison
                    .muscle
                    .previous
                }
                current={
                  comparison
                    .muscle
                    .current
                }
                change={difference(
                  comparison
                    .muscle
                    .current,
                  comparison
                    .muscle
                    .previous,
                )}
                decimals={3}
                unit=" kg"
              />

              <ComparisonCard
                label="Masa adiposa"
                previous={
                  comparison
                    .adipose
                    .previous
                }
                current={
                  comparison
                    .adipose
                    .current
                }
                change={difference(
                  comparison
                    .adipose
                    .current,
                  comparison
                    .adipose
                    .previous,
                )}
                decimals={3}
                unit=" kg"
              />

              <ComparisonCard
                label="Sumatoria de 6 pliegues"
                previous={
                  comparison.sum6
                    .previous
                }
                current={
                  comparison.sum6
                    .current
                }
                change={difference(
                  comparison.sum6
                    .current,
                  comparison.sum6
                    .previous,
                )}
                decimals={1}
                unit=" mm"
              />

              <ComparisonCard
                label="IMO · Índice músculo/óseo"
                previous={
                  comparison.imo
                    .previous
                }
                current={
                  comparison.imo
                    .current
                }
                change={difference(
                  comparison.imo
                    .current,
                  comparison.imo
                    .previous,
                )}
                decimals={3}
              />

              <ComparisonCard
                label="Z adiposo"
                previous={
                  comparison
                    .zAdipose
                    .previous
                }
                current={
                  comparison
                    .zAdipose
                    .current
                }
                change={difference(
                  comparison
                    .zAdipose
                    .current,
                  comparison
                    .zAdipose
                    .previous,
                )}
                decimals={2}
              />
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              Cuando cargues una segunda antropometría completa de esta jugadora, esta sección va a mostrar automáticamente la diferencia en masa muscular, masa adiposa, Sum6, IMO y Z adiposo.
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-950">
        {title}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}

function MeasurementsTable({
  anthropometry,
  presentation,
}: {
  anthropometry:
    FullAnthropometry;
  presentation:
    ReturnType<
      typeof calculateAntropogimsPresentation
    >;
}) {
  return (
    <table className="w-full min-w-[720px] border-collapse text-sm">
      <thead>
        <tr className="border-y border-slate-300 bg-slate-50 text-slate-600">
          <th className="px-3 py-2.5 text-left font-semibold">
            Grupo
          </th>
          <th className="px-3 py-2.5 text-left font-semibold">
            Medición
          </th>
          <th className="px-3 py-2.5 text-center font-semibold">
            Actual
          </th>
          <th className="px-3 py-2.5 text-center font-semibold">
            Anterior
          </th>
          <th className="px-3 py-2.5 text-center font-semibold">
            Diferencia
          </th>
        </tr>
      </thead>

      <tbody>
        {GROUP_ORDER.flatMap(
          (group) => {
            const definitions =
              FULL_ANTHROPOMETRY_MEASURES.filter(
                (item) =>
                  item.group ===
                  group,
              );

            return definitions.map(
              (
                definition,
                index,
              ) => {
                const current =
                  currentMeasureValue(
                    anthropometry,
                    definition.key,
                  );

                const previous =
                  presentation
                    .previousValues[
                    definition.key
                  ];

                const change =
                  presentation
                    .measurementDifferences[
                    definition.key
                  ];

                return (
                  <tr
                    key={
                      definition.key
                    }
                    className="border-b border-slate-200"
                  >
                    {index === 0 ? (
                      <td
                        rowSpan={
                          definitions.length
                        }
                        className="border-r border-slate-200 bg-slate-50 px-3 py-2.5 align-middle text-xs font-bold uppercase tracking-wide text-slate-600"
                      >
                        {
                          FULL_ANTHROPOMETRY_GROUP_LABELS[
                            group
                          ]
                        }
                      </td>
                    ) : null}

                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {definition.label}{" "}
                      <span className="text-xs font-normal text-slate-400">
                        ({definition.unit})
                      </span>
                    </td>

                    <td className="numeric px-3 py-2.5 text-center">
                      {numberText(
                        current,
                        2,
                      )}
                    </td>

                    <td className="numeric px-3 py-2.5 text-center text-slate-600">
                      {numberText(
                        previous,
                        2,
                      )}
                    </td>

                    <td className="numeric px-3 py-2.5 text-center font-semibold">
                      {signedText(
                        change,
                        2,
                      )}
                    </td>
                  </tr>
                );
              },
            );
          },
        )}
      </tbody>
    </table>
  );
}
