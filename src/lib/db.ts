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
  if (
    typeof window ===
    "undefined"
  ) {
    throw new Error(
      "La base local sólo está disponible en el navegador",
    );
  }

  if (!_db) {
    _db =
      new AnthroDB();
  }

  return _db;
}

export function nowISO() {
  return new Date().toISOString();
}

/* ============================================================
   CONTROL VACÍO
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

    createdAt:
      nowISO(),

    updatedAt:
      nowISO(),

    ...v,
  };
}

/* ============================================================
   DATOS DE EJEMPLO
============================================================ */

let seeded = false;

export async function ensureSeed() {
  if (seeded) {
    return;
  }

  seeded = true;

  const d = db();

  const count =
    await d.players.count();

  /*
   * Si ya tenemos datos reales
   * no agregamos ejemplos.
   */
  if (count > 0) {
    return;
  }

  const players:
    Player[] = [
    {
      name:
        "Camila Rodríguez",

      position:
        "Delantera",

      birthDate:
        "2001-04-12",

      active: 1,

      createdAt:
        nowISO(),

      updatedAt:
        nowISO(),
    },

    {
      name:
        "Martina Gómez",

      position:
        "Mediocampista",

      birthDate:
        "1999-09-03",

      active: 1,

      createdAt:
        nowISO(),

      updatedAt:
        nowISO(),
    },

    {
      name:
        "Lucía Fernández",

      position:
        "Defensora",

      birthDate:
        "2003-01-25",

      active: 1,

      createdAt:
        nowISO(),

      updatedAt:
        nowISO(),
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
        calfSkinfold: 11,
        armPerimeter: 27.1,
        thighPerimeter: 53,
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
        armPerimeter: 28,
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
        thighSkinfold: 23,
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
        supraespinal: 7,
        abdominal: 12,
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
      ([
        i,
        date,
        values,
      ]) =>
        emptyControl(
          ids[i] as number,
          date,
          values,
        ),
    ),
  );
}

/* ============================================================
   CONTROLES
============================================================ */

export async function upsertControl(
  c: Control,
) {
  const d = db();

  const timestamp =
    nowISO();

  /*
   * CONTROL EXISTENTE
   */
  if (c.id != null) {
    const updated:
      Control = {
      ...c,

      updatedAt:
        timestamp,
    };

    /*
     * Primero confirmamos nube.
     */
    const cloudId =
      await cloudUpsertControl(
        updated,
      );

    /*
     * Después actualizamos local.
     */
    const finalRecord:
      Control = {
      ...updated,

      id:
        cloudId,
    };

    await d.controls.put(
      finalRecord,
    );

    return cloudId;
  }

  /*
   * CONTROL NUEVO
   *
   * No generamos primero un ID
   * local.
   *
   * Supabase genera el identificador.
   */
  const created:
    Control = {
    ...c,

    id:
      undefined,

    createdAt:
      c.createdAt ||
      timestamp,

    updatedAt:
      timestamp,
  };

  const cloudId =
    await cloudUpsertControl(
      created,
    );

  const finalRecord:
    Control = {
    ...created,

    id:
      cloudId,
  };

  await d.controls.put(
    finalRecord,
  );

  return cloudId;
}

export async function deleteControl(
  id: number,
) {
  /*
   * Primero borramos en nube.
   */
  await cloudDeleteControl(
    id,
  );

  /*
   * Sólo si funcionó,
   * borramos la copia local.
   */
  await db()
    .controls
    .delete(id);
}

/* ============================================================
   PESAJES
============================================================ */

export async function upsertWeightRecord(
  record: WeightRecord,
) {
  const d = db();

  const timestamp =
    nowISO();

  /*
   * PESAJE EXISTENTE
   */
  if (
    record.id !=
    null
  ) {
    const updated:
      WeightRecord = {
      ...record,

      updatedAt:
        timestamp,
    };

    const cloudId =
      await cloudUpsertWeightRecord(
        updated,
      );

    const finalRecord:
      WeightRecord = {
      ...updated,

      id:
        cloudId,
    };

    await d.weightRecords.put(
      finalRecord,
    );

    return cloudId;
  }

  /*
   * PESAJE NUEVO
   */
  const created:
    WeightRecord = {
    ...record,

    id:
      undefined,

    createdAt:
      record.createdAt ||
      timestamp,

    updatedAt:
      timestamp,
  };

  /*
   * Supabase genera el ID.
   */
  const cloudId =
    await cloudUpsertWeightRecord(
      created,
    );

  /*
   * IndexedDB guarda exactamente
   * ese mismo ID.
   */
  const finalRecord:
    WeightRecord = {
    ...created,

    id:
      cloudId,
  };

  await d.weightRecords.put(
    finalRecord,
  );

  return cloudId;
}

