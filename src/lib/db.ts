import Dexie, { type Table } from "dexie";

import {
  calculateFiveComponents,
  controlDataFromFullAnthropometry,
} from "./kerr";

import {
  cloudDeleteControl,
  cloudDeleteFullAnthropometry,
  cloudDeleteHydrationTest,
  cloudDeletePlayer,
  cloudDeleteWeightRecord,
  cloudUpsertControl,
  cloudUpsertFullAnthropometry,
  cloudUpsertHydrationTest,
  cloudUpsertObjectivePeriod,
  cloudUpsertPlayer,
  cloudUpsertWeightRecord,
} from "./cloud-write";

import type {
  Control,
  FullAnthropometry,
  HydrationTest,
  ObjectivePeriod,
  Player,
  WeightRecord,
} from "./types";

type PlayerProfile = Player & {
  phone?: string | null;
  email?: string | null;
  generalNotes?: string | null;
};

export class AnthroDB extends Dexie {
  players!: Table<Player, number>;
  controls!: Table<Control, number>;
  weightRecords!: Table<WeightRecord, number>;
  objectivePeriods!: Table<ObjectivePeriod, number>;
  hydrationTests!: Table<HydrationTest, number>;

  fullAnthropometries!: Table<
    FullAnthropometry,
    number
  >;

  constructor() {
    super("sanlorenzo-antropometria");

    this.version(1).stores({
      players: "++id, name, active",
      controls:
        "++id, playerId, date, [playerId+date]",
    });

    this.version(2).stores({
      players: "++id, name, active",
      controls:
        "++id, playerId, date, [playerId+date]",
      weightRecords:
        "++id, playerId, date, condition, [playerId+date]",
    });

    this.version(3).stores({
      players: "++id, name, active",
      controls:
        "++id, playerId, date, [playerId+date]",
      weightRecords:
        "++id, playerId, date, condition, [playerId+date]",
      objectivePeriods:
        "++id, &key, year, month",
    });

    this.version(4).stores({
      players: "++id, name, active",
      controls:
        "++id, playerId, date, [playerId+date]",
      weightRecords:
        "++id, playerId, date, condition, [playerId+date]",
      objectivePeriods:
        "++id, &key, year, month",
      hydrationTests:
        "++id, date, round, dayType, context",
    });

    this.version(5).stores({
      players: "++id, name, active",
      controls:
        "++id, playerId, date, [playerId+date]",
      weightRecords:
        "++id, playerId, date, condition, [playerId+date]",
      objectivePeriods:
        "++id, &key, year, month",
      hydrationTests:
        "++id, date, round, dayType, context",
      fullAnthropometries:
        "++id, playerId, date, source, [playerId+date]",
    });
  }
}

let _db: AnthroDB | null = null;

/* ============================================================
   BASE LOCAL
============================================================ */

export function db(): AnthroDB {
  if (typeof window === "undefined") {
    throw new Error(
      "La base local sólo está disponible en el navegador",
    );
  }

  if (!_db) {
    _db = new AnthroDB();
  }

  return _db;
}

export function nowISO() {
  return new Date().toISOString();
}

/* ============================================================
   CONTROL HABITUAL
============================================================ */

function emptyControl(
  playerId: number,
  date: string,
  v: Partial<Control>,
): Control {
  return {
    playerId,
    date,

    weight: null,

    triceps: null,
    subscapular: null,
    supraespinal: null,
    abdominal: null,
    thighSkinfold: null,
    calfSkinfold: null,

    armPerimeter: null,
    thighPerimeter: null,
    calfPerimeter: null,

    notes: null,

    createdAt: nowISO(),
    updatedAt: nowISO(),

    ...v,
  };
}

/* ============================================================
   DATOS DE EJEMPLO
============================================================ */

let seeded = false;

