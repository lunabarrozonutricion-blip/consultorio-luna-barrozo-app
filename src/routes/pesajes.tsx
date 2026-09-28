import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Clock3,
  GitCompareArrows,
  Printer,
  Save,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app-layout";
import { ClientOnly } from "@/components/client-only";
import { Button } from "@/components/ui/button";
import {
  fmt,
  fmtDate,
  fmtDiff,
  parseNum,
  todayISO,
} from "@/lib/calc";
import {
  nowISO,
  upsertWeightRecord,
} from "@/lib/db";
import {
  usePlayers,
  useWeightRecords,
} from "@/lib/hooks";
import {
  WEIGHT_CONDITIONS,
  type WeightCondition,
} from "@/lib/types";

export const Route = createFileRoute("/pesajes")({
  component: () => (
    <ClientOnly>
      <Pesajes />
    </ClientOnly>
  ),
});

type Draft = {
  weight: string;
  condition: WeightCondition;
  notes: string;
};

type ComparisonMode =
  | "previous"
  | "date";

function dateMs(
  value: string,
) {
  return new Date(
    `${value}T00:00:00`,
  ).getTime();
}

function conditionLabel(
  value: WeightCondition,
) {
  return (
    WEIGHT_CONDITIONS.find(
      (
        condition,
      ) =>
        condition.value ===
        value,
    )?.label ??
    value
  );
}

function formatKg(
  value:
    | number
    | null
    | undefined,
) {
  if (
    value == null
  ) {
    return "—";
  }

  return `${fmt(
    value,
    1,
  )} kg`;
}

function formatDiffKg(
  value:
    | number
    | null
    | undefined,
) {
  if (
    value == null
  ) {
    return "—";
  }

  return `${fmtDiff(
    value,
    1,
  )} kg`;
}

function differenceClass(
  value:
    | number
    | null,
) {
  if (
    value == null
  ) {
    return "";
  }

  const rounded =
    Math.round(
      value * 10,
    ) / 10;

  if (
    rounded >=
    0.5
  ) {
    return "bg-red-100 text-red-700";
  }

  if (
    rounded <=
    -0.2
  ) {
    return "bg-emerald-100 text-emerald-700";
  }

  return "";
}