export async function deleteWeightRecord(
  id: number,
) {
  await cloudDeleteWeightRecord(
    id,
  );

  await db()
    .weightRecords
    .delete(id);
}

/* ============================================================
   JUGADORAS
============================================================ */

export async function upsertPlayer(
  p: PlayerProfile,
) {
  const d = db();

  const timestamp =
    nowISO();

  /*
   * JUGADORA EXISTENTE
   */
  if (p.id != null) {
    const updated:
      PlayerProfile = {
      ...p,

      updatedAt:
        timestamp,
    };

    const cloudId =
      await cloudUpsertPlayer(
        updated,
      );

    const finalRecord:
      PlayerProfile = {
      ...updated,

      id:
        cloudId,
    };

    await d.players.put(
      finalRecord,
    );

    return cloudId;
  }

  /*
   * JUGADORA NUEVA
   */
  const created:
    PlayerProfile = {
    ...p,

    id:
      undefined,

    createdAt:
      p.createdAt ||
      timestamp,

    updatedAt:
      timestamp,
  };

  const cloudId =
    await cloudUpsertPlayer(
      created,
    );

  const finalRecord:
    PlayerProfile = {
    ...created,

    id:
      cloudId,
  };

  await d.players.put(
    finalRecord,
  );

  return cloudId;
}

