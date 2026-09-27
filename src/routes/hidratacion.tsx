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
