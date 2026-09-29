import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";
import {
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
  createFiveComponentsReportPdf,
} from "@/lib/five-components-report-pdf";

import {
  deleteFullAnthropometry,
} from "@/lib/db";

import {
  previousFullAnthropometry,
  useFullAnthropometries,
  usePlayer,
} from "@/lib/hooks";

import { shareFile } from "@/lib/share-file";

import {
  FULL_ANTHROPOMETRY_MEASURES,
} from "@/lib/types";

import type {
  FiveComponentMasses,
  FullAnthropometry,
} from "@/lib/types";

export const Route = createFileRoute(
  "/componentes",
)({
  validateSearch: (
    s: Record<string, unknown>,
  ): { player?: number } => ({
    player:
      s.player != null &&
      s.player !== ""
        ? Number(s.player)
        : undefined,
  }),

  head: () => ({
    meta: [
      {
        title:
          "5 componentes – Seguimiento Antropométrico CASLA",
      },
      {
        name: "description",
        content:
          "Evaluaciones antropométricas completas y fraccionamiento corporal en cinco componentes.",
      },
    ],
  }),

  component: () => (
    <ClientOnly>
      <CincoComponentes />
    </ClientOnly>
  ),
});

const MASS_ROWS: Array<{
  key: keyof FiveComponentMasses;
  label: string;
}> = [
  {
    key: "adipose",
    label: "Masa adiposa",
  },
  {
    key: "muscle",
    label: "Masa muscular",
  },
  {
    key: "residual",
    label: "Masa residual",
  },
  {
    key: "bone",
    label: "Masa ósea",
  },
  {
    key: "skin",
    label: "Masa de la piel",
  },
];

function finalMasses(
  anthropometry:
    FullAnthropometry,
): FiveComponentMasses | null {
  const results =
    anthropometry.results;

  if (!results) {
    return null;
  }

  return (
    results
      .boneReferenceAdjustedMassesKg ??
    results.weightAdjustedMassesKg
  );
}

function sourceLabel(
  source:
    FullAnthropometry["source"],
) {
  return source ===
    "antropogims"
    ? "Antropogims"
    : "Carga manual";
}