function Pesajes() {
  const players =
    usePlayers();

  const records =
    useWeightRecords();

  const [
    date,
    setDate,
  ] =
    useState(
      todayISO(),
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    comparisonMode,
    setComparisonMode,
  ] =
    useState<ComparisonMode>(
      "previous",
    );

  const [
    referenceDate,
    setReferenceDate,
  ] =
    useState("");

  const [
    drafts,
    setDrafts,
  ] =
    useState<
      Record<
        number,
        Draft
      >
    >({});

  const weightDates =
    useMemo(() => {
      return [
        ...new Set(
          (
            records ??
            []
          ).map(
            (
              record,
            ) =>
              record.date,
          ),
        ),
      ].sort(
        (
          a,
          b,
        ) =>
          b.localeCompare(
            a,
          ),
      );
    }, [
      records,
    ]);

  const latestWeightDate =
    weightDates[0] ??
    null;

  const availableReferenceDates =
    useMemo(
      () => {
        return weightDates.filter(
          (
            weightDate,
          ) =>
            weightDate <
            date,
        );
      },
      [
        weightDates,
        date,
      ],
    );

  useEffect(() => {
    if (
      comparisonMode !==
      "date"
    ) {
      return;
    }

    if (
      referenceDate &&
      availableReferenceDates.includes(
        referenceDate,
      )
    ) {
      return;
    }

    setReferenceDate(
      availableReferenceDates[0] ??
        "",
    );
  }, [
    comparisonMode,
    referenceDate,
    availableReferenceDates,
  ]);

  const selectedDateHasRecords =
    weightDates.includes(
      date,
    );

  const recordsForDate =
    useMemo(() => {
      const map =
        new Map<
          number,
          NonNullable<
            typeof records
          >[number]
        >();

      for (
        const record
        of records ??
        []
      ) {
        if (
          record.date ===
            date &&
          !map.has(
            record.playerId,
          )
        ) {
          map.set(
            record.playerId,
            record,
          );
        }
      }

      return map;
    }, [
      records,
      date,
    ]);

  useEffect(() => {
    if (
      !players ||
      !records
    ) {
      return;
    }

    const next:
      Record<
        number,
        Draft
      > = {};

    for (
      const player
      of players
    ) {
      if (
        player.id ==
        null
      ) {
        continue;
      }

      const existing =
        records.find(
          (
            record,
          ) =>
            record.playerId ===
              player.id &&
            record.date ===
              date,
        );

      next[
        player.id
      ] = {
        weight:
          existing?.weight !=
          null
            ? String(
                existing.weight,
              ).replace(
                ".",
                ",",
              )
            : "",

        condition:
          existing?.condition ??
          "normal",

        notes:
          existing?.notes ??
          "",
      };
    }

    setDrafts(
      next,
    );
  }, [
    players,
    records,
    date,
  ]);

  const filteredPlayers =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      if (!text) {
        return (
          players ??
          []
        );
      }

      return (
        players ??
        []
      ).filter(
        (
          player,
        ) =>
          player.name
            .toLowerCase()
            .includes(
              text,
            ),
      );
    }, [
      players,
      search,
    ]);

  const referenceByPlayer =
    useMemo(() => {
      const map =
        new Map<
          number,
          NonNullable<
            typeof records
          >[number]
        >();

      for (
        const player
        of players ??
        []
      ) {
        if (
          player.id ==
          null
        ) {
          continue;
        }

        const candidates =
          (
            records ??
            []
          ).filter(
            (
              record,
            ) =>
              record.playerId ===
                player.id &&
              record.date <
                date &&
              record.weight !=
                null,
          );

        if (
          candidates.length ===
          0
        ) {
          continue;
        }

        if (
          comparisonMode ===
          "previous"
        ) {
          const previous =
            [
              ...candidates,
            ].sort(
              (
                a,
                b,
              ) =>
                b.date.localeCompare(
                  a.date,
                ),
            )[0];

          if (
            previous
          ) {
            map.set(
              player.id,
              previous,
            );
          }

          continue;
        }

        if (
          !referenceDate
        ) {
          continue;
        }

        const refTime =
          dateMs(
            referenceDate,
          );

        const closest =
          [
            ...candidates,
          ].sort(
            (
              a,
              b,
            ) => {
              const diffA =
                Math.abs(
                  dateMs(
                    a.date,
                  ) -
                    refTime,
                );

              const diffB =
                Math.abs(
                  dateMs(
                    b.date,
                  ) -
                    refTime,
                );

              if (
                diffA !==
                diffB
              ) {
                return (
                  diffA -
                  diffB
                );
              }

              const aIsBefore =
                a.date <=
                referenceDate;

              const bIsBefore =
                b.date <=
                referenceDate;

              if (
                aIsBefore !==
                bIsBefore
              ) {
                return aIsBefore
                  ? -1
                  : 1;
              }

              return b.date.localeCompare(
                a.date,
              );
            },
          )[0];

        if (
          closest
        ) {
          map.set(
            player.id,
            closest,
          );
        }
      }

      return map;
    }, [
      players,
      records,
      date,
      comparisonMode,
      referenceDate,
    ]);

  const reportRows =
    useMemo(() => {
      return (
        players ??
        []
      )
        .filter(
          (
            player,
          ) =>
            player.id !=
            null,
        )
        .map(
          (
            player,
          ) => {
            const playerId =
              player.id as number;

            const draft =
              drafts[
                playerId
              ] ?? {
                weight:
                  "",

                condition:
                  "normal" as WeightCondition,

                notes:
                  "",
              };

            const currentWeight =
              parseNum(
                draft.weight,
              );

            const reference =
              referenceByPlayer.get(
                playerId,
              );

            const difference =
              currentWeight !==
                null &&
              reference?.weight !=
                null
                ? currentWeight -
                  reference.weight
                : null;

            const hasCurrentRecord =
              recordsForDate.has(
                playerId,
              );

            const hasData =
              hasCurrentRecord ||
              currentWeight !==
                null ||
              draft.condition !==
                "normal" ||
              draft.notes.trim() !==
                "";

            return {
              player,
              currentWeight,
              reference,
              difference,

              condition:
                draft.condition,

              notes:
                draft.notes.trim(),

              hasData,

              usedDifferentDate:
                comparisonMode ===
                  "date" &&
                Boolean(
                  referenceDate &&
                    reference?.date &&
                    reference.date !==
                      referenceDate,
                ),
            };
          },
        )
        .filter(
          (
            row,
          ) =>
            row.hasData,
        );
    }, [
      players,
      drafts,
      referenceByPlayer,
      recordsForDate,
      comparisonMode,
      referenceDate,
    ]);

  const comparisonDescription =
    comparisonMode ===
    "previous"
      ? "Último pesaje previo de cada jugadora"
      : referenceDate
        ? `Fecha objetivo ${fmtDate(
            referenceDate,
          )}`
        : "Fecha de referencia";

  function updateDraft(
    playerId: number,
    patch:
      Partial<Draft>,
  ) {
    setDrafts(
      (
        current,
      ) => ({
        ...current,

        [playerId]: {
          ...(
            current[
              playerId
            ] ?? {
              weight:
                "",

              condition:
                "normal",

              notes:
                "",
            }
          ),

          ...patch,
        },
      }),
    );
  }

  async function guardar() {
    console.log(
      "PESAJES: click guardar",
      {
        date,
        players:
          players?.length ??
          0,
      },
    );

    if (!players) {
      console.warn(
        "PESAJES: players todavía no cargó",
      );

      return;
    }

    try {
      setSaving(
        true,
      );

      console.log(
        "PESAJES: inicio del guardado",
      );

      let saved = 0;

      for (
        const player
        of players
      ) {
        if (
          player.id ==
          null
        ) {
          continue;
        }

        const draft =
          drafts[
            player.id
          ];

        if (!draft) {
          continue;
        }

        const weight =
          parseNum(
            draft.weight,
          );

        const notes =
          draft.notes.trim();

        const existing =
          recordsForDate.get(
            player.id,
          );

        const hasData =
          weight !==
            null ||
          draft.condition !==
            "normal" ||
          notes !==
            "";

        if (
          !hasData &&
          !existing
        ) {
          continue;
        }

        console.log(
          "PESAJES: procesando jugadora",
          {
            id:
              player.id,

            name:
              player.name,

            weight,

            condition:
              draft.condition,

            existingId:
              existing?.id ??
              null,
          },
        );

        console.log(
          "PESAJES: llamando upsertWeightRecord",
          player.name,
        );

        const savedId =
          await upsertWeightRecord(
            {
              id:
                existing?.id,

              playerId:
                player.id,

              date,

              weight,

              condition:
                draft.condition,

              notes:
                notes ||
                null,

              createdAt:
                existing?.createdAt ??
                nowISO(),

              updatedAt:
                nowISO(),
            },
          );

        console.log(
          "PESAJES: guardado OK",
          {
            player:
              player.name,

            id:
              savedId,
          },
        );

        saved++;
      }

      console.log(
        "PESAJES: proceso completo",
        {
          saved,
        },
      );

      toast.success(
        `${saved} registros de pesaje guardados`,
      );
    } catch (error) {
      console.error(
        "PESAJES: ERROR AL GUARDAR",
        error,
      );

      toast.error(
        "No se pudieron guardar los pesajes",
      );
    } finally {
      console.log(
        "PESAJES: fin guardar()",
      );

      setSaving(
        false,
      );
    }
  }

  return (
    <AppLayout
      title="Pesajes"
      subtitle="Carga grupal y seguimiento semanal"
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={
              reportRows.length ===
              0
            }
            onClick={() =>
              window.print()
            }
          >
            <Printer className="h-4 w-4" />

            Imprimir informe
          </Button>

          <Button
            type="button"
            onClick={() => {
              console.log(
                "PESAJES: botón Guardar presionado",
              );

              void guardar();
            }}
            disabled={
              saving
            }
          >
            <Save className="h-4 w-4" />

            {saving
              ? "Guardando..."
              : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="no-print">
        <div className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="panel-title text-xs text-muted-foreground">
                Fecha del pesaje
              </span>

              <input
                type="date"
                value={
                  date
                }
                onChange={(
                  e,
                ) =>
                  setDate(
                    e.target
                      .value,
                  )
                }
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 md:max-w-xs"
              />
            </label>

            <label className="text-sm">
              <span className="panel-title text-xs text-muted-foreground">
                Buscar jugadora
              </span>

              <input
                value={
                  search
                }
                onChange={(
                  e,
                ) =>
                  setSearch(
                    e.target
                      .value,
                  )
                }
                placeholder="Buscar..."
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={
                !latestWeightDate
              }
              onClick={() => {
                if (
                  latestWeightDate
                ) {
                  setDate(
                    latestWeightDate,
                  );
                }
              }}
            >
              <Clock3 className="h-4 w-4" />

              Último pesaje
            </Button>

            {latestWeightDate && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Último registrado:
                </span>{" "}

                <strong>
                  {fmtDate(
                    latestWeightDate,
                  )}
                </strong>
              </div>
            )}
          </div>

          {!selectedDateHasRecords && (
            <div className="mt-4 rounded-md border border-border bg-muted/50 p-3 text-sm">
              No hay pesajes cargados para{" "}

              <strong>
                {fmtDate(
                  date,
                )}
              </strong>
              .
            </div>
          )}

          <div className="mt-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />

              <p className="panel-title text-xs text-muted-foreground">
                Fechas con pesajes
              </p>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {weightDates.map(
                (
                  weightDate,
                ) => (
                  <button
                    key={
                      weightDate
                    }
                    type="button"
                    onClick={() =>
                      setDate(
                        weightDate,
                      )
                    }
                    className={
                      weightDate ===
                      date
                        ? "rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                        : "rounded-md border border-border bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
                    }
                  >
                    {fmtDate(
                      weightDate,
                    )}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-accent" />

            <div>
              <h2 className="font-display font-semibold">
                Comparación
              </h2>

              <p className="text-xs text-muted-foreground">
                Elegí contra qué pesaje calcular la diferencia.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant={
                comparisonMode ===
                "previous"
                  ? "default"
                  : "outline"
              }
              onClick={() =>
                setComparisonMode(
                  "previous",
                )
              }
            >
              Último pesaje de cada jugadora
            </Button>

            <Button
              type="button"
              variant={
                comparisonMode ===
                "date"
                  ? "default"
                  : "outline"
              }
              onClick={() =>
                setComparisonMode(
                  "date",
                )
              }
            >
              Comparar con una fecha
            </Button>
          </div>

          {comparisonMode ===
            "previous" && (
            <p className="mt-3 text-sm text-muted-foreground">
              Cada jugadora se compara con su último peso real disponible,
              aunque haya faltado a controles intermedios.
            </p>
          )}

          {comparisonMode ===
            "date" && (
            <div className="mt-4">
              <label className="text-sm">
                <span className="panel-title text-xs text-muted-foreground">
                  Fecha de referencia
                </span>

                <select
                  value={
                    referenceDate
                  }
                  onChange={(
                    e,
                  ) =>
                    setReferenceDate(
                      e.target
                        .value,
                    )
                  }
                  className="mt-1 h-10 w-full max-w-xs rounded-md border border-input bg-background px-3"
                >
                  {availableReferenceDates.map(
                    (
                      weightDate,
                    ) => (
                      <option
                        key={
                          weightDate
                        }
                        value={
                          weightDate
                        }
                      >
                        {fmtDate(
                          weightDate,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              {referenceDate && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Fecha objetivo:{" "}

                  <strong>
                    {fmtDate(
                      referenceDate,
                    )}
                  </strong>
                  . Si una jugadora no tiene peso ese día, se usa su pesaje
                  más cercano disponible y se muestra la fecha realmente
                  utilizada.
                </p>
              )}
            </div>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            “Indispuesta” funciona como contexto del pesaje: igualmente podés
            cargar su peso.
          </p>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card shadow-panel">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-muted/70">
              <tr>
                <th className="px-4 py-3 text-left">
                  Jugadora
                </th>

                <th className="px-4 py-3 text-right">
                  Peso
                </th>

                <th className="px-4 py-3 text-right">
                  {comparisonMode ===
                  "previous"
                    ? "Anterior"
                    : "Referencia"}
                </th>

                <th className="px-4 py-3 text-right">
                  Diferencia
                </th>

                <th className="px-4 py-3 text-left">
                  Condición
                </th>

                <th className="px-4 py-3 text-left">
                  Observación
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredPlayers.map(
                (
                  player,
                ) => {
                  if (
                    player.id ==
                    null
                  ) {
                    return null;
                  }

                  const draft =
                    drafts[
                      player.id
                    ] ?? {
                      weight:
                        "",

                      condition:
                        "normal" as WeightCondition,

                      notes:
                        "",
                    };

                  const reference =
                    referenceByPlayer.get(
                      player.id,
                    );

                  const currentWeight =
                    parseNum(
                      draft.weight,
                    );

                  const difference =
                    currentWeight !==
                      null &&
                    reference?.weight !=
                      null
                      ? currentWeight -
                        reference.weight
                      : null;

                  const usedDifferentDate =
                    comparisonMode ===
                      "date" &&
                    referenceDate &&
                    reference?.date &&
                    reference.date !==
                      referenceDate;

                  return (
                    <tr
                      key={
                        player.id
                      }
                      className="border-t border-border"
                    >
                      <td className="px-4 py-3 font-semibold">
                        {player.name}
                      </td>

                      <td className="px-4 py-2 text-right">
                        <input
                          inputMode="decimal"
                          value={
                            draft.weight
                          }
                          onChange={(
                            e,
                          ) =>
                            updateDraft(
                              player.id!,
                              {
                                weight:
                                  e
                                    .target
                                    .value,
                              },
                            )
                          }
                          placeholder="kg"
                          className="numeric h-9 w-24 rounded-md border border-input bg-background px-2 text-right"
                        />
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="numeric text-muted-foreground">
                          {fmt(
                            reference?.weight,
                            1,
                          )}
                        </div>

                        {reference?.date && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {fmtDate(
                              reference.date,
                            )}
                          </div>
                        )}

                        {usedDifferentDate && (
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            más cercano a{" "}

                            {fmtDate(
                              referenceDate,
                            )}
                          </div>
                        )}
                      </td>

                      <td className="numeric px-4 py-3 text-right font-semibold">
                        <span
                          className={`inline-block min-w-[60px] rounded-md px-2 py-1 text-center ${differenceClass(
                            difference,
                          )}`}
                        >
                          {fmtDiff(
                            difference,
                            1,
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-2">
                        <select
                          value={
                            draft.condition
                          }
                          onChange={(
                            e,
                          ) =>
                            updateDraft(
                              player.id!,
                              {
                                condition:
                                  e
                                    .target
                                    .value as WeightCondition,
                              },
                            )
                          }
                          className="h-9 w-full min-w-[140px] rounded-md border border-input bg-background px-2"
                        >
                          {WEIGHT_CONDITIONS.map(
                            (
                              condition,
                            ) => (
                              <option
                                key={
                                  condition.value
                                }
                                value={
                                  condition.value
                                }
                              >
                                {condition.label}
                              </option>
                            ),
                          )}
                        </select>
                      </td>

                      <td className="px-4 py-2">
                        <input
                          value={
                            draft.notes
                          }
                          onChange={(
                            e,
                          ) =>
                            updateDraft(
                              player.id!,
                              {
                                notes:
                                  e
                                    .target
                                    .value,
                              },
                            )
                          }
                          placeholder="Opcional"
                          className="h-9 w-full min-w-[180px] rounded-md border border-input bg-background px-2"
                        />
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4 text-sm">
          <strong>
            Cómo funciona:
          </strong>{" "}
          podés comparar cada pesaje contra el último registro de cada jugadora
          o elegir una fecha histórica como referencia. Si una jugadora faltó
          en la fecha elegida, la app utiliza automáticamente su medición más
          cercana y te indica qué fecha usó.
        </div>
      </div>

      <div className="hidden print:block">
        <div className="overflow-hidden rounded-xl border border-primary/20 bg-white">
          <div className="border-t-[10px] border-primary bg-white px-6 py-5">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-2">
                  <img
                    src="/logo-san-lorenzo.png"
                    alt="Escudo de San Lorenzo"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Club Atlético San Lorenzo de Almagro
                  </p>

                  <h1 className="mt-1 text-3xl font-bold uppercase text-primary">
                    Informe de Pesajes
                  </h1>

                  <p className="mt-1 text-sm font-semibold text-accent">
                    Primera División · Fútbol Femenino
                  </p>
                </div>
              </div>

              <div className="min-w-[180px] rounded-xl border border-primary/20 bg-muted/20 px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Fecha del pesaje
                </p>

                <p className="mt-1 text-2xl font-bold text-primary">
                  {fmtDate(
                    date,
                  )}
                </p>
              </div>
            </div>

            <div className="mt-4 h-1.5 w-full rounded-full bg-accent" />
          </div>

          <div className="bg-white px-6 py-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Comparación utilizada
                </p>

                <p className="mt-1 font-bold text-primary">
                  {comparisonDescription}
                </p>
              </div>

              <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-4 text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Jugadoras incluidas
                </p>

                <p className="mt-1 text-2xl font-bold text-primary">
                  {reportRows.length}
                </p>
              </div>
            </div>

            {comparisonMode ===
              "date" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Cuando una jugadora no posee un registro exactamente en la
                fecha seleccionada, se utiliza su pesaje más cercano disponible.
                La fecha realmente utilizada se informa en la tabla.
              </p>
            )}

            <table className="mt-5 w-full border-collapse text-xs">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="border border-primary px-3 py-2 text-left">
                    Jugadora
                  </th>

                  <th className="border border-primary px-3 py-2 text-right">
                    Peso
                  </th>

                  <th className="border border-primary px-3 py-2 text-right">
                    Referencia
                  </th>

                  <th className="border border-primary px-3 py-2 text-right">
                    Diferencia
                  </th>

                  <th className="border border-primary px-3 py-2 text-left">
                    Condición
                  </th>

                  <th className="border border-primary px-3 py-2 text-left">
                    Observación
                  </th>
                </tr>
              </thead>

              <tbody>
                {reportRows.map(
                  (
                    row,
                    index,
                  ) => (
                    <tr
                      key={
                        row.player.id
                      }
                      className={
                        index %
                          2 ===
                        0
                          ? "bg-white"
                          : "bg-muted/40"
                      }
                    >
                      <td className="border border-border px-3 py-2 font-semibold text-primary">
                        {row.player.name}
                      </td>

                      <td className="border border-border px-3 py-2 text-right font-semibold">
                        {formatKg(
                          row.currentWeight,
                        )}
                      </td>

                      <td className="border border-border px-3 py-2 text-right">
                        <div className="font-semibold">
                          {formatKg(
                            row.reference
                              ?.weight,
                          )}
                        </div>

                        {row.reference
                          ?.date && (
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {fmtDate(
                              row.reference
                                .date,
                            )}

                            {row.usedDifferentDate
                              ? " *"
                              : ""}
                          </div>
                        )}
                      </td>

                      <td className="border border-border px-3 py-2 text-right font-bold">
                        {formatDiffKg(
                          row.difference,
                        )}
                      </td>

                      <td className="border border-border px-3 py-2">
                        {conditionLabel(
                          row.condition,
                        )}
                      </td>

                      <td className="border border-border px-3 py-2">
                        {row.notes ||
                          "—"}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>

            {comparisonMode ===
              "date" &&
              reportRows.some(
                (
                  row,
                ) =>
                  row.usedDifferentDate,
              ) && (
                <p className="mt-3 text-[10px] text-muted-foreground">
                  * La fecha utilizada no coincide exactamente con la fecha
                  objetivo. Se tomó el pesaje más cercano disponible para esa
                  jugadora.
                </p>
              )}

            <div className="mt-6 flex items-center justify-between border-t-2 border-accent pt-3 text-xs text-muted-foreground">
              <p>
                Nutrición · Primera División Fútbol Femenino
              </p>

              <p className="font-semibold text-primary">
                Club Atlético San Lorenzo de Almagro
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