export async function deletePlayer(
  id: number,
) {
  const d = db();

  /*
   * Primero Supabase.
   *
   * Si la nube rechaza la operación,
   * no tocamos los datos locales.
   */
  await cloudDeletePlayer(
    id,
  );

  /*
   * Después limpiamos la copia local.
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
}

/* ============================================================
   OBJETIVOS
============================================================ */

export async function upsertObjectivePeriod(
  period: ObjectivePeriod,
) {
  const d = db();

  const timestamp =
    nowISO();

  /*
   * PERÍODO EXISTENTE
   */
  if (
    period.id !=
    null
  ) {
    const updated:
      ObjectivePeriod = {
      ...period,

      updatedAt:
        timestamp,
    };

    const cloudId =
      await cloudUpsertObjectivePeriod(
        updated,
      );

    const finalRecord:
      ObjectivePeriod = {
      ...updated,

      id:
        cloudId,
    };

    await d.objectivePeriods.put(
      finalRecord,
    );

    return cloudId;
  }

  /*
   * PERÍODO NUEVO
   */
  const created:
    ObjectivePeriod = {
    ...period,

    id:
      undefined,

    createdAt:
      period.createdAt ||
      timestamp,

    updatedAt:
      timestamp,
  };

  const cloudId =
    await cloudUpsertObjectivePeriod(
      created,
    );

  const finalRecord:
    ObjectivePeriod = {
    ...created,

    id:
      cloudId,
  };

  await d.objectivePeriods.put(
    finalRecord,
  );

  return cloudId;
}

/* ============================================================
   TESTS DE HIDRATACIÓN
============================================================ */

export async function upsertHydrationTest(
  test: HydrationTest,
) {
  const d = db();

  const timestamp =
    nowISO();

  /*
   * TEST EXISTENTE
   */
  if (
    test.id !=
    null
  ) {
    const updated:
      HydrationTest = {
      ...test,

      updatedAt:
        timestamp,
    };

    const cloudId =
      await cloudUpsertHydrationTest(
        updated,
      );

    const finalRecord:
      HydrationTest = {
      ...updated,

      id:
        cloudId,
    };

    await d.hydrationTests.put(
      finalRecord,
    );

    return cloudId;
  }

  /*
   * TEST NUEVO
   */
  const created:
    HydrationTest = {
    ...test,

    id:
      undefined,

    createdAt:
      test.createdAt ||
      timestamp,

    updatedAt:
      timestamp,
  };

  const cloudId =
    await cloudUpsertHydrationTest(
      created,
    );

  const finalRecord:
    HydrationTest = {
    ...created,

    id:
      cloudId,
  };

  await d.hydrationTests.put(
    finalRecord,
  );

  return cloudId;
}

export async function deleteHydrationTest(
  id: number,
) {
  await cloudDeleteHydrationTest(
    id,
  );

  await db()
    .hydrationTests
    .delete(id);
}

/* ============================================================
   ANTROPOMETRÍAS COMPLETAS
   5 COMPONENTES / KERR
============================================================ */

export async function upsertFullAnthropometry(
  anthropometry:
    FullAnthropometry,
) {
  const d = db();

  const timestamp =
    nowISO();

  /*
   * Primero calculamos nuevamente
   * los resultados.
   */
  const results =
    calculateFiveComponents(
      anthropometry,
    );

  const controlData =
    controlDataFromFullAnthropometry(
      anthropometry,
    );

  /* ==========================================================
     1. BUSCAR CONTROL RELACIONADO
  ========================================================== */

  let existingControl:
    | Control
    | undefined;

  /*
   * Primero intentamos el vínculo
   * guardado.
   */
  if (
    anthropometry
      .linkedControlId !=
    null
  ) {
    const linked =
      await d.controls.get(
        anthropometry
          .linkedControlId,
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
   * Si no existe vínculo,
   * buscamos jugadora + fecha.
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

  /* ==========================================================
     2. PREPARAR CONTROL
  ========================================================== */

  let controlForCloud:
    Control;

  if (
    existingControl?.id !=
    null
  ) {
    /*
     * Conservamos notas y fecha
     * de creación existentes.
     */
    controlForCloud = {
      ...existingControl,

      ...controlData,

      id:
        existingControl.id,

      updatedAt:
        timestamp,
    };
  } else {
    controlForCloud = {
      playerId:
        anthropometry.playerId,

      date:
        anthropometry.date,

      ...controlData,

      notes: null,

      createdAt:
        timestamp,

      updatedAt:
        timestamp,
    };
  }

  /* ==========================================================
     3. SUPABASE GUARDA CONTROL
  ========================================================== */

  const cloudControlId =
    await cloudUpsertControl(
      controlForCloud,
    );

  const finalControl:
    Control = {
    ...controlForCloud,

    id:
      cloudControlId,
  };

  /* ==========================================================
     4. BUSCAR ANTROPOMETRÍA EXISTENTE
  ========================================================== */

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

  /* ==========================================================
     5. CONSTRUIR ANTROPOMETRÍA
  ========================================================== */

  const anthropometryForCloud:
    FullAnthropometry = {
    ...anthropometry,

    id:
      existingAnthropometry
        ?.id ??
      anthropometry.id,

    results,

    linkedControlId:
      cloudControlId,

    createdAt:
      existingAnthropometry
        ?.createdAt ??
      anthropometry.createdAt ??
      timestamp,

    updatedAt:
      timestamp,
  };

  /* ==========================================================
     6. SUPABASE GUARDA ANTROPOMETRÍA
  ========================================================== */

  const cloudAnthropometryId =
    await cloudUpsertFullAnthropometry(
      anthropometryForCloud,
    );

  const finalAnthropometry:
    FullAnthropometry = {
    ...anthropometryForCloud,

    id:
      cloudAnthropometryId,

    linkedControlId:
      cloudControlId,
  };

  /* ==========================================================
     7. ACTUALIZAR INDEXEDDB
  ========================================================== */

  /*
   * Recién después de que la nube
   * confirmó ambos registros,
   * actualizamos la copia local.
   */
  await d.transaction(
    "rw",

    d.controls,
    d.fullAnthropometries,

    async () => {
      /*
       * Si por algún motivo había
       * un ID local antiguo distinto,
       * lo eliminamos.
       */
      if (
        existingControl?.id !=
          null &&
        existingControl.id !==
          cloudControlId
      ) {
        await d.controls.delete(
          existingControl.id,
        );
      }

      await d.controls.put(
        finalControl,
      );

      if (
        existingAnthropometry?.id !=
          null &&
        existingAnthropometry.id !==
          cloudAnthropometryId
      ) {
        await d.fullAnthropometries.delete(
          existingAnthropometry.id,
        );
      }

      await d.fullAnthropometries.put(
        finalAnthropometry,
      );
    },
  );

  return cloudAnthropometryId;
}

/* ============================================================
   ELIMINAR ANTROPOMETRÍA COMPLETA
============================================================ */

/*
 * Borrar una antropometría completa
 * no borra automáticamente el control
 * habitual asociado.
 */
export async function deleteFullAnthropometry(
  id: number,
) {
  /*
   * Nube primero.
   */
  await cloudDeleteFullAnthropometry(
    id,
  );

  /*
   * Después copia local.
   */
  await db()
    .fullAnthropometries
    .delete(id);
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
