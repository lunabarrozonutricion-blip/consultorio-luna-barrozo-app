import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import {
  ArrowLeft,
  Calculator,
  Save,
} from "lucide-react";
import {
  useEffect,
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
  useFullAnthropometries,
  usePlayer,
} from "@/lib/hooks";

import {
  FULL_ANTHROPOMETRY_GROUP_LABELS,
  FULL_ANTHROPOMETRY_MEASURES,
} from "@/lib/types";

import type {
  AnthropometrySex,
  FullAnthropometry,
  FullAnthropometryGroup,
  FullAnthropometryMeasure,
  FullAnthropometryMeasureKey,
} from "@/lib/types";

export const Route = createFileRoute(
  "/componentes-editar",
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
      <EditarAntropometria />
    </ClientOnly>
  ),
});

type SeriesStrings = [
  string,
  string,
  string,
  string,
  string,
];

type FormMeasurements = Record<
  FullAnthropometryMeasureKey,
  SeriesStrings
>;

const GROUP_ORDER:
  FullAnthropometryGroup[] = [
    "basicos",
    "diametros",
    "perimetros",
    "pliegues",
  ];

function emptySeries(): SeriesStrings {
  return ["", "", "", "", ""];
}

function createEmptyMeasurements():
  FormMeasurements {
  return Object.fromEntries(
    FULL_ANTHROPOMETRY_MEASURES.map(
      (definition) => [
        definition.key,
        emptySeries(),
      ],
    ),
  ) as FormMeasurements;
}

function formFromAnthropometry(
  anthropometry: FullAnthropometry,
): FormMeasurements {
  const form =
    createEmptyMeasurements();

  for (
    const definition of
    FULL_ANTHROPOMETRY_MEASURES
  ) {
    const series =
      anthropometry.measures[
        definition.key
      ]?.series;

    form[definition.key] =
      [0, 1, 2, 3, 4].map(
        (index) => {
          const value =
            series?.[index] ??
            null;

          return value == null
            ? ""
            : String(value);
        },
      ) as SeriesStrings;
  }

  return form;
}

function toMeasure(
  values: SeriesStrings,
): FullAnthropometryMeasure {
  const series = values.map(
    (value) => parseNum(value),
  ) as [
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
  ];

  return calculateMeasureStatistics(
    series,
  );
}

function buildMeasures(
  form: FormMeasurements,
): FullAnthropometry["measures"] {
  const result:
    FullAnthropometry["measures"] =
      {};

  for (
    const definition of
    FULL_ANTHROPOMETRY_MEASURES
  ) {
    result[definition.key] =
      toMeasure(
        form[definition.key],
      );
  }

  return result;
}

