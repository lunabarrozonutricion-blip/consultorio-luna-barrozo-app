import Dexie, { type Table } from "dexie";

import {
  calculateFiveComponents,
  controlDataFromFullAnthropometry,
} from "./kerr";

import {
  cloudDeleteControl,
  cloudUpsertControl,
} from "./cloud-write";

import type {
  Control,
  FullAnthropometry,
  HydrationTest,
  ObjectivePeriod,
  Player,
  WeightRecord,
} from "./types";

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

    /*
     * Versión 5:
     * antropometrías completas / Kerr / Antropogims.
     */
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

/**
 * Dexie solo existe en el navegador.
 */
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
   * Si ya hay jugadoras reales,
   * jamás agregamos datos de ejemplo.
   */
  if (count > 0) return;

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
  await db().controls.delete(id);

  await cloudDeleteControl(id);
}

export async function upsertControl(
  c: Control,
) {
  const d = db();

  /*
   * EDITAR CONTROL EXISTENTE
   */
  if (c.id) {
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

    /*
     * Una vez guardado localmente,
     * enviamos exactamente el mismo
     * registro a Supabase.
     */
    await cloudUpsertControl(
      updated,
    );

    return c.id;
  }

  /*
   * CREAR CONTROL NUEVO
   */
  const created:
    Control = {
    ...c,
    createdAt:
      nowISO(),
    updatedAt:
      nowISO(),
  };

  /*
   * Primero IndexedDB genera el ID.
   */
  const id =
    await d.controls.add(
      created,
    );

  /*
   * Después armamos el registro final
   * incluyendo ese ID para que Supabase
   * use exactamente el mismo identificador.
   */
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

  if (record.id) {
    await d.weightRecords.update(
      record.id,
      {
        ...record,
        updatedAt: nowISO(),
      },
    );

    return record.id;
  }

  return await d.weightRecords.add({
    ...record,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });
}

export async function deleteWeightRecord(
  id: number,
) {
  await db()
    .weightRecords
    .delete(id);
}

/* ============================================================
   JUGADORAS
============================================================ */

export async function upsertPlayer(
  p: Player,
) {
  const d = db();

  if (p.id) {
    await d.players.update(
      p.id,
      {
        ...p,
        updatedAt: nowISO(),
      },
    );

    return p.id;
  }

  return await d.players.add({
    ...p,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });
}

export async function deletePlayer(
  id: number,
) {
  const d = db();

  await d.transaction(
    "rw",
    d.players,
    d.controls,
    d.fullAnthropometries,
    async () => {
      await d.controls
        .where("playerId")
        .equals(id)
        .delete();

      await d.fullAnthropometries
        .where("playerId")
        .equals(id)
        .delete();

      await d.players.delete(id);
    },
  );
}

/* ============================================================
   OBJETIVOS
============================================================ */

export async function upsertObjectivePeriod(
  period: ObjectivePeriod,
) {
  const d = db();

  if (period.id) {
    await d.objectivePeriods.update(
      period.id,
      {
        ...period,
        updatedAt: nowISO(),
      },
    );

    return period.id;
  }

  return await d.objectivePeriods.add({
    ...period,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });
}

/* ============================================================
   TESTS DE HIDRATACIÓN
============================================================ */

export async function upsertHydrationTest(
  test: HydrationTest,
) {
  const d = db();

  if (test.id) {
    await d.hydrationTests.update(
      test.id,
      {
        ...test,
        updatedAt: nowISO(),
      },
    );

    return test.id;
  }

  return await d.hydrationTests.add({
    ...test,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });
}

export async function deleteHydrationTest(
  id: number,
) {
  await db()
    .hydrationTests
    .delete(id);
}

/* ============================================================
   ANTROPOMETRÍAS COMPLETAS
   5 COMPONENTES / KERR / ANTROPOGIMS
============================================================ */