function pdfValue(
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

function CincoComponentes() {
  const search =
    Route.useSearch();

  const playerId =
    search.player ?? null;

  const player =
    usePlayer(playerId);

  const anthropometries =
    useFullAnthropometries(
      playerId,
    );

  const [
    sharingId,
    setSharingId,
  ] = useState<
    number | null
  >(null);

  const [
    deletingId,
    setDeletingId,
  ] = useState<
    number | null
  >(null);

  if (!playerId) {
    return (
      <AppLayout
        title="5 componentes"
        subtitle="Antropometría completa · Kerr"
      >
        <div className="rounded-lg border border-border bg-card p-8 text-center shadow-panel">
          <FlaskConical className="mx-auto h-9 w-9 text-muted-foreground" />

          <h2 className="mt-3 font-display text-lg font-semibold">
            Seleccioná una jugadora
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Las evaluaciones de 5
            componentes se consultan
            dentro de la ficha
            individual de cada
            jugadora.
          </p>
        </div>
      </AppLayout>
    );
  }

  if (!player) {
    return (
      <AppLayout
        title="5 componentes"
        subtitle="Antropometría completa · Kerr"
      >
        <p className="text-sm text-muted-foreground">
          Cargando jugadora…
        </p>
      </AppLayout>
    );
  }

  const rows =
    anthropometries ?? [];

  const latest =
    rows[0];

  const latestMasses =
    latest
      ? finalMasses(latest)
      : null;

  async function compartirEvaluacion(
    anthropometry:
      FullAnthropometry,
  ) {
    if (!player) return;

    const shareId =
      anthropometry.id ??
      -1;

    setSharingId(
      shareId,
    );

    try {
      const previous =
        previousFullAnthropometry(
          rows,
          anthropometry,
        );

      const presentation =
        calculateAntropogimsPresentation(
          anthropometry,
          previous,
        );

      const measurements =
        FULL_ANTHROPOMETRY_MEASURES.map(
          (
            definition,
          ) => ({
            label:
              definition.label,

            unit:
              definition.unit,

            current:
              anthropometry
                .measures[
                definition.key
              ]?.median ??
              null,

            previous:
              presentation
                .previousValues[
                definition.key
              ] ??
              null,

            difference:
              presentation
                .measurementDifferences[
                definition.key
              ] ??
              null,
          }),
        );

      const masses =
        MASS_ROWS.map(
          (row) => ({
            label:
              row.label,

            kg:
              presentation
                .massesKg[
                row.key
              ] ??
              null,

            percent:
              presentation
                .massPercentages[
                row.key
              ] ??
              null,

            scoreZ:
              presentation
                .massScoreZ[
                row.key
              ] ??
              null,

            previousKg:
              presentation
                .previousMassesKg?.[
                row.key
              ] ??
              null,

            differenceKg:
              presentation
                .massDifferencesKg?.[
                row.key
              ] ??
              null,
          }),
        );

      const additional =
        presentation.additional;

      const somatotype =
        presentation.somatotype;

      const extras = [
        {
          label:
            "Relación cintura/cadera",
          value:
            pdfValue(
              additional
                .waistHipRatio,
              2,
            ),
        },
        {
          label: "Sum6",
          value:
            pdfValue(
              additional.sum6,
              1,
              " mm",
            ),
        },
        {
          label:
            "Índice músculo/óseo",
          value:
            pdfValue(
              additional
                .muscleBoneIndex,
              2,
            ),
        },
        {
          label:
            "Índice adiposo/muscular",
          value:
            pdfValue(
              additional
                .adiposeMuscleIndex,
              2,
            ),
        },
        {
          label: "IMC",
          value:
            pdfValue(
              additional.bmi,
              2,
            ),
        },
        {
          label:
            "Talla sentado / talla",
          value:
            pdfValue(
              additional
                .sittingHeightStatureRatio,
              3,
            ),
        },
        {
          label:
            "Superficie corporal",
          value:
            pdfValue(
              additional
                .bodySurfaceArea,
              3,
              " m²",
            ),
        },
        {
          label:
            "Superficie corporal / masa",
          value:
            pdfValue(
              additional
                .bodySurfaceAreaBodyMass,
              2,
            ),
        },
        {
          label:
            "Endomorfia",
          value:
            pdfValue(
              somatotype
                .endomorph,
              2,
            ),
        },
        {
          label:
            "Mesomorfia",
          value:
            pdfValue(
              somatotype
                .mesomorph,
              2,
            ),
        },
        {
          label:
            "Ectomorfia",
          value:
            pdfValue(
              somatotype
                .ectomorph,
              2,
            ),
        },
      ];

      const {
        blob,
        fileName,
      } =
        createFiveComponentsReportPdf({
          playerName:
            player.name,

          date:
            fmtDate(
              anthropometry.date,
            ).replaceAll(
              "/",
              "-",
            ),

          source:
            sourceLabel(
              anthropometry.source,
            ),

          weight:
            anthropometry
              .measures
              .weight
              ?.median ??
            null,

          stature:
            anthropometry
              .measures
              .stature
              ?.median ??
            null,

          sum6:
            anthropometry
              .results
              ?.sum6 ??
            null,

          muscleBoneIndex:
            anthropometry
              .results
              ?.muscleBoneIndexRaw ??
            null,

          measurements,

          masses,

          extras,
        });

      const result =
        await shareFile({
          blob,
          fileName,

          title:
            `5 componentes · ${player.name}`,

          text:
            `Evaluación de 5 componentes · ${player.name} · ${fmtDate(
              anthropometry.date,
            )}`,
        });

      if (
        result.status ===
        "unsupported"
      ) {
        toast.error(
          result.message,
        );
      }
    } catch (error) {
      console.error(
        error,
      );

      toast.error(
        "No se pudo compartir la evaluación.",
      );
    } finally {
      setSharingId(
        null,
      );
    }
  }

  async function eliminarEvaluacion(
    anthropometry:
      FullAnthropometry,
  ) {
    if (
      anthropometry.id == null
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `¿Eliminar la evaluación del ${fmtDate(
          anthropometry.date,
        )}? Esta acción no se puede deshacer.`,
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(
      anthropometry.id,
    );

    try {
      await deleteFullAnthropometry(
        anthropometry.id,
      );

      toast.success(
        "Evaluación eliminada correctamente.",
      );
    } catch (error) {
      console.error(error);

      toast.error(
        "No se pudo eliminar la evaluación.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppLayout
      title={`5 componentes · ${player.name}`}
      subtitle="Antropometría completa · Fraccionamiento corporal de Kerr"
    >
      <PlayerNav
        playerId={playerId}
        playerName={player.name}
        current="componentes"
      />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5 shadow-panel">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Plus className="h-5 w-5 text-primary" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-semibold">
                Nueva evaluación
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Cargar una
                antropometría completa
                directamente desde la
                aplicación.
              </p>

              <Button
                asChild
                className="mt-4"
              >
                <Link
                  to="/componentes-nueva"
                  search={{
                    player:
                      playerId,
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Nueva evaluación
                </Link>
              </Button>

              <p className="mt-2 text-xs text-muted-foreground">
                Al guardar, los datos
                compartidos también
                pasan al seguimiento
                habitual.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-panel">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-semibold">
                Importar Antropogims
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Adjuntar un Excel de
                Antropogims y completar
                automáticamente la
                evaluación.
              </p>

              <Button
                asChild
                className="mt-4"
                variant="outline"
              >
                <Link
                  to="/componentes-importar"
                  search={{
                    player:
                      playerId,
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Importar Excel
                </Link>
              </Button>

              <p className="mt-2 text-xs text-muted-foreground">
                Compatible con .xls,
                .xlsx y .xlsm.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Última evaluación completa
          </p>

          {latest?.id !=
            null && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={
                  sharingId ===
                  latest.id
                }
                onClick={() =>
                  void compartirEvaluacion(
                    latest,
                  )
                }
              >
                <Share2 className="h-4 w-4" />

                {sharingId ===
                latest.id
                  ? "Preparando..."
                  : "Compartir"}
              </Button>

              <Button
                asChild
                size="sm"
                variant="outline"
              >
                <Link
                  to="/componentes-presentacion"
                  search={{
                    player:
                      playerId,

                    id:
                      latest.id,
                  }}
                >
                  <FileText className="h-4 w-4" />
                  Ver presentación
                </Link>
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Fecha"
            value={
              latest
                ? fmtDate(
                    latest.date,
                  )
                : "—"
            }
          />

          <SummaryCard
            label="Sum6"
            value={
              latest?.results
                ?.sum6 != null
                ? `${fmt(
                    latest.results
                      .sum6,
                    1,
                  )} mm`
                : "—"
            }
          />

          <SummaryCard
            label="Masa muscular"
            value={
              latestMasses
                ?.muscle != null
                ? `${fmt(
                    latestMasses
                      .muscle,
                    1,
                  )} kg`
                : "—"
            }
          />

          <SummaryCard
            label="IMO"
            value={
              latest?.results
                ?.muscleBoneIndexRaw !=
              null
                ? fmt(
                    latest.results
                      .muscleBoneIndexRaw,
                    2,
                  )
                : "—"
            }
          />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card shadow-panel">
        <div className="border-b border-border px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Historial
          </p>

          <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">
              Evaluaciones de 5
              componentes
            </h2>

            <p className="text-sm text-muted-foreground">
              {rows.length}{" "}
              {rows.length === 1
                ? "evaluación"
                : "evaluaciones"}
            </p>
          </div>
        </div>

        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">
                    Fecha
                  </th>

                  <th className="px-3 py-2 font-semibold">
                    Origen
                  </th>

                  <th className="px-3 py-2 text-right font-semibold">
                    Peso
                  </th>

                  <th className="px-3 py-2 text-right font-semibold">
                    Sum6
                  </th>

                  <th className="px-3 py-2 text-right font-semibold">
                    Muscular
                  </th>

                  <th className="px-3 py-2 text-right font-semibold">
                    Adiposa
                  </th>

                  <th className="px-3 py-2 text-right font-semibold">
                    Ósea
                  </th>

                  <th className="px-3 py-2 text-right font-semibold">
                    IMO
                  </th>

                  <th className="px-3 py-2 text-right font-semibold">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map(
                  (
                    anthropometry,
                  ) => {
                    const masses =
                      finalMasses(
                        anthropometry,
                      );

                    const weight =
                      anthropometry
                        .measures
                        .weight
                        ?.median ??
                      null;

                    return (
                      <tr
                        key={
                          anthropometry.id
                        }
                        className="border-t border-border"
                      >
                        <td className="whitespace-nowrap px-3 py-3 font-medium">
                          {fmtDate(
                            anthropometry.date,
                          )}
                        </td>

                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium">
                            {sourceLabel(
                              anthropometry.source,
                            )}
                          </span>
                        </td>

                        <td className="numeric px-3 py-3 text-right">
                          {weight !=
                          null
                            ? `${fmt(
                                weight,
                                1,
                              )} kg`
                            : "—"}
                        </td>

                        <td className="numeric px-3 py-3 text-right">
                          {anthropometry
                            .results
                            ?.sum6 !=
                          null
                            ? `${fmt(
                                anthropometry
                                  .results
                                  .sum6,
                                1,
                              )} mm`
                            : "—"}
                        </td>

                        <td className="numeric px-3 py-3 text-right">
                          {masses
                            ?.muscle !=
                          null
                            ? `${fmt(
                                masses
                                  .muscle,
                                1,
                              )} kg`
                            : "—"}
                        </td>

                        <td className="numeric px-3 py-3 text-right">
                          {masses
                            ?.adipose !=
                          null
                            ? `${fmt(
                                masses
                                  .adipose,
                                1,
                              )} kg`
                            : "—"}
                        </td>

                        <td className="numeric px-3 py-3 text-right">
                          {masses
                            ?.bone !=
                          null
                            ? `${fmt(
                                masses.bone,
                                1,
                              )} kg`
                            : "—"}
                        </td>

                        <td className="numeric px-3 py-3 text-right font-semibold">
                          {anthropometry
                            .results
                            ?.muscleBoneIndexRaw !=
                          null
                            ? fmt(
                                anthropometry
                                  .results
                                  .muscleBoneIndexRaw,
                                2,
                              )
                            : "—"}
                        </td>

                        <td className="px-3 py-3">
                          {anthropometry.id !=
                          null ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={
                                  sharingId ===
                                  anthropometry.id
                                }
                                onClick={() =>
                                  void compartirEvaluacion(
                                    anthropometry,
                                  )
                                }
                              >
                                <Share2 className="h-4 w-4" />

                                {sharingId ===
                                anthropometry.id
                                  ? "Preparando..."
                                  : "Compartir"}
                              </Button>

                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                              >
                                <Link
                                  to="/componentes-presentacion"
                                  search={{
                                    player:
                                      playerId,

                                    id:
                                      anthropometry.id,
                                  }}
                                >
                                  <FileText className="h-4 w-4" />
                                  Ver
                                </Link>
                              </Button>

                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={
                                  deletingId ===
                                  anthropometry.id
                                }
                                onClick={() =>
                                  void eliminarEvaluacion(
                                    anthropometry,
                                  )
                                }
                              >
                                <Trash2 className="h-4 w-4" />

                                {deletingId ===
                                anthropometry.id
                                  ? "Eliminando..."
                                  : "Eliminar"}
                              </Button>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <FlaskConical className="mx-auto h-10 w-10 text-muted-foreground/60" />

            <h3 className="mt-3 font-semibold">
              Todavía no hay
              evaluaciones completas
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Cuando carguemos una
              antropometría manual o
              importemos un
              Antropogims, va a
              aparecer acá junto con
              sus resultados de 5
              componentes.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p className="mt-2 font-display text-xl font-semibold">
        {value}
      </p>
    </div>
  );
}