function optionalInteger(
  value: string,
): number | null {
  const parsed =
    Number.parseInt(
      value,
      10,
    );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

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

function EditarAntropometria() {
  const navigate =
    useNavigate();

  const search =
    Route.useSearch();

  const playerId =
    search.player ?? null;

  const anthropometryId =
    search.id ?? null;

  const player =
    usePlayer(playerId);

  const fullAnthropometries =
    useFullAnthropometries(
      playerId,
    );

  const anthropometry =
    useMemo(
      () =>
        fullAnthropometries?.find(
          (row) =>
            row.id ===
            anthropometryId,
        ) ?? null,
      [
        fullAnthropometries,
        anthropometryId,
      ],
    );

  const hydratedId =
    useRef<number | null>(
      null,
    );

  const [
    measurements,
    setMeasurements,
  ] =
    useState<FormMeasurements>(
      () =>
        createEmptyMeasurements(),
    );

  const [
    measurementNumber,
    setMeasurementNumber,
  ] = useState("");

  const [sport, setSport] =
    useState("");

  const [
    physicalActivity,
    setPhysicalActivity,
  ] = useState("");

  const [
    activityType,
    setActivityType,
  ] = useState("");

  const [sex, setSex] =
    useState<AnthropometrySex>(
      "female",
    );

  const [
    boneReference,
    setBoneReference,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    if (
      !anthropometry ||
      anthropometry.id == null ||
      hydratedId.current ===
        anthropometry.id
    ) {
      return;
    }

    hydratedId.current =
      anthropometry.id;

    setMeasurements(
      formFromAnthropometry(
        anthropometry,
      ),
    );

    setMeasurementNumber(
      anthropometry.measurementNumber !=
      null
        ? String(
            anthropometry.measurementNumber,
          )
        : "",
    );

    setSport(
      anthropometry.sport ??
        "",
    );

    setPhysicalActivity(
      anthropometry.physicalActivity ??
        "",
    );

    setActivityType(
      anthropometry.activityType ??
        "",
    );

    setSex(
      anthropometry.sex,
    );

    setBoneReference(
      anthropometry.boneReferenceKg !=
      null
        ? String(
            anthropometry.boneReferenceKg,
          )
        : "",
    );

    setNotes(
      anthropometry.notes ??
        "",
    );
  }, [anthropometry]);

  const measures =
    useMemo(
      () =>
        buildMeasures(
          measurements,
        ),
      [measurements],
    );

  const preview =
    useMemo(
      () =>
        calculateFiveComponents(
          {
            measures,
            sex,
            ageYears:
              anthropometry
                ?.ageYears ??
              null,
            boneReferenceKg:
              parseNum(
                boneReference,
              ),
          },
        ),
      [
        measures,
        sex,
        anthropometry,
        boneReference,
      ],
    );

  const missing =
    useMemo(
      () =>
        missingKerrMeasures({
          measures,
        }),
      [measures],
    );

  const finalMasses =
    preview
      .boneReferenceAdjustedMassesKg ??
    preview.weightAdjustedMassesKg;

  const finalPercentages =
    preview.weightAdjustedMassesPercent;

  function updateSeries(
    key:
      FullAnthropometryMeasureKey,
    index: number,
    value: string,
  ) {
    setMeasurements(
      (previous) => {
        const nextSeries = [
          ...previous[key],
        ] as SeriesStrings;

        nextSeries[index] =
          value;

        return {
          ...previous,
          [key]: nextSeries,
        };
      },
    );
  }

  async function save() {
    if (
      !anthropometry ||
      anthropometry.id == null ||
      !playerId
    ) {
      return;
    }

    if (
      missing.length > 0
    ) {
      const labels =
        missing
          .slice(0, 4)
          .map(
            (key) =>
              FULL_ANTHROPOMETRY_MEASURES.find(
                (definition) =>
                  definition.key ===
                  key,
              )?.label ??
              key,
          )
          .join(", ");

      toast.error(
        `Faltan ${missing.length} mediciones necesarias para Kerr. ${labels}${
          missing.length > 4
            ? "…"
            : ""
        }`,
      );

      return;
    }

    setSaving(true);

    try {
      const updated:
        FullAnthropometry = {
        ...anthropometry,

        measurementNumber:
          optionalInteger(
            measurementNumber,
          ),

        sport:
          sport.trim() ||
          null,

        physicalActivity:
          physicalActivity.trim() ||
          null,

        activityType:
          activityType.trim() ||
          null,

        sex,

        measures,

        boneReferenceKg:
          parseNum(
            boneReference,
          ),

        results: null,

        notes:
          notes.trim() ||
          null,

        updatedAt:
          new Date().toISOString(),
      };

      await upsertFullAnthropometry(
        updated,
      );

      toast.success(
        "Antropometría actualizada correctamente",
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
        "No se pudieron guardar los cambios.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (
    !playerId ||
    !anthropometryId
  ) {
    return (
      <AppLayout title="Editar antropometría">
        <p className="text-sm text-muted-foreground">
          No se seleccionó una
          evaluación válida.
        </p>
      </AppLayout>
    );
  }

  if (
    !player ||
    fullAnthropometries == null
  ) {
    return (
      <AppLayout title="Editar antropometría">
        <p className="text-sm text-muted-foreground">
          Cargando evaluación…
        </p>
      </AppLayout>
    );
  }

  if (!anthropometry) {
    return (
      <AppLayout title="Editar antropometría">
        <p className="text-sm text-muted-foreground">
          No se encontró la
          antropometría seleccionada.
        </p>

        <Button
          asChild
          variant="outline"
          className="mt-4"
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
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={`Editar evaluación · ${player.name}`}
      subtitle={`5 componentes · ${fmtDate(
        anthropometry.date,
      )}`}
    >
      <PlayerNav
        playerId={playerId}
        playerName={
          player.name
        }
        current="componentes"
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button
          asChild
          variant="outline"
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

        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          La fecha se mantiene en {" "}
          <strong>
            {fmtDate(
              anthropometry.date,
            )}
          </strong>
          . Al guardar se recalculan
          automáticamente todos los
          resultados y el control
          asociado.
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Datos de la evaluación
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="text-sm">
            <span className="font-medium">
              Fecha
            </span>

            <div className="mt-1 flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 font-medium">
              {fmtDate(
                anthropometry.date,
              )}
            </div>
          </div>

          <label className="text-sm">
            <span className="font-medium">
              N.º de medición
            </span>

            <Input
              type="number"
              min="1"
              value={
                measurementNumber
              }
              onChange={(
                event,
              ) =>
                setMeasurementNumber(
                  event.target
                    .value,
                )
              }
              placeholder="Opcional"
              className="mt-1"
            />
          </label>

          <label className="text-sm">
            <span className="font-medium">
              Sexo
            </span>

            <select
              value={sex}
              onChange={(
                event,
              ) =>
                setSex(
                  event.target
                    .value as AnthropometrySex,
                )
              }
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="female">
                Femenino
              </option>

              <option value="male">
                Masculino
              </option>

              <option value="unspecified">
                Sin especificar
              </option>
            </select>
          </label>

          <div className="text-sm">
            <span className="font-medium">
              Edad usada
            </span>

            <div className="mt-1 flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 font-medium">
              {anthropometry.ageYears !=
              null
                ? `${fmt(
                    anthropometry.ageYears,
                    1,
                  )} años`
                : "—"}
            </div>
          </div>

          <label className="text-sm">
            <span className="font-medium">
              Deporte
            </span>

            <Input
              value={sport}
              onChange={(
                event,
              ) =>
                setSport(
                  event.target
                    .value,
                )
              }
              className="mt-1"
            />
          </label>

          <label className="text-sm">
            <span className="font-medium">
              Actividad física
            </span>

            <Input
              value={
                physicalActivity
              }
              onChange={(
                event,
              ) =>
                setPhysicalActivity(
                  event.target
                    .value,
                )
              }
              placeholder="Opcional"
              className="mt-1"
            />
          </label>

          <label className="text-sm">
            <span className="font-medium">
              Tipo de actividad
            </span>

            <Input
              value={
                activityType
              }
              onChange={(
                event,
              ) =>
                setActivityType(
                  event.target
                    .value,
                )
              }
              className="mt-1"
            />
          </label>

          <label className="text-sm">
            <span className="font-medium">
              Masa ósea de referencia
            </span>

            <Input
              inputMode="decimal"
              value={
                boneReference
              }
              onChange={(
                event,
              ) =>
                setBoneReference(
                  event.target
                    .value,
                )
              }
              placeholder="kg · opcional"
              className="mt-1"
            />
          </label>
        </div>
      </section>

      {GROUP_ORDER.map(
        (group) => {
          const definitions =
            FULL_ANTHROPOMETRY_MEASURES.filter(
              (definition) =>
                definition.group ===
                group,
            );

          return (
            <section
              key={group}
              className="mt-4 overflow-hidden rounded-lg border border-border bg-card shadow-panel"
            >
              <div className="border-b border-border px-4 py-3">
                <p className="font-display text-lg font-semibold">
                  {
                    FULL_ANTHROPOMETRY_GROUP_LABELS[
                      group
                    ]
                  }
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Podés corregir cualquiera
                  de las cinco tomas guardadas.
                  La mediana y todos los
                  cálculos se actualizan en
                  el momento.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] table-fixed text-sm">
                  <colgroup>
                    <col
                      style={{
                        width:
                          "28%",
                      }}
                    />

                    {[0, 1, 2, 3, 4].map(
                      (index) => (
                        <col
                          key={index}
                          style={{
                            width:
                              "11%",
                          }}
                        />
                      ),
                    )}

                    <col
                      style={{
                        width:
                          "17%",
                      }}
                    />
                  </colgroup>

                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-3 py-2 text-left">
                        Medición
                      </th>

                      {[1, 2, 3, 4, 5].map(
                        (number) => (
                          <th
                            key={number}
                            className="px-2 py-2 text-center"
                          >
                            {number}
                          </th>
                        ),
                      )}

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
                          toMeasure(
                            measurements[
                              definition
                                .key
                            ],
                          );

                        return (
                          <tr
                            key={
                              definition.key
                            }
                            className="border-t border-border"
                          >
                            <td className="px-3 py-2">
                              <div className="font-medium">
                                {
                                  definition.label
                                }
                              </div>

                              <div className="text-xs text-muted-foreground">
                                {
                                  definition.unit
                                }
                                {definition.usedInKerr
                                  ? " · Kerr"
                                  : ""}
                              </div>
                            </td>

                            {measurements[
                              definition.key
                            ].map(
                              (
                                value,
                                index,
                              ) => (
                                <td
                                  key={index}
                                  className="px-1.5 py-2"
                                >
                                  <Input
                                    inputMode="decimal"
                                    value={
                                      value
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateSeries(
                                        definition.key,
                                        index,
                                        event.target
                                          .value,
                                      )
                                    }
                                    className="h-9 w-full text-center"
                                  />
                                </td>
                              ),
                            )}

                            <td className="numeric whitespace-nowrap px-3 py-2 text-right font-semibold">
                              {measure.median !=
                              null
                                ? `${fmt(
                                    measure.median,
                                    2,
                                  )} ${
                                    definition.unit
                                  }`
                                : "—"}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        },
      )}

      <section className="mt-4 rounded-lg border border-border bg-card p-4 shadow-panel">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />

          <div>
            <p className="font-display text-lg font-semibold">
              Vista previa actualizada
            </p>

            <p className="text-xs text-muted-foreground">
              Estos resultados todavía
              no se guardan hasta tocar
              Guardar cambios.
            </p>
          </div>
        </div>

        {missing.length >
          0 && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Faltan {" "}
            <strong>
              {missing.length}
            </strong>{" "}
            mediciones necesarias
            para completar Kerr.
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ResultCard
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

          <ResultCard
            label="Masa muscular"
            value={massText(
              finalMasses.muscle,
              finalPercentages.muscle,
            )}
          />

          <ResultCard
            label="Masa adiposa"
            value={massText(
              finalMasses.adipose,
              finalPercentages.adipose,
            )}
          />

          <ResultCard
            label="Masa ósea"
            value={massText(
              finalMasses.bone,
              finalPercentages.bone,
            )}
          />

          <ResultCard
            label="Masa residual"
            value={massText(
              finalMasses.residual,
              finalPercentages.residual,
            )}
          />

          <ResultCard
            label="Masa de piel"
            value={massText(
              finalMasses.skin,
              finalPercentages.skin,
            )}
          />

          <ResultCard
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

          <ResultCard
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

      <section className="mt-4 rounded-lg border border-border bg-card p-4 shadow-panel">
        <label className="text-sm">
          <span className="font-medium">
            Observaciones
          </span>

          <textarea
            value={notes}
            onChange={(
              event,
            ) =>
              setNotes(
                event.target
                  .value,
              )
            }
            rows={3}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Opcional"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-xs text-muted-foreground">
            Al guardar, se conserva la
            misma evaluación y la misma
            fecha. Se recalculan los 5
            componentes y también se
            actualiza el control general
            asociado.
          </p>

          <Button
            onClick={() =>
              void save()
            }
            disabled={
              saving ||
              missing.length >
                0
            }
          >
            <Save className="h-4 w-4" />

            {saving
              ? "Guardando…"
              : "Guardar cambios"}
          </Button>
        </div>
      </section>
    </AppLayout>
  );
}

function ResultCard({
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
