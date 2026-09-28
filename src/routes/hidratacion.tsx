import { createFileRoute } from "@tanstack/react-router";
import {
  Droplets,
  Plus,
  Printer,
  Save,
  Share2,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app-layout";
import { ClientOnly } from "@/components/client-only";
import { Button } from "@/components/ui/button";
import { fmtDate, todayISO } from "@/lib/calc";
import {
  deleteHydrationTest,
  nowISO,
  upsertHydrationTest,
} from "@/lib/db";
import {
  useHydrationTests,
  usePlayers,
} from "@/lib/hooks";
import { createHydrationReportPdf } from "@/lib/hydration-report-pdf";
import { shareFile } from "@/lib/share-file";
import {
  HYDRATION_CONTEXTS,
  HYDRATION_DAY_TYPES,
  type HydrationContext,
  type HydrationDayType,
  type HydrationEntry,
  type HydrationTest,
  type Player,
} from "@/lib/types";

export const Route = createFileRoute("/hidratacion")({
  component: () => (
    <ClientOnly>
      <HydrationPage />
    </ClientOnly>
  ),
});

const HYDRATION_OBSERVATIONS = [
  { value: "", label: "Sin observación" },
  { value: "Indispuesta", label: "Indispuesta" },
  { value: "No citada", label: "No citada" },
  { value: "Ausente", label: "Ausente" },
  { value: "Lesión", label: "Lesión" },
  { value: "Reserva", label: "Reserva" },
  { value: "Otros", label: "Otros" },
] as const;

type ObservationValue =
  (typeof HYDRATION_OBSERVATIONS)[number]["value"];

type PrintMode =
  | "values"
  | "both"
  | "chart";

type DraftEntry = {
  playerId: number | null;
  playerName: string;
  value: string;
  observation: ObservationValue;
  customObservation: string;
};

type Draft = {
  id?: number;
  date: string;
  round: string;
  rival: string;
  dayType: HydrationDayType;
  context: HydrationContext;
  customContext: string;
  entries: DraftEntry[];
  createdAt?: string;
};

function parseHydrationValue(
  value: string,
): number | null {
  const clean = value
    .trim()
    .replace(",", ".");

  if (!clean) return null;

  const parsed = Number(clean);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function hydrationStatus(
  value: number | null,
) {
  if (value == null) {
    return "Sin dato";
  }

  return value <= 1020
    ? "Bien hidratada"
    : "Deshidratada";
}

function statusClass(
  value: number | null,
) {
  if (value == null) {
    return "border border-border bg-muted text-muted-foreground";
  }

  return value <= 1020
    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border border-rose-200 bg-rose-50 text-rose-700";
}

function dayTypeLabel(
  value: HydrationDayType,
) {
  return (
    HYDRATION_DAY_TYPES.find(
      (item) => item.value === value,
    )?.label ?? value
  );
}

function contextLabel(
  context: HydrationContext,
  customContext?: string | null,
) {
  if (
    context === "otro" &&
    customContext?.trim()
  ) {
    return customContext.trim();
  }

  return (
    HYDRATION_CONTEXTS.find(
      (item) =>
        item.value === context,
    )?.label ?? context
  );
}

function observationDraft(
  observation?: string | null,
): {
  observation: ObservationValue;
  customObservation: string;
} {
  const raw =
    observation?.trim() ?? "";

  if (!raw) {
    return {
      observation: "",
      customObservation: "",
    };
  }

  const exact =
    HYDRATION_OBSERVATIONS.find(
      (item) =>
        item.value !== "" &&
        item.value !== "Otros" &&
        item.value.toLowerCase() ===
          raw.toLowerCase(),
    );

  if (exact) {
    return {
      observation:
        exact.value as ObservationValue,
      customObservation: "",
    };
  }

  return {
    observation: "Otros",
    customObservation: raw,
  };
}

function savedObservation(
  entry: DraftEntry,
): string | null {
  if (!entry.observation) {
    return null;
  }

  if (
    entry.observation === "Otros"
  ) {
    return (
      entry.customObservation.trim() ||
      null
    );
  }

  return entry.observation;
}

function entriesFromPlayers(
  players: Player[] | undefined,
): DraftEntry[] {
  return (players ?? [])
    .filter(
      (player) =>
        player.active === 1 &&
        player.id != null,
    )
    .map((player) => ({
      playerId:
        player.id as number,
      playerName: player.name,
      value: "",
      observation: "",
      customObservation: "",
    }));
}

function draftFromTest(
  test: HydrationTest,
): Draft {
  return {
    id: test.id,
    date: test.date,
    round:
      test.round == null
        ? ""
        : String(test.round),
    rival: test.rival ?? "",
    dayType: test.dayType,
    context: test.context,
    customContext:
      test.customContext ?? "",
    entries: test.entries.map(
      (entry) => ({
        playerId:
          entry.playerId ?? null,
        playerName:
          entry.playerName,
        value:
          entry.value == null
            ? ""
            : String(entry.value),
        ...observationDraft(
          entry.observation,
        ),
      }),
    ),
    createdAt: test.createdAt,
  };
}

function emptyDraft(
  players: Player[] | undefined,
): Draft {
  return {
    date: todayISO(),
    round: "",
    rival: "",
    dayType:
      "sin_especificar",
    context: "pre_entreno",
    customContext: "",
    entries:
      entriesFromPlayers(
        players,
      ),
  };
}

function PrintHeader({
  draft,
}: {
  draft: Draft;
}) {
  return (
    <div className="print-report-header">
      <div className="flex items-center gap-3">
        <img
          src="/logo-san-lorenzo.png"
          alt="San Lorenzo"
          className="print-logo object-contain"
        />

        <div className="min-w-0 flex-1">
          <p className="print-club-name">
            SAN LORENZO · FÚTBOL FEMENINO
          </p>

          <h1 className="print-main-title">
            TEST DE HIDRATACIÓN
          </h1>
        </div>
      </div>

      <div className="print-meta-grid">
        <p>
          <strong>Fecha:</strong>{" "}
          {fmtDate(draft.date)}
        </p>

        <p>
          <strong>Rival:</strong>{" "}
          {draft.rival.trim() || "—"}
        </p>

        <p>
          <strong>N.º de fecha:</strong>{" "}
          {draft.round.trim() || "—"}
        </p>

        <p>
          <strong>Tipo de día:</strong>{" "}
          {dayTypeLabel(draft.dayType)}
        </p>

        <p>
          <strong>Contexto:</strong>{" "}
          {contextLabel(
            draft.context,
            draft.customContext,
          )}
        </p>
      </div>
    </div>
  );
}

function HydrationPage() {
  const players = usePlayers();
  const tests = useHydrationTests();

  const [selectedId, setSelectedId] =
    useState<number | null>(null);

  const [creating, setCreating] =
    useState(false);

  const [draft, setDraft] =
    useState<Draft | null>(null);

  const [search, setSearch] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [sharing, setSharing] =
    useState(false);

  const [printMode, setPrintMode] =
    useState<PrintMode>("both");

  useEffect(() => {
    if (
      creating ||
      !tests ||
      tests.length === 0
    ) {
      return;
    }

    if (
      selectedId == null ||
      !tests.some(
        (test) =>
          test.id === selectedId,
      )
    ) {
      const first =
        tests[0];

      if (first?.id != null) {
        setSelectedId(first.id);
      }
    }
  }, [
    tests,
    selectedId,
    creating,
  ]);

  useEffect(() => {
    if (creating) {
      return;
    }

    if (
      selectedId == null ||
      !tests
    ) {
      return;
    }

    const selected =
      tests.find(
        (test) =>
          test.id === selectedId,
      );

    if (selected) {
      setDraft(
        draftFromTest(selected),
      );
    }
  }, [
    selectedId,
    tests,
    creating,
  ]);

  const filteredEntries =
    useMemo(() => {
      const entries =
        draft?.entries ?? [];

      const text =
        search
          .trim()
          .toLowerCase();

      if (!text) {
        return entries.map(
          (entry, index) => ({
            entry,
            index,
          }),
        );
      }

      return entries
        .map(
          (entry, index) => ({
            entry,
            index,
          }),
        )
        .filter(({ entry }) =>
          entry.playerName
            .toLowerCase()
            .includes(text),
        );
    }, [draft, search]);

  const summary = useMemo(() => {
    let hydrated = 0;
    let dehydrated = 0;
    let noData = 0;

    for (
      const entry of
      draft?.entries ?? []
    ) {
      const value =
        parseHydrationValue(
          entry.value,
        );

      if (value == null) {
        noData++;
      } else if (
        value <= 1020
      ) {
        hydrated++;
      } else {
        dehydrated++;
      }
    }

    const measured =
      hydrated + dehydrated;

    const hydratedPercent =
      measured > 0
        ? (hydrated / measured) * 100
        : 0;

    const dehydratedPercent =
      measured > 0
        ? (dehydrated / measured) * 100
        : 0;

    return {
      hydrated,
      dehydrated,
      noData,
      measured,
      hydratedPercent,
      dehydratedPercent,
    };
  }, [draft]);

  function createNewTest() {
    setCreating(true);
    setSelectedId(null);
    setSearch("");
    setDraft(
      emptyDraft(players),
    );
  }

  function selectTest(
    id: number,
  ) {
    setCreating(false);
    setSelectedId(id);
    setSearch("");
  }

  function updateEntry(
    index: number,
    patch: Partial<DraftEntry>,
  ) {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextEntries =
        [...current.entries];

      nextEntries[index] = {
        ...nextEntries[index],
        ...patch,
      };

      return {
        ...current,
        entries: nextEntries,
      };
    });
  }

  async function saveTest() {
    if (!draft) return;

    if (!draft.date) {
      toast.error(
        "Elegí la fecha del test",
      );
      return;
    }

    const customContext =
      draft.customContext.trim();

    if (
      draft.context ===
        "otro" &&
      !customContext
    ) {
      toast.error(
        "Escribí el contexto del test",
      );
      return;
    }

    const roundText =
      draft.round.trim();

    const round =
      roundText === ""
        ? null
        : Number(roundText);

    if (
      round !== null &&
      (!Number.isFinite(round) ||
        round < 1)
    ) {
      toast.error(
        "Revisá el número de fecha",
      );
      return;
    }

    const entries: HydrationEntry[] =
      draft.entries.map(
        (entry) => ({
          playerId:
            entry.playerId,
          playerName:
            entry.playerName,
          value:
            parseHydrationValue(
              entry.value,
            ),
          observation:
            savedObservation(
              entry,
            ),
        }),
      );

    try {
      setSaving(true);

      const id =
        await upsertHydrationTest({
          id: draft.id,
          date: draft.date,
          round,
          rival:
            draft.rival.trim() ||
            null,
          dayType:
            draft.dayType,
          context:
            draft.context,
          customContext:
            draft.context ===
              "otro"
              ? customContext
              : null,
          entries,
          createdAt:
            draft.createdAt ??
            nowISO(),
          updatedAt: nowISO(),
        });

      setCreating(false);
      setSelectedId(
        Number(id),
      );

      toast.success(
        draft.id
          ? "Test de hidratación actualizado"
          : "Test de hidratación guardado",
      );
    } catch (error) {
      console.error(error);

      toast.error(
        "No se pudo guardar el test",
      );
    } finally {
      setSaving(false);
    }
  }

  async function shareHydrationTest() {
    if (!draft) {
      return;
    }

    setSharing(true);

    try {
      const roundText =
        draft.round.trim();

      const parsedRound =
        roundText === ""
          ? null
          : Number(roundText);

      const {
        blob,
        fileName,
      } =
        createHydrationReportPdf({
          date:
            draft.date,

          rival:
            draft.rival.trim() ||
            null,

          round:
            parsedRound != null &&
            Number.isFinite(
              parsedRound,
            )
              ? parsedRound
              : null,

          dayType:
            dayTypeLabel(
              draft.dayType,
            ),

          context:
            contextLabel(
              draft.context,
              draft.customContext,
            ),

          entries:
            draft.entries.map(
              (entry) => ({
                playerName:
                  entry.playerName,

                value:
                  parseHydrationValue(
                    entry.value,
                  ),

                observation:
                  savedObservation(
                    entry,
                  ),
              }),
            ),

          mode:
            printMode,
        });

      const result =
        await shareFile({
          blob,
          fileName,
          title: `Test de hidratación · ${fmtDate(
            draft.date,
          )}`,
          text: `Test de hidratación · ${fmtDate(
            draft.date,
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
      console.error(error);

      toast.error(
        "No se pudo compartir el test de hidratación.",
      );
    } finally {
      setSharing(false);
    }
  }

  async function removeTest() {
    if (!draft?.id) {
      return;
    }

    const confirmed =
      window.confirm(
        "¿Eliminar este test de hidratación? Esta acción no se puede deshacer.",
      );

    if (!confirmed) {
      return;
    }

    try {
      await deleteHydrationTest(
        draft.id,
      );

      setDraft(null);
      setSelectedId(null);
      setCreating(false);

      toast.success(
        "Test eliminado",
      );
    } catch (error) {
      console.error(error);

      toast.error(
        "No se pudo eliminar el test",
      );
    }
  }

  return (
    <AppLayout
      title="Test de hidratación"
      subtitle="Registro por fecha, contexto y jugadora"
      actions={
        <>
          <div className="hidden items-center gap-2 sm:flex">
            <select
              aria-label="Qué imprimir"
              value={printMode}
              onChange={(event) =>
                setPrintMode(
                  event.target.value as PrintMode,
                )
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="both">
                Valores + gráfico
              </option>

              <option value="values">
                Solo valores
              </option>

              <option value="chart">
                Solo gráfico
              </option>
            </select>

            <Button
              type="button"
              variant="outline"
              disabled={
                !draft ||
                sharing
              }
              onClick={() =>
                void shareHydrationTest()
              }
            >
              <Share2 className="h-4 w-4" />

              {sharing
                ? "Preparando..."
                : "Compartir"}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={!draft}
              onClick={() =>
                window.print()
              }
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>

          <Button
            onClick={
              createNewTest
            }
          >
            <Plus className="h-4 w-4" />
            Nuevo test
          </Button>
        </>
      }
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          .hydration-print {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #0f172a !important;
          }

          .hydration-values-table {
            width: 100% !important;
            border-collapse: collapse !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            table-layout: fixed !important;
          }

          .hydration-values-table caption {
            caption-side: top !important;
            display: table-caption !important;
            text-align: left !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .hydration-values-table tbody {
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          .hydration-values-table tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .hydration-values-table th,
          .hydration-values-table td {
            border: 1px solid #cbd5e1 !important;
            padding: 2.5px 5px !important;
            font-size: 8px !important;
            line-height: 1.05 !important;
            vertical-align: middle !important;
          }

          .hydration-values-table th {
            background: #0b234a !important;
            color: #ffffff !important;
            font-weight: 700 !important;
          }

          .hydration-values-table .print-spacer-column {
            background: #ffffff !important;
            border: 0 !important;
            padding: 0 !important;
            color: transparent !important;
          }

          .print-report-header {
            border: 1px solid #cbd5e1 !important;
            background: #f8fafc !important;
            border-radius: 7px !important;
            padding: 6px 8px !important;
            margin: 0 0 5px 0 !important;
          }

          .print-logo {
            width: 42px !important;
            height: 42px !important;
            flex: none !important;
          }

          .print-club-name {
            margin: 0 !important;
            font-size: 8px !important;
            line-height: 1 !important;
            font-weight: 700 !important;
            letter-spacing: 0.15em !important;
            color: #64748b !important;
          }

          .print-main-title {
            margin: 3px 0 0 0 !important;
            font-size: 19px !important;
            line-height: 1 !important;
            font-weight: 800 !important;
            letter-spacing: 0.04em !important;
            color: #0f172a !important;
          }

          .print-meta-grid {
            margin-top: 5px !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr !important;
            column-gap: 14px !important;
            row-gap: 1px !important;
            font-size: 8px !important;
            line-height: 1.15 !important;
          }

          .print-meta-grid p {
            margin: 0 !important;
          }

          .print-values-heading {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 10px !important;
            margin: 0 0 4px 0 !important;
          }

          .print-values-heading h2 {
            margin: 0 !important;
            font-size: 12px !important;
            line-height: 1 !important;
            font-weight: 800 !important;
          }

          .print-values-heading p {
            margin: 0 !important;
            font-size: 8px !important;
          }

          .print-status-ok {
            background: #dcfce7 !important;
            color: #166534 !important;
            font-weight: 700 !important;
            text-align: center !important;
          }

          .print-status-bad {
            background: #fee2e2 !important;
            color: #b91c1c !important;
            font-weight: 700 !important;
            text-align: center !important;
          }

          .print-status-empty {
            background: #f1f5f9 !important;
            color: #475569 !important;
            font-weight: 700 !important;
            text-align: center !important;
          }

          .hydration-print-chart {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-top: 10px !important;
          }

          .hydration-print-chart h2 {
            font-size: 14px !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {draft && (
        <div className="hydration-print hidden print:block">
          {printMode !== "chart" ? (
            <table className="hydration-values-table">
              <caption>
                <PrintHeader
                  draft={draft}
                />

                <div className="print-values-heading">
                  <h2>
                    Valores
                  </h2>

                  <p>
                    <strong>
                      {summary.measured}
                    </strong>{" "}
                    mediciones ·{" "}
                    <strong>
                      {summary.noData}
                    </strong>{" "}
                    sin valor
                  </p>
                </div>
              </caption>

              <thead>
                <tr>
                  <th
                    className="text-left"
                    style={{
                      width: "22%",
                    }}
                  >
                    Jugadora
                  </th>

                  <th
                    className="text-center"
                    style={{
                      width: "12%",
                    }}
                  >
                    Valor
                  </th>

                  <th
                    className="text-center"
                    style={{
                      width: "18%",
                    }}
                  >
                    Estado
                  </th>

                  <th
                    className="text-left"
                    style={{
                      width: "16%",
                    }}
                  >
                    Observación
                  </th>

                  <th
                    aria-hidden="true"
                    className="print-spacer-column"
                    style={{
                      width: "32%",
                    }}
                  />
                </tr>
              </thead>

              <tbody>
                {draft.entries.map(
                  (entry, index) => {
                    const value =
                      parseHydrationValue(
                        entry.value,
                      );

                    return (
                      <tr
                        key={`print-${entry.playerId ?? "historic"}-${entry.playerName}-${index}`}
                      >
                        <td>
                          {
                            entry.playerName
                          }
                        </td>

                        <td className="text-center">
                          {value ??
                            "—"}
                        </td>

                        <td
                          className={
                            value == null
                              ? "print-status-empty"
                              : value <=
                                  1020
                                ? "print-status-ok"
                                : "print-status-bad"
                          }
                        >
                          {hydrationStatus(
                            value,
                          )}
                        </td>

                        <td>
                          {savedObservation(
                            entry,
                          ) ??
                            "—"}
                        </td>

                        <td
                          aria-hidden="true"
                          className="print-spacer-column"
                        />
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          ) : (
            <PrintHeader
              draft={draft}
            />
          )}

          {printMode !== "values" && (
            <section className="hydration-print-chart">
              <h2 className="font-bold">
                Estado de hidratación
              </h2>

              <p className="mt-1 text-[9px] text-gray-600">
                Porcentajes calculados solo sobre las jugadoras con medición.
              </p>

              {summary.measured >
              0 ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px]">
                      <strong>
                        Bien hidratadas
                      </strong>

                      <span>
                        {summary.hydratedPercent.toFixed(
                          1,
                        )}
                        % ·{" "}
                        {
                          summary.hydrated
                        }{" "}
                        de{" "}
                        {
                          summary.measured
                        }
                      </span>
                    </div>

                    <div className="h-5 overflow-hidden rounded border border-emerald-700">
                      <div
                        className="flex h-full items-center justify-end bg-emerald-500 px-2 text-[9px] font-bold text-white"
                        style={{
                          width: `${summary.hydratedPercent}%`,
                        }}
                      >
                        {summary.hydratedPercent >=
                        12
                          ? `${summary.hydratedPercent.toFixed(
                              1,
                            )}%`
                          : ""}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px]">
                      <strong>
                        Deshidratadas
                      </strong>

                      <span>
                        {summary.dehydratedPercent.toFixed(
                          1,
                        )}
                        % ·{" "}
                        {
                          summary.dehydrated
                        }{" "}
                        de{" "}
                        {
                          summary.measured
                        }
                      </span>
                    </div>

                    <div className="h-5 overflow-hidden rounded border border-rose-700">
                      <div
                        className="flex h-full items-center justify-end bg-rose-500 px-2 text-[9px] font-bold text-white"
                        style={{
                          width: `${summary.dehydratedPercent}%`,
                        }}
                      >
                        {summary.dehydratedPercent >=
                        12
                          ? `${summary.dehydratedPercent.toFixed(
                              1,
                            )}%`
                          : ""}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 border-t pt-2 text-center">
                    <div>
                      <p className="text-lg font-bold">
                        {
                          summary.hydrated
                        }
                      </p>

                      <p className="text-[9px]">
                        Bien hidratadas
                      </p>
                    </div>

                    <div>
                      <p className="text-lg font-bold">
                        {
                          summary.dehydrated
                        }
                      </p>

                      <p className="text-[9px]">
                        Deshidratadas
                      </p>
                    </div>

                    <div>
                      <p className="text-lg font-bold">
                        {
                          summary.noData
                        }
                      </p>

                      <p className="text-[9px]">
                        Sin medición
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs">
                  No hay valores cargados para calcular porcentajes.
                </p>
              )}
            </section>
          )}
        </div>
      )}

      <div className="no-print mb-4 flex flex-wrap gap-2 sm:hidden">
        <select
          aria-label="Qué imprimir"
          value={printMode}
          onChange={(event) =>
            setPrintMode(
              event.target.value as PrintMode,
            )
          }
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="both">
            Valores + gráfico
          </option>

          <option value="values">
            Solo valores
          </option>

          <option value="chart">
            Solo gráfico
          </option>
        </select>

        <Button
          type="button"
          variant="outline"
          disabled={
            !draft ||
            sharing
          }
          onClick={() =>
            void shareHydrationTest()
          }
        >
          <Share2 className="h-4 w-4" />

          {sharing
            ? "Preparando..."
            : "Compartir"}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={!draft}
          onClick={() =>
            window.print()
          }
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>

      <div className="no-print grid gap-5 xl:grid-cols-[290px_1fr]">
        <aside className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />

            <div>
              <p className="panel-title text-xs text-muted-foreground">
                Historial
              </p>

              <p className="text-sm font-semibold">
                {(tests ?? []).length} tests cargados
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {(tests ?? []).map(
              (test) => {
                if (
                  test.id == null
                ) {
                  return null;
                }

                const active =
                  !creating &&
                  selectedId ===
                    test.id;

                return (
                  <button
                    key={test.id}
                    type="button"
                    onClick={() =>
                      selectTest(
                        test.id!,
                      )
                    }
                    className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {test.rival
                            ? `vs ${test.rival}`
                            : "Sin rival"}
                        </p>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {fmtDate(
                            test.date,
                          )}

                          {test.round !=
                          null
                            ? ` · Fecha ${test.round}`
                            : ""}
                        </p>
                      </div>

                      <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold">
                        {
                          test
                            .entries
                            .length
                        }
                      </span>
                    </div>

                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {dayTypeLabel(
                        test.dayType,
                      )}{" "}
                      ·{" "}
                      {contextLabel(
                        test.context,
                        test.customContext,
                      )}
                    </p>
                  </button>
                );
              },
            )}
          </div>
        </aside>

        <section className="space-y-4">
          {draft ? (
            <>
              <div className="rounded-lg border border-border bg-card p-5 shadow-panel">
                <div className="rounded-xl border border-[#0B234A]/10 bg-gradient-to-r from-[#0B234A]/5 via-background to-[#C8102E]/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <img
                        src="/logo-san-lorenzo.png"
                        alt="San Lorenzo"
                        className="mt-1 h-12 w-12 rounded-full border border-border bg-white object-contain p-1"
                      />

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                          {creating
                            ? "Nuevo test"
                            : "Test registrado"}
                        </p>

                        <h2 className="mt-1 font-display text-2xl font-semibold">
                          {draft.rival.trim()
                            ? `vs ${draft.rival}`
                            : creating
                              ? "Nuevo test de hidratación"
                              : "Test de hidratación"}
                        </h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                          La clasificación se calcula automáticamente:
                          hasta 1020 inclusive = bien hidratada;
                          desde 1021 = deshidratada.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!creating &&
                        draft.id !=
                          null && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              void removeTest()
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </Button>
                        )}

                      <Button
                        onClick={() =>
                          void saveTest()
                        }
                        disabled={saving}
                      >
                        <Save className="h-4 w-4" />

                        {saving
                          ? "Guardando..."
                          : "Guardar test"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <label className="text-sm">
                    <span className="panel-title text-xs text-muted-foreground">
                      Fecha
                    </span>

                    <input
                      type="date"
                      value={
                        draft.date
                      }
                      onChange={(
                        event,
                      ) =>
                        setDraft({
                          ...draft,
                          date: event
                            .target
                            .value,
                        })
                      }
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                    />
                  </label>

                  <label className="text-sm">
                    <span className="panel-title text-xs text-muted-foreground">
                      N.º de fecha
                    </span>

                    <input
                      type="number"
                      min="1"
                      value={
                        draft.round
                      }
                      onChange={(
                        event,
                      ) =>
                        setDraft({
                          ...draft,
                          round:
                            event
                              .target
                              .value,
                        })
                      }
                      placeholder="Ej. 9"
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                    />
                  </label>

                  <label className="text-sm">
                    <span className="panel-title text-xs text-muted-foreground">
                      Rival
                    </span>

                    <input
                      value={
                        draft.rival
                      }
                      onChange={(
                        event,
                      ) =>
                        setDraft({
                          ...draft,
                          rival:
                            event
                              .target
                              .value,
                        })
                      }
                      placeholder="Ej. River"
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                    />
                  </label>

                  <label className="text-sm">
                    <span className="panel-title text-xs text-muted-foreground">
                      Tipo de día
                    </span>

                    <select
                      value={
                        draft.dayType
                      }
                      onChange={(
                        event,
                      ) =>
                        setDraft({
                          ...draft,
                          dayType:
                            event
                              .target
                              .value as HydrationDayType,
                        })
                      }
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                    >
                      {HYDRATION_DAY_TYPES.map(
                        (item) => (
                          <option
                            key={
                              item.value
                            }
                            value={
                              item.value
                            }
                          >
                            {
                              item.label
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="text-sm">
                    <span className="panel-title text-xs text-muted-foreground">
                      Contexto
                    </span>

                    <select
                      value={
                        draft.context
                      }
                      onChange={(
                        event,
                      ) =>
                        setDraft({
                          ...draft,
                          context:
                            event
                              .target
                              .value as HydrationContext,
                        })
                      }
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                    >
                      {HYDRATION_CONTEXTS.map(
                        (item) => (
                          <option
                            key={
                              item.value
                            }
                            value={
                              item.value
                            }
                          >
                            {
                              item.label
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>

                {draft.context ===
                  "otro" && (
                  <label className="mt-4 block max-w-xl text-sm">
                    <span className="panel-title text-xs text-muted-foreground">
                      Especificar contexto
                    </span>

                    <input
                      value={
                        draft.customContext
                      }
                      onChange={(
                        event,
                      ) =>
                        setDraft({
                          ...draft,
                          customContext:
                            event
                              .target
                              .value,
                        })
                      }
                      placeholder="Ej. Al llegar al hotel"
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                    />
                  </label>
                )}

                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  <SummaryCard
                    label="Bien hidratadas"
                    value={
                      summary.hydrated
                    }
                    tone="ok"
                  />

                  <SummaryCard
                    label="Deshidratadas"
                    value={
                      summary.dehydrated
                    }
                    tone="alert"
                  />

                  <SummaryCard
                    label="Sin valor"
                    value={
                      summary.noData
                    }
                    tone="muted"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-border bg-card shadow-panel">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                      Jugadoras
                    </p>

                    <h3 className="mt-1 font-display text-xl font-semibold">
                      Resultados del test
                    </h3>
                  </div>

                  <label className="w-full max-w-xs text-sm">
                    <span className="panel-title text-xs text-muted-foreground">
                      Buscar jugadora
                    </span>

                    <input
                      value={
                        search
                      }
                      onChange={(
                        event,
                      ) =>
                        setSearch(
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="Apellido o nombre..."
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                    />
                  </label>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-muted/80">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">
                          Jugadora
                        </th>

                        <th className="w-[150px] px-4 py-3 text-center font-semibold">
                          Valor
                        </th>

                        <th className="w-[180px] px-4 py-3 text-center font-semibold">
                          Clasificación
                        </th>

                        <th className="w-[250px] px-4 py-3 text-left font-semibold">
                          Observación
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredEntries.map(
                        ({
                          entry,
                          index,
                        }) => {
                          const value =
                            parseHydrationValue(
                              entry.value,
                            );

                          return (
                            <tr
                              key={`${entry.playerId ?? "historic"}-${entry.playerName}-${index}`}
                              className="border-t border-border"
                            >
                              <td className="px-4 py-3 font-medium">
                                {
                                  entry.playerName
                                }

                                {entry.playerId ==
                                  null && (
                                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                    Histórica
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3 text-center">
                                <input
                                  inputMode="numeric"
                                  value={
                                    entry.value
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateEntry(
                                      index,
                                      {
                                        value:
                                          event
                                            .target
                                            .value,
                                      },
                                    )
                                  }
                                  placeholder="—"
                                  className="h-9 w-28 rounded-md border border-input bg-background px-2 text-center numeric"
                                />
                              </td>

                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                                    value,
                                  )}`}
                                >
                                  {hydrationStatus(
                                    value,
                                  )}
                                </span>
                              </td>

                              <td className="px-4 py-3">
                                <div className="space-y-2">
                                  <select
                                    value={
                                      entry.observation
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateEntry(
                                        index,
                                        {
                                          observation:
                                            event
                                              .target
                                              .value as ObservationValue,
                                          customObservation:
                                            event
                                              .target
                                              .value ===
                                            "Otros"
                                              ? entry.customObservation
                                              : "",
                                        },
                                      )
                                    }
                                    className="h-9 w-full rounded-md border border-input bg-background px-3"
                                  >
                                    {HYDRATION_OBSERVATIONS.map(
                                      (
                                        item,
                                      ) => (
                                        <option
                                          key={
                                            item.value ||
                                            "none"
                                          }
                                          value={
                                            item.value
                                          }
                                        >
                                          {
                                            item.label
                                          }
                                        </option>
                                      ),
                                    )}
                                  </select>

                                  {entry.observation ===
                                    "Otros" && (
                                    <input
                                      value={
                                        entry.customObservation
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        updateEntry(
                                          index,
                                          {
                                            customObservation:
                                              event
                                                .target
                                                .value,
                                          },
                                        )
                                      }
                                      placeholder="Especificar observación..."
                                      className="h-9 w-full rounded-md border border-input bg-background px-3"
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5 shadow-panel">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                    Distribución
                  </p>

                  <h3 className="mt-1 font-display text-xl font-semibold">
                    Estado de hidratación
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    El porcentaje se calcula únicamente sobre las jugadoras con un valor registrado.
                    Las jugadoras sin medición no entran en el porcentaje.
                  </p>
                </div>

                {summary.measured >
                0 ? (
                  <>
                    <div className="mt-5 overflow-hidden rounded-full bg-muted">
                      <div className="flex h-8 w-full">
                        {summary.hydratedPercent >
                          0 && (
                          <div
                            className="flex h-full items-center justify-center bg-emerald-500 px-2 text-xs font-bold text-white"
                            style={{
                              width: `${summary.hydratedPercent}%`,
                            }}
                          >
                            {summary.hydratedPercent >=
                              12
                              ? `${summary.hydratedPercent.toFixed(
                                  1,
                                )}%`
                              : ""}
                          </div>
                        )}

                        {summary.dehydratedPercent >
                          0 && (
                          <div
                            className="flex h-full items-center justify-center bg-rose-500 px-2 text-xs font-bold text-white"
                            style={{
                              width: `${summary.dehydratedPercent}%`,
                            }}
                          >
                            {summary.dehydratedPercent >=
                              12
                              ? `${summary.dehydratedPercent.toFixed(
                                  1,
                                )}%`
                              : ""}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-border bg-emerald-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Bien hidratadas
                        </p>

                        <div className="mt-1 flex items-end justify-between gap-3">
                          <p className="numeric text-2xl font-bold text-emerald-700">
                            {summary.hydratedPercent.toFixed(
                              1,
                            )}
                            %
                          </p>

                          <p className="text-sm font-semibold text-emerald-700">
                            {
                              summary.hydrated
                            }{" "}
                            de{" "}
                            {
                              summary.measured
                            }
                          </p>
                        </div>
                      </div>

                      <div className="rounded-md border border-border bg-rose-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                          Deshidratadas
                        </p>

                        <div className="mt-1 flex items-end justify-between gap-3">
                          <p className="numeric text-2xl font-bold text-rose-700">
                            {summary.dehydratedPercent.toFixed(
                              1,
                            )}
                            %
                          </p>

                          <p className="text-sm font-semibold text-rose-700">
                            {
                              summary.dehydrated
                            }{" "}
                            de{" "}
                            {
                              summary.measured
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-5 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                    Todavía no hay valores cargados para calcular porcentajes.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-card p-10 text-center shadow-panel">
              <Droplets className="mx-auto h-8 w-8 text-muted-foreground" />

              <h2 className="mt-3 font-display text-xl font-semibold">
                Preparando tests de hidratación
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Cuando se cargue el historial vas a poder elegir una fecha o crear un test nuevo.
              </p>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

function SummaryCard({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "ok" | "alert" | "muted";
}) {
  const styles =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "alert"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-border bg-muted/30 text-foreground";

  const subtitle =
    tone === "ok"
      ? "text-emerald-700/80"
      : tone === "alert"
        ? "text-rose-700/80"
        : "text-muted-foreground";

  return (
    <div
      className={`rounded-md border px-3 py-3 ${styles}`}
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-wide ${subtitle}`}
      >
        {label}
      </p>

      <p className="numeric mt-1 text-xl font-bold">
        {value}
      </p>
    </div>
  );
}
