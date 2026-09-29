import {
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Save,
  Upload,
} from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app-layout";
import { ClientOnly } from "@/components/client-only";
import { PlayerNav } from "@/components/player-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  antropogimsDecimalAge,
  parseAntropogimsFile,
} from "@/lib/antropogims";

import type {
  ParsedAntropogims,
} from "@/lib/antropogims";

import {
  fmt,
  fmtDate,
  parseNum,
} from "@/lib/calc";

import {
  upsertFullAnthropometry,
} from "@/lib/db";

import {
  calculateFiveComponents,
  calculateMeasureStatistics,
  missingKerrMeasures,
} from "@/lib/kerr";

import {
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
  "/componentes-importar",
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

  component: () => (
    <ClientOnly>
      <ImportarAntropogims />
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

/* ============================================================
   HELPERS
============================================================ */

function normalizeName(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[̀-ͯ]/g,
      "",
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .trim();
}

function namesLookCompatible(
  excelName:
    | string
    | null,
  playerName: string,
) {
  if (!excelName) {
    return true;
  }

  const excel =
    normalizeName(
      excelName,
    );

  const player =
    normalizeName(
      playerName,
    );

  if (
    excel === "" ||
    player === ""
  ) {
    return true;
  }

  return (
    excel === player ||
    excel.includes(
      player,
    ) ||
    player.includes(
      excel,
    )
  );
}

/*
 * Igual que en la carga manual:
 *
 * - kg con 3 decimales
 * - porcentajes con 2 decimales
 */
function massText(
  kg: number | null,
  percent: number | null,
) {
  if (kg == null) {
    return "—";
  }

  return `${fmt(
    kg,
    3,
  )} kg${
    percent != null
      ? ` · ${fmt(
          percent,
          2,
        )}%`
      : ""
  }`;
}

function countMeasures(
  parsed:
    ParsedAntropogims,
) {
  return Object.values(
    parsed.measures,
  ).filter(
    (measure) =>
      measure?.median !=
      null,
  ).length;
}

function hasExtraSeries(
  parsed:
    ParsedAntropogims,
) {
  return Object.values(
    parsed.measures,
  ).some(
    (measure) =>
      measure &&
      (measure.series[3] !=
        null ||
        measure.series[4] !=
          null),
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
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 numeric text-lg font-bold">
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   PANTALLA
============================================================ */

function ImportarAntropogims() {
  const navigate =
    useNavigate();

  const inputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const search =
    Route.useSearch();

  const playerId =
    search.player ?? null;

  const player =
    usePlayer(playerId);

  const [
    parsed,
    setParsed,
  ] =
    useState<ParsedAntropogims | null>(
      null,
    );
const [
  editValues,
  setEditValues,
] =
  useState<Record<string, string>>({});
  const [
    parsing,
    setParsing,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    parseError,
    setParseError,
  ] =
    useState<string | null>(
      null,
    );

  const effectiveBirthDate =
    parsed?.birthDate ??
    player?.birthDate ??
    null;

  const effectiveAge =
    parsed?.date
      ? parsed.ageYears ??
        antropogimsDecimalAge(
          effectiveBirthDate,
          parsed.date,
        )
      : null;

  const preview =
    useMemo(() => {
      if (!parsed) {
        return null;
      }

      return calculateFiveComponents(
        {
          measures:
            parsed.measures,

          sex:
            parsed.sex,

          ageYears:
            effectiveAge,

          boneReferenceKg:
            parsed.boneReferenceKg,
        },
      );
    }, [
      parsed,
      effectiveAge,
    ]);

  const missing =
    useMemo(() => {
      if (!parsed) {
        return [];
      }

      return missingKerrMeasures({
        measures:
          parsed.measures,
      });
    }, [parsed]);

  const nameCompatible =
    parsed &&
    player
      ? namesLookCompatible(
          parsed.playerName,
          player.name,
        )
      : true;

  const birthDateMismatch =
    Boolean(
      parsed?.birthDate &&
        player?.birthDate &&
        parsed.birthDate !==
          player.birthDate,
    );

  /*
   * Los kg que mostramos son los
   * finales después del reajuste
   * por masa ósea de referencia.
   *
   * Si no existe MOR, usamos el
   * reajuste al peso real.
   */
  const finalMasses:
    FiveComponentMasses | null =
    preview
      ? preview
          .boneReferenceAdjustedMassesKg ??
        preview
          .weightAdjustedMassesKg
      : null;

  /*
   * Antropogims conserva los %
   * correspondientes al primer
   * reajuste al peso real.
   *
   * No vuelve a calcularlos después
   * de aplicar la MOR.
   */
  const finalPercentages:
    FiveComponentMasses | null =
    preview
      ? preview
          .weightAdjustedMassesPercent
      : null;

function updateImportedMeasureDraft(
  key: FullAnthropometryMeasureKey,
  index: number,
  rawValue: string,
) {
  const draftKey =
    `${key}:${index}`;

  setEditValues(
    (previous) => ({
      ...previous,
      [draftKey]:
        rawValue,
    }),
  );
}

function commitImportedMeasure(
  key: FullAnthropometryMeasureKey,
  index: number,
  rawValue: string,
) {
  if (!parsed) return;

  const current =
    parsed.measures[key];

  const nextSeries = [
    ...(current?.series ?? [
      null,
      null,
      null,
      null,
      null,
    ]),
  ] as [
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
  ];

  if (
    rawValue.trim() === ""
  ) {
    nextSeries[index] =
      null;
  } else {
    const parsedValue =
      parseNum(rawValue);

    if (
      parsedValue == null
    ) {
      return;
    }

    nextSeries[index] =
      parsedValue;
  }

  const nextMeasure =
    calculateMeasureStatistics(
      nextSeries,
    );

  setParsed({
    ...parsed,
    measures: {
      ...parsed.measures,
      [key]:
        nextMeasure,
    },
  });
}

  const current =
    parsed.measures[key];

  const nextSeries = [
    ...(current?.series ?? [
      null,
      null,
      null,
      null,
      null,
    ]),
  ] as [
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
  ];

  if (
    rawValue.trim() === ""
  ) {
    nextSeries[index] =
      null;
  } else {
    const parsedValue =
      parseNum(rawValue);

    if (
      parsedValue == null
    ) {
      return;
    }

    nextSeries[index] =
      parsedValue;
  }

  const nextMeasure =
    calculateMeasureStatistics(
      nextSeries,
    );

  setParsed({
    ...parsed,
    measures: {
      ...parsed.measures,
      [key]:
        nextMeasure,
    },
  });
}

   

  async function selectFile(
    file:
      | File
      | undefined,
  ) {
    if (!file) {
      return;
    }

    setParsing(true);
    setParseError(null);
    setParsed(null);

    try {
      const result =
        await parseAntropogimsFile(
          file,
        );

      setParsed(result);

      toast.success(
        "Antropogims leído correctamente",
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "No se pudo leer el Excel.";

      setParseError(
        message,
      );

      toast.error(
        message,
      );
    } finally {
      setParsing(false);

      if (
        inputRef.current
      ) {
        inputRef.current.value =
          "";
      }
    }
  }

  async function saveImport() {
    if (
      !parsed ||
      !player ||
      playerId == null
    ) {
      return;
    }

    if (!parsed.date) {
      toast.error(
        "No pude detectar la fecha de la evaluación.",
      );

      return;
    }

    if (
      !nameCompatible
    ) {
      toast.error(
        "El nombre del Excel no coincide con la jugadora seleccionada.",
      );

      return;
    }

    if (
      parsed.sex ===
      "unspecified"
    ) {
      toast.error(
        "No pude determinar el sexo en el archivo.",
      );

      return;
    }

    if (
      missing.length > 0
    ) {
      toast.error(
        `Faltan ${missing.length} mediciones necesarias para calcular Kerr.`,
      );

      return;
    }

    setSaving(true);

    try {
      const now =
        new Date().toISOString();

      const anthropometry:
        FullAnthropometry = {
        playerId,

        date:
          parsed.date,

        measurementNumber:
          parsed.measurementNumber,

        sport:
          parsed.sport,

        physicalActivity:
          parsed.physicalActivity,

        activityType:
          parsed.activityType,

        sex:
          parsed.sex,

        birthDate:
          effectiveBirthDate,

        ageYears:
          effectiveAge,

        measures:
          parsed.measures,

        boneReferenceKg:
          parsed.boneReferenceKg,

        results: null,

        linkedControlId:
          null,

        source:
          "antropogims",

        sourceFileName:
          parsed.sourceFileName,

        sourceSheetName:
          parsed.sourceSheetName,

        sourcePlayerName:
          parsed.playerName,

        notes:
          "Importado desde Antropogims",

        createdAt:
          now,

        updatedAt:
          now,
      };

      await upsertFullAnthropometry(
        anthropometry,
      );

      toast.success(
        "Antropogims importado correctamente",
      );

      await navigate({
        to: "/componentes",
        search: {
          player:
            playerId,
        },
      });
    } catch (error) {
      console.error(error);

      toast.error(
        "No se pudo guardar la importación.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!playerId) {
    return (
      <AppLayout title="Importar Antropogims">
        <p className="text-sm text-muted-foreground">
          No se seleccionó una
          jugadora.
        </p>
      </AppLayout>
    );
  }

  if (!player) {
    return (
      <AppLayout title="Importar Antropogims">
        <p className="text-sm text-muted-foreground">
          Cargando jugadora…
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={`Importar Antropogims · ${player.name}`}
      subtitle="Lectura automática de antropometría completa"
    >
      <PlayerNav
        playerId={playerId}
        playerName={
          player.name
        }
        current="componentes"
      />

      {/* ====================================================
          SELECCIÓN DE ARCHIVO
      ===================================================== */}

      <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold">
                Archivo de
                Antropogims
              </h2>

              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Seleccioná el Excel.
                La app va a leer las
                mediciones originales
                y recalcular los 5
                componentes.
              </p>
            </div>
          </div>

          <Button
            onClick={() =>
              inputRef.current?.click()
            }
            disabled={parsing}
          >
            <Upload className="h-4 w-4" />

            {parsing
              ? "Leyendo…"
              : parsed
                ? "Elegir otro Excel"
                : "Seleccionar Excel"}
          </Button>

          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx,.xlsm"
            className="hidden"
            onChange={(event) =>
              void selectFile(
                event.target
                  .files?.[0],
              )
            }
          />
        </div>

        <div className="mt-4 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Formatos compatibles:
          .xls, .xlsx y .xlsm. Las
          macros del archivo no se
          ejecutan.
        </div>

        {parseError && (
          <div className="mt-3 flex gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

            <p>
              {parseError}
            </p>
          </div>
        )}
      </section>

      {/* ====================================================
          ARCHIVO LEÍDO
      ===================================================== */}

      {parsed && (
        <>
          <section className="mt-4 rounded-lg border border-border bg-card p-4 shadow-panel">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />

              <div>
                <p className="font-display text-lg font-semibold">
                  Archivo leído
                </p>

                <p className="text-xs text-muted-foreground">
                  {
                    parsed.sourceFileName
                  }
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoCard
                label="Jugadora seleccionada"
                value={
                  player.name
                }
              />

              <InfoCard
                label="Nombre en Excel"
                value={
                  parsed.playerName ??
                  "No detectado"
                }
              />

              <InfoCard
                label="Fecha"
                value={
                  parsed.date
                    ? fmtDate(
                        parsed.date,
                      )
                    : "No detectada"
                }
              />

              <InfoCard
                label="Edad decimal"
                value={
                  effectiveAge !=
                  null
                    ? `${fmt(
                        effectiveAge,
                        1,
                      )} años`
                    : "—"
                }
              />

              <InfoCard
                label="Nacimiento"
                value={
                  effectiveBirthDate
                    ? fmtDate(
                        effectiveBirthDate,
                      )
                    : "—"
                }
              />

              <InfoCard
                label="N.º medición"
                value={
                  parsed.measurementNumber !=
                  null
                    ? String(
                        parsed.measurementNumber,
                      )
                    : "—"
                }
              />

              <InfoCard
                label="Mediciones detectadas"
                value={`${countMeasures(
                  parsed,
                )} de ${
                  FULL_ANTHROPOMETRY_MEASURES.length
                }`}
              />

              <InfoCard
                label="Origen"
                value="Antropogims"
              />
            </div>

            {!nameCompatible && (
              <div className="mt-4 flex gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                <div>
                  <p className="font-semibold">
                    Revisá la
                    jugadora
                  </p>

                  <p className="mt-1">
                    El Excel dice{" "}
                    <strong>
                      {parsed.playerName}
                    </strong>
                    , pero estás
                    importando dentro
                    de{" "}
                    <strong>
                      {player.name}
                    </strong>
                    .
                  </p>
                </div>
              </div>
            )}

            {birthDateMismatch && (
              <div className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                <p>
                  La fecha de
                  nacimiento del Excel
                  (
                  {fmtDate(
                    parsed.birthDate!,
                  )}
                  ) es diferente de la
                  cargada en la ficha
                  (
                  {fmtDate(
                    player.birthDate!,
                  )}
                  ). Para esta
                  evaluación se usará
                  la del Excel.
                </p>
              </div>
            )}

            {hasExtraSeries(
              parsed,
            ) && (
              <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                Este archivo contiene
                alguna 4.ª o 5.ª toma.
                Aunque abajo mostramos
                solo las primeras 3,
                la app conserva todas
                las tomas y las usa
                para calcular la
                mediana.
              </div>
            )}

            {parsed.warnings.map(
              (warning) => (
                <div
                  key={warning}
                  className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                  <p>
                    {warning}
                  </p>
                </div>
              ),
            )}
          </section>

          {/* =================================================
              MEDICIONES LEÍDAS
          ================================================== */}

          {GROUP_ORDER.map(
            (group) => {
              const definitions =
                FULL_ANTHROPOMETRY_MEASURES.filter(
                  (
                    definition,
                  ) =>
                    definition.group ===
                    group,
                );

              return (
                <section
                  key={group}
                  className="mt-4 overflow-hidden rounded-lg border border-border bg-card shadow-panel"
                >
                  <div className="border-b border-border px-4 py-3">
                    <h2 className="font-display text-lg font-semibold">
                      {
                        FULL_ANTHROPOMETRY_GROUP_LABELS[
                          group
                        ]
                      }
                    </h2>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Valores detectados automáticamente en el Excel. Podés corregir o completar cualquier dato antes de guardar.
                    </p>
                  </div>

                  <table className="w-full table-fixed text-sm">
                    <colgroup>
                      <col
                        style={{
                          width:
                            "34%",
                        }}
                      />

                      <col
                        style={{
                          width:
                            "14%",
                        }}
                      />

                      <col
                        style={{
                          width:
                            "14%",
                        }}
                      />

                      <col
                        style={{
                          width:
                            "14%",
                        }}
                      />

                      <col
                        style={{
                          width:
                            "24%",
                        }}
                      />
                    </colgroup>

                    <thead className="bg-muted/60">
                      <tr>
                        <th className="px-3 py-2 text-left">
                          Medición
                        </th>

                        <th className="px-2 py-2 text-center">
                          1
                        </th>

                        <th className="px-2 py-2 text-center">
                          2
                        </th>

                        <th className="px-2 py-2 text-center">
                          3
                        </th>

                        <th className="px-3 py-2 text-right">
                          Mediana
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {definitions.map(
                        (
                          definition,
                        ) => {
                          const measure =
                            parsed
                              .measures[
                              definition
                                .key
                            ];

                          return (
                            <tr
                              key={
                                definition.key
                              }
                              className="border-t border-border"
                            >
                              <td className="px-3 py-2">
                                <p className="font-medium">
                                  {
                                    definition.label
                                  }
                                </p>

                                <p className="text-xs text-muted-foreground">
                                  {
                                    definition.unit
                                  }
                                  {definition.usedInKerr
                                    ? " · Kerr"
                                    : ""}
                                </p>
                              </td>

                              {[
                                0,
                                1,
                                2,
                              ].map((index) => (
                                <td key={index} className="px-2 py-2">
                                  <Input
                                    inputMode="decimal"
                                    value={
  editValues[
    `${definition.key}:${index}`
  ] ??
  (measure?.series[index] ?? "")
}
                                    onChange={(event) =>
  updateImportedMeasureDraft(
    definition.key,
    index,
    event.target.value,
  )
}
onBlur={(event) =>
  commitImportedMeasure(
    definition.key,
    index,
    event.target.value,
  )
}
                                    placeholder="Completar"
                                    className={`h-9 text-center ${
                                      measure?.series[index] == null && definition.usedInKerr
                                        ? "border-amber-400 bg-amber-50"
                                        : ""
                                    }`}
                                  />
                                </td>
                              ))}

                              <td className="numeric px-3 py-2 text-right font-semibold">
                                {measure?.median != null
                                  ? `${fmt(measure.median, 2)} ${definition.unit}`
                                  : definition.usedInKerr
                                    ? "Falta dato"
                                    : "—"}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </section>
              );
            },
          )}

          {/* =================================================
              RESULTADOS
          ================================================== */}

          {preview && (
            <section className="mt-4 rounded-lg border border-border bg-card p-4 shadow-panel">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vista previa
              </p>

              <h2 className="mt-1 font-display text-xl font-semibold">
                Resultados de 5
                componentes
              </h2>

              {missing.length >
                0 && (
                <div className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                  <p>
                    Faltan{" "}
                    <strong>{missing.length}</strong>{" "}
                    mediciones necesarias para completar el cálculo de Kerr:{" "}
                    <strong>
                      {missing
                        .map((key) =>
                          FULL_ANTHROPOMETRY_MEASURES.find(
                            (definition) => definition.key === key,
                          )?.label ?? key,
                        )
                        .join(", ")}
                    </strong>. Podés completarlas directamente arriba.
                  </p>
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  label="Sum6"
                  value={
                    preview.sum6 !=
                    null
                      ? `${fmt(
                          preview.sum6,
                          1,
                        )} mm`
                      : "—"
                  }
                />

                <SummaryCard
                  label="Masa muscular"
                  value={
                    finalMasses &&
                    finalPercentages
                      ? massText(
                          finalMasses.muscle,
                          finalPercentages.muscle,
                        )
                      : "—"
                  }
                />

                <SummaryCard
                  label="Masa adiposa"
                  value={
                    finalMasses &&
                    finalPercentages
                      ? massText(
                          finalMasses.adipose,
                          finalPercentages.adipose,
                        )
                      : "—"
                  }
                />

                <SummaryCard
                  label="Masa ósea"
                  value={
                    finalMasses &&
                    finalPercentages
                      ? massText(
                          finalMasses.bone,
                          finalPercentages.bone,
                        )
                      : "—"
                  }
                />

                <SummaryCard
                  label="Masa residual"
                  value={
                    finalMasses &&
                    finalPercentages
                      ? massText(
                          finalMasses.residual,
                          finalPercentages.residual,
                        )
                      : "—"
                  }
                />

                <SummaryCard
                  label="Masa de piel"
                  value={
                    finalMasses &&
                    finalPercentages
                      ? massText(
                          finalMasses.skin,
                          finalPercentages.skin,
                        )
                      : "—"
                  }
                />

                {/*
                 * El IMO que muestra
                 * Antropogims corresponde
                 * al cálculo anterior al
                 * reajuste por MOR.
                 */}
                <SummaryCard
                  label="IMO"
                  value={
                    preview
                      .muscleBoneIndexRaw !=
                    null
                      ? fmt(
                          preview
                            .muscleBoneIndexRaw,
                          2,
                        )
                      : "—"
                  }
                />

                <SummaryCard
                  label="Peso estructurado"
                  value={
                    preview
                      .structuredWeightKg !=
                    null
                      ? `${fmt(
                          preview
                            .structuredWeightKg,
                          1,
                        )} kg`
                      : "—"
                  }
                />
              </div>
            </section>
          )}

          {/* =================================================
              GUARDAR
          ================================================== */}

          <section className="mt-4 rounded-lg border border-border bg-card p-4 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold">
                  Guardar evaluación
                </p>

                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Al guardar se
                  registrará como una
                  antropometría de 5
                  componentes y los
                  datos compartidos
                  también pasarán al
                  seguimiento habitual
                  de {player.name}.
                </p>
              </div>

              <Button
                onClick={() =>
                  void saveImport()
                }
                disabled={
                  saving ||
                  !parsed.date ||
                  !nameCompatible ||
                  parsed.sex ===
                    "unspecified" ||
                  missing.length > 0
                }
              >
                <Save className="h-4 w-4" />

                {saving
                  ? "Guardando…"
                  : "Guardar importación"}
              </Button>
            </div>
          </section>
        </>
      )}
    </AppLayout>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 font-medium">
        {value}
      </p>
    </div>
  );
}