export async function ensureSeed() {
  if (seeded) return;

  seeded = true;

  const d = db();

  const count =
    await d.players.count();

  /*
   * Si ya existen jugadoras reales,
   * nunca agregamos datos de ejemplo.
   */
  if (count > 0) {
    return;
  }

  const players: Player[] = [
    {
      name: "Camila Rodríguez",
      position: "Delantera",
      birthDate: "2001-04-12",
      active: 1,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      name: "Martina Gómez",
      position: "Mediocampista",
      birthDate: "1999-09-03",
      active: 1,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      name: "Lucía Fernández",
      position: "Defensora",
      birthDate: "2003-01-25",
      active: 1,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
  ];

  const ids =
    await d.players.bulkAdd(
      players,
      {
        allKeys: true,
      },
    );

  const samples: Array<
    [
      number,
      string,
      Partial<Control>,
    ]
  > = [
    [
      0,
      "2026-03-10",
      {
        weight: 58.4,
        triceps: 14.2,
        subscapular: 10.1,
        supraespinal: 8.4,
        abdominal: 15.3,
        thighSkinfold: 20.5,
        calfSkinfold: 12.1,
        armPerimeter: 26.4,
        thighPerimeter: 52.1,
        calfPerimeter: 34.2,
      },
    ],
    [
      0,
      "2026-06-08",
      {
        weight: 57.6,
        triceps: 13.1,
        subscapular: 9.6,
        supraespinal: 7.8,
        abdominal: 13.9,
        thighSkinfold: 19.2,
        calfSkinfold: 11.4,
        armPerimeter: 26.8,
        thighPerimeter: 52.6,
        calfPerimeter: 34.5,
      },
    ],
    [
      0,
      "2026-09-01",
      {
        weight: 57.9,
        triceps: 12.6,
        subscapular: 9.2,
        supraespinal: 7.5,
        abdominal: 13.2,
        thighSkinfold: 18.6,
        calfSkinfold: 11.0,
        armPerimeter: 27.1,
        thighPerimeter: 53.0,
        calfPerimeter: 34.8,
        notes:
          "Pretemporada finalizada.",
      },
    ],
    [
      1,
      "2026-03-11",
      {
        weight: 62.1,
        triceps: 16.4,
        subscapular: 12.3,
        supraespinal: 10.2,
        abdominal: 18.6,
        thighSkinfold: 24.1,
        calfSkinfold: 14.3,
        armPerimeter: 28.0,
        thighPerimeter: 55.4,
        calfPerimeter: 36.1,
      },
    ],
    [
      1,
      "2026-06-09",
      {
        weight: 61.4,
        triceps: 15.5,
        subscapular: 11.8,
        supraespinal: 9.6,
        abdominal: 17.4,
        thighSkinfold: 23.0,
        calfSkinfold: 13.8,
        armPerimeter: 28.3,
        thighPerimeter: 55.7,
        calfPerimeter: 36.3,
      },
    ],
    [
      2,
      "2026-03-12",
      {
        weight: 55.2,
        triceps: 12.8,
        subscapular: 9.4,
        supraespinal: 7.1,
        abdominal: 12.4,
        thighSkinfold: 17.9,
        calfSkinfold: 10.6,
        armPerimeter: 25.2,
        thighPerimeter: 50.3,
        calfPerimeter: 33.1,
      },
    ],
    [
      2,
      "2026-08-20",
      {
        weight: 55.8,
        triceps: 12.4,
        subscapular: 9.1,
        supraespinal: 7.0,
        abdominal: 12.0,
        thighSkinfold: 17.4,
        calfSkinfold: 10.2,
        armPerimeter: 25.6,
        thighPerimeter: 50.8,
        calfPerimeter: 33.4,
      },
    ],
  ];

  await d.controls.bulkAdd(
    samples.map(
      ([i, date, v]) =>
        emptyControl(
          ids[i] as number,
          date,
          v,
        ),
    ),
  );
}

/* ============================================================
   CONTROLES
============================================================ */

export async function deleteControl(
  id: number,
) {
  await db()
    .controls
    .delete(id);

  await cloudDeleteControl(
    id,
  );
}

export async function upsertControl(
  c: Control,
) {
  const d = db();

  /* ===========================
     EDITAR
  =========================== */

  if (c.id != null) {
    const updated:
      Control = {
      ...c,
      updatedAt:
        nowISO(),
    };

    await d.controls.update(
      c.id,
      updated,
    );

    await cloudUpsertControl(
      updated,
    );

    return c.id;
  }

  /* ===========================
     CREAR
  =========================== */

  const created:
    Control = {
    ...c,
    createdAt:
      nowISO(),
    updatedAt:
      nowISO(),
  };

  const id =
    await d.controls.add(
      created,
    );

  const finalRecord:
    Control = {
    ...created,
    id:
      Number(id),
  };

  await cloudUpsertControl(
    finalRecord,
  );

  return Number(id);
}

/* ============================================================
   PESAJES
============================================================ */

export async function upsertWeightRecord(
  record: WeightRecord,
) {
  const d = db();

  /* ===========================
     EDITAR
  =========================== */

  if (record.id != null) {
    const updated:
      WeightRecord = {
      ...record,
      updatedAt:
        nowISO(),
    };

    await d.weightRecords.update(
      record.id,
      updated,
    );

    await cloudUpsertWeightRecord(
      updated,
    );

    return record.id;
  }

  /* ===========================
     CREAR
  =========================== */

  const created:
    WeightRecord = {
    ...record,
    createdAt:
      nowISO(),
    updatedAt:
      nowISO(),
  };

  const id =
    await d.weightRecords.add(
      created,
    );

  const finalRecord:
    WeightRecord = {
    ...created,
    id:
      Number(id),
  };

  await cloudUpsertWeightRecord(
    finalRecord,
  );

  return Number(id);
}

export async function deleteWeightRecord(
  id: number,
) {
  await db()
    .weightRecords
    .delete(id);

  await cloudDeleteWeightRecord(
    id,
  );
}

/* ============================================================
   JUGADORAS
============================================================ */

export async function upsertPlayer(
  p: PlayerProfile,
) {
  const d = db();

  /* ===========================
     EDITAR
  =========================== */

  if (p.id != null) {
    const updated:
      PlayerProfile = {
      ...p,
      updatedAt:
        nowISO(),
    };

    await d.players.update(
      p.id,
      updated,
    );

    await cloudUpsertPlayer(
      updated,
    );

    return p.id;
  }

  /* ===========================
     CREAR
  =========================== */

  const created:
    PlayerProfile = {
    ...p,
    createdAt:
      nowISO(),
    updatedAt:
      nowISO(),
  };

  const id =
    await d.players.add(
      created,
    );

  const finalRecord:
    PlayerProfile = {
    ...created,
    id:
      Number(id),
  };

  await cloudUpsertPlayer(
    finalRecord,
  );

  return Number(id);
}

export async function deletePlayer(
  id: number,
) {
  const d = db();

  /*
   * Conservamos el comportamiento
   * que ya tenía la app:
   *
   * al borrar una jugadora localmente
   * eliminamos sus controles y sus
   * antropometrías completas.
   */
  await d.transaction(
    "rw",
    d.players,
    d.controls,
    d.fullAnthropometries,
    async () => {
      await d.controls
        .where(
          "playerId",
        )
        .equals(id)
        .delete();

      await d.fullAnthropometries
        .where(
          "playerId",
        )
        .equals(id)
        .delete();

      await d.players.delete(
        id,
      );
    },
  );

  await cloudDeletePlayer(
    id,
  );
}

/* ============================================================
   OBJETIVOS
============================================================ */

export async function upsertObjectivePeriod(
  period: ObjectivePeriod,
) {
  const d = db();

  /* ===========================
     EDITAR
  =========================== */

  if (period.id != null) {
    const updated:
      ObjectivePeriod = {
      ...period,
      updatedAt:
        nowISO(),
    };

    await d.objectivePeriods.update(
      period.id,
      updated,
    );

    await cloudUpsertObjectivePeriod(
      updated,
    );

    return period.id;
  }

  /* ===========================
     CREAR
  =========================== */

  const created:
    ObjectivePeriod = {
    ...period,
    createdAt:
      nowISO(),
    updatedAt:
      nowISO(),
  };

  const id =
    await d.objectivePeriods.add(
      created,
    );

  const finalRecord:
    ObjectivePeriod = {
    ...created,
    id:
      Number(id),
  };

  await cloudUpsertObjectivePeriod(
    finalRecord,
  );

  return Number(id);
}

/* ============================================================
   TESTS DE HIDRATACIÓN
============================================================ */

export async function upsertHydrationTest(
  test: HydrationTest,
) {
  const d = db();

  /* ===========================
     EDITAR
  =========================== */

  if (test.id != null) {
    const updated:
      HydrationTest = {
      ...test,
      updatedAt:
        nowISO(),
    };

    await d.hydrationTests.update(
      test.id,
      updated,
    );

    await cloudUpsertHydrationTest(
      updated,
    );

    return test.id;
  }

  /* ===========================
     CREAR
  =========================== */

  const created:
    HydrationTest = {
    ...test,
    createdAt:
      nowISO(),
    updatedAt:
      nowISO(),
  };

  const id =
    await d.hydrationTests.add(
      created,
    );

  const finalRecord:
    HydrationTest = {
    ...created,
    id:
      Number(id),
  };

  await cloudUpsertHydrationTest(
    finalRecord,
  );

  return Number(id);
}

export async function deleteHydrationTest(
  id: number,
) {
  await db()
    .hydrationTests
    .delete(id);

  await cloudDeleteHydrationTest(
    id,
  );
}

/* ============================================================
   ANTROPOMETRÍAS COMPLETAS
   5 COMPONENTES / KERR / ANTROPOGIMS
============================================================ */

/*
 * Una antropometría completa también
 * crea o actualiza automáticamente
 * el control habitual correspondiente.
 *
 * IMPORTANTE:
 *
 * primero terminamos toda la transacción
 * de IndexedDB.
 *
 * Recién después sincronizamos con
 * Supabase.
 *
 * Nunca esperamos una llamada de red
 * dentro de una transacción de Dexie.
 */
export async function upsertFullAnthropometry(
  anthropometry: FullAnthropometry,
) {
  const d = db();

  const localResult =
    await d.transaction(
      "rw",
      d.fullAnthropometries,
      d.controls,
      async () => {
        const now =
          nowISO();

        /* ====================================================
           1. RECALCULAR RESULTADOS
        ==================================================== */

        const results =
          calculateFiveComponents(
            anthropometry,
          );

        const controlData =
          controlDataFromFullAnthropometry(
            anthropometry,
          );

        /* ====================================================
           2. BUSCAR CONTROL HABITUAL
        ==================================================== */

        let existingControl:
          | Control
          | undefined;

        /*
         * Primero intentamos usar el vínculo
         * previamente guardado.
         */
        if (
          anthropometry.linkedControlId !=
          null
        ) {
          const linked =
            await d.controls.get(
              anthropometry.linkedControlId,
            );

          if (
            linked &&
            linked.playerId ===
              anthropometry.playerId &&
            linked.date ===
              anthropometry.date
          ) {
            existingControl =
              linked;
          }
        }

        /*
         * Si no encontramos el vínculo,
         * buscamos por jugadora + fecha.
         */
        if (!existingControl) {
          existingControl =
            await d.controls
              .where(
                "[playerId+date]",
              )
              .equals([
                anthropometry.playerId,
                anthropometry.date,
              ])
              .first();
        }

        /* ====================================================
           3. CREAR O ACTUALIZAR CONTROL
        ==================================================== */

        let controlToSync:
          Control;

        if (
          existingControl?.id !=
          null
        ) {
          /*
           * Conservamos notas y fecha de
           * creación del control existente.
           */
          controlToSync = {
            ...existingControl,
            ...controlData,

            id:
              existingControl.id,

            updatedAt:
              now,
          };

          await d.controls.update(
            existingControl.id,
            controlToSync,
          );
        } else {
          const newControl:
            Control = {
            playerId:
              anthropometry.playerId,

            date:
              anthropometry.date,

            ...controlData,

            notes:
              null,

            createdAt:
              now,

            updatedAt:
              now,
          };

          const addedControlId =
            await d.controls.add(
              newControl,
            );

          controlToSync = {
            ...newControl,

            id:
              Number(
                addedControlId,
              ),
          };
        }

        const controlId =
          controlToSync.id!;

        /* ====================================================
           4. BUSCAR ANTROPOMETRÍA EXISTENTE
        ==================================================== */

        let existingAnthropometry:
          | FullAnthropometry
          | undefined;

        /*
         * Primero por ID.
         */
        if (
          anthropometry.id !=
          null
        ) {
          existingAnthropometry =
            await d.fullAnthropometries.get(
              anthropometry.id,
            );
        }

        /*
         * Si no aparece por ID,
         * buscamos jugadora + fecha.
         *
         * Esto evita duplicados al importar
         * dos veces el mismo archivo.
         */
        if (
          !existingAnthropometry
        ) {
          existingAnthropometry =
            await d.fullAnthropometries
              .where(
                "[playerId+date]",
              )
              .equals([
                anthropometry.playerId,
                anthropometry.date,
              ])
              .first();
        }

        /* ====================================================
           5. CONSTRUIR REGISTRO FINAL
        ==================================================== */

        const finalRecord:
          FullAnthropometry = {
          ...anthropometry,

          id:
            existingAnthropometry
              ?.id ??
            anthropometry.id,

          results,

          linkedControlId:
            controlId,

          createdAt:
            existingAnthropometry
              ?.createdAt ??
            anthropometry.createdAt ??
            now,

          updatedAt:
            now,
        };

        /* ====================================================
           6. GUARDAR ANTROPOMETRÍA LOCAL
        ==================================================== */

        let finalAnthropometry:
          FullAnthropometry;

        if (
          existingAnthropometry?.id !=
          null
        ) {
          const existingId =
            existingAnthropometry.id;

          await d.fullAnthropometries.update(
            existingId,
            {
              ...finalRecord,
              id:
                existingId,
            },
          );

          finalAnthropometry = {
            ...finalRecord,
            id:
              existingId,
          };
        } else {
          const newId =
            await d.fullAnthropometries.add(
              finalRecord,
            );

          finalAnthropometry = {
            ...finalRecord,

            id:
              Number(newId),
          };
        }

        return {
          id:
            finalAnthropometry.id!,

          control:
            controlToSync,

          anthropometry:
            finalAnthropometry,
        };
      },
    );

  /* ==========================================================
     7. SINCRONIZAR CON SUPABASE
  ========================================================== */

  /*
   * Primero subimos el control.
   *
   * Después la antropometría, porque
   * linkedControlId depende de ese control.
   */
  await cloudUpsertControl(
    localResult.control,
  );

  await cloudUpsertFullAnthropometry(
    localResult.anthropometry,
  );

  return localResult.id;
}

/* ============================================================
   ELIMINAR ANTROPOMETRÍA COMPLETA
============================================================ */

/*
 * Igual que antes:
 *
 * borrar una antropometría completa
 * NO borra automáticamente el control
 * habitual asociado.
 */
export async function deleteFullAnthropometry(
  id: number,
) {
  await db()
    .fullAnthropometries
    .delete(id);

  await cloudDeleteFullAnthropometry(
    id,
  );
}

/* ============================================================
   BUSCAR ANTROPOMETRÍA POR FECHA
============================================================ */

export async function findFullAnthropometryByDate(
  playerId: number,
  date: string,
) {
  return await db()
    .fullAnthropometries
    .where(
      "[playerId+date]",
    )
    .equals([
      playerId,
      date,
    ])
    .first();
}