/*
 * Esta función es el corazón de la conexión
 * entre:
 *
 * ANTROPOMETRÍA COMPLETA
 *
 * y
 *
 * SEGUIMIENTO HABITUAL.
 *
 * Al guardar una evaluación:
 *
 * 1. calcula Kerr;
 * 2. busca si ya existe un control habitual
 *    para esa jugadora y esa fecha;
 * 3. lo actualiza o lo crea;
 * 4. guarda la antropometría completa;
 * 5. vincula ambos registros.
 *
 * Todo ocurre dentro de una única transacción.
 */
export async function upsertFullAnthropometry(
  anthropometry: FullAnthropometry,
) {
  const d = db();

  return await d.transaction(
    "rw",
    d.fullAnthropometries,
    d.controls,
    async () => {
      const now =
        nowISO();

      /*
       * Calculamos SIEMPRE nuevamente.
       *
       * No confiamos en resultados viejos
       * que puedan venir de un archivo.
       */
      const results =
        calculateFiveComponents(
          anthropometry,
        );

      /*
       * Extraemos únicamente los campos
       * que comparte con el seguimiento
       * habitual.
       */
      const controlData =
        controlDataFromFullAnthropometry(
          anthropometry,
        );

      /* ======================================================
         1. BUSCAR CONTROL HABITUAL
      ====================================================== */

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

        /*
         * Verificamos además que realmente
         * corresponda a la misma jugadora
         * y fecha.
         */
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
       * Si no había vínculo, buscamos
       * jugadora + fecha.
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

      /* ======================================================
         2. CREAR O ACTUALIZAR CONTROL
      ====================================================== */

      let controlId: number;

      if (
        existingControl?.id !=
        null
      ) {
        /*
         * MUY IMPORTANTE:
         *
         * conservamos las notas que ya
         * pudiera tener el control.
         *
         * Actualizamos solamente las
         * mediciones compartidas.
         */
        await d.controls.update(
          existingControl.id,
          {
            ...controlData,
            updatedAt: now,
          },
        );

        controlId =
          existingControl.id;
      } else {
        /*
         * No existe un control habitual
         * ese día: lo creamos.
         */
        const newControl:
          Control = {
          playerId:
            anthropometry.playerId,

          date:
            anthropometry.date,

          ...controlData,

          notes: null,

          createdAt: now,
          updatedAt: now,
        };

        const addedId =
          await d.controls.add(
            newControl,
          );

        controlId =
          Number(addedId);
      }

      /* ======================================================
         3. EVITAR DUPLICAR ANTROPOMETRÍAS
      ====================================================== */

      let existingAnthropometry:
        | FullAnthropometry
        | undefined;

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
       * Si por ejemplo importamos dos veces
       * el mismo Excel sin ID, usamos:
       *
       * jugadora + fecha
       *
       * para encontrar el registro anterior.
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

      /* ======================================================
         4. CONSTRUIR REGISTRO FINAL
      ====================================================== */

      const finalRecord:
        FullAnthropometry = {
        ...anthropometry,

        id:
          existingAnthropometry?.id ??
          anthropometry.id,

        /*
         * Siempre usamos nuestros cálculos.
         */
        results,

        /*
         * Vinculación con seguimiento.
         */
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

      /* ======================================================
         5. GUARDAR ANTROPOMETRÍA
      ====================================================== */

      if (
        existingAnthropometry?.id !=
        null
      ) {
        await d.fullAnthropometries.update(
          existingAnthropometry.id,
          finalRecord,
        );

        return (
          existingAnthropometry.id
        );
      }

      const newId =
        await d.fullAnthropometries.add(
          finalRecord,
        );

      return Number(newId);
    },
  );
}

/*
 * Eliminar una antropometría completa NO elimina
 * automáticamente el control habitual.
 *
 * Esto es intencional:
 *
 * si borramos por error un informe completo,
 * no queremos borrar también el historial de
 * peso, pliegues y perímetros.
 */
export async function deleteFullAnthropometry(
  id: number,
) {
  await db()
    .fullAnthropometries
    .delete(id);
}

/*
 * Busca la evaluación completa de una
 * jugadora en una fecha.
 */
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
