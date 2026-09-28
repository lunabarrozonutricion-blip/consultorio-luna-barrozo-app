import Dexie, { type Table } from "dexie";

import {
  calculateFiveComponents,
  controlDataFromFullAnthropometry,
} from "./kerr";

import {
  queueDeleteOperation,
  queueUpsertOperation,
  type SyncEntity,
} from "./sync-state";

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
  players!: Table<
    PlayerProfile,
    number
  >;

  controls!: Table<
    Control,
    number
  >;

  weightRecords!: Table<
    WeightRecord,
    number
  >;

  objectivePeriods!: Table<
    ObjectivePeriod,
    number
  >;

  hydrationTests!: Table<
    HydrationTest,
    number
  >;

  fullAnthropometries!: Table<
    FullAnthropometry,
    number
  >;

  constructor() {
    super(
      "sanlorenzo-antropometria",
    );

    this.version(1).stores({
      players:
        "++id, name, active",
      controls:
        "++id, playerId, date, [playerId+date]",
    });

    this.version(2).stores({
      players:
        "++id, name, active",
      controls:
        "++id, playerId, date, [playerId+date]",
      weightRecords:
        "++id, playerId, date, condition, [playerId+date]",
    });

    this.version(3).stores({
      players:
        "++id, name, active",
      controls:
        "++id, playerId, date, [playerId+date]",
      weightRecords:
        "++id, playerId, date, condition, [playerId+date]",
      objectivePeriods:
        "++id, &key, year, month",
    });

    this.version(4).stores({
      players:
        "++id, name, active",
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
      players:
        "++id, name, active",
      controls:
        "++id, playerId, date, [playerId+date]",
      weightRecords:
        "++id, playerId, date, condition, [playerId+date]",
      objectivePeriods:
        "++id, &key, year, month",
      hydrationTests:
        "++id, date, round, dayType, context",
      fullAnthropometries:
        "++id, playerId, date, source, linkedControlId, [playerId+date]",
    });
  }
}

let _db:
  AnthroDB | null = null;

export function db():
  AnthroDB {
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

export async function ensureSeed() {
  /*
   * Los datos reales se cargan desde
   * Supabase o desde la copia local.
   * No agregamos datos de ejemplo.
   */
}

function schedulePendingSync() {
  if (
    typeof navigator !== "undefined" &&
    !navigator.onLine
  ) {
    return;
  }

  void import("./cloud-sync")
    .then(
      ({
        syncPendingLocalChanges,
      }) =>
        syncPendingLocalChanges(),
    )
    .catch(
      (error) => {
        console.warn(
          "El cambio quedó guardado localmente y se sincronizará más tarde.",
          error,
        );
      },
    );
}

function queueUpsert(
  entity: SyncEntity,
  localId: number,
  isNew: boolean,
) {
  queueUpsertOperation(
    entity,
    localId,
    isNew,
  );

  schedulePendingSync();
}

function queueDelete(
  entity: SyncEntity,
  localId: number,
) {
  queueDeleteOperation(
    entity,
    localId,
  );

  schedulePendingSync();
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

  if (c.id != null) {
    const updated:
      Control = {
      ...c,
      updatedAt:
        timestamp,
    };

    await d.controls.put(
      updated,
    );

    queueUpsert(
      "control",
      c.id,
      false,
    );

    return c.id;
  }

  const created:
    Control = {
    ...c,
    id: undefined,
    createdAt:
      c.createdAt ||
      timestamp,
    updatedAt:
      timestamp,
  };

  const id =
    Number(
      await d.controls.add(
        created,
      ),
    );

  queueUpsert(
    "control",
    id,
    true,
  );

  return id;
}

export async function deleteControl(
  id: number,
) {
  await db()
    .controls
    .delete(id);

  queueDelete(
    "control",
    id,
  );
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

  if (
    record.id != null
  ) {
    const updated:
      WeightRecord = {
      ...record,
      updatedAt:
        timestamp,
    };

    await d.weightRecords.put(
      updated,
    );

    queueUpsert(
      "weightRecord",
      record.id,
      false,
    );

    return record.id;
  }

  const created:
    WeightRecord = {
    ...record,
    id: undefined,
    createdAt:
      record.createdAt ||
      timestamp,
    updatedAt:
      timestamp,
  };

  const id =
    Number(
      await d.weightRecords.add(
        created,
      ),
    );

  queueUpsert(
    "weightRecord",
    id,
    true,
  );

  return id;
}

export async function deleteWeightRecord(
  id: number,
) {
  await db()
    .weightRecords
    .delete(id);

  queueDelete(
    "weightRecord",
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
  const timestamp =
    nowISO();

  if (p.id != null) {
    const updated:
      PlayerProfile = {
      ...p,
      updatedAt:
        timestamp,
    };

    await d.players.put(
      updated,
    );

    queueUpsert(
      "player",
      p.id,
      false,
    );

    return p.id;
  }

  const created:
    PlayerProfile = {
    ...p,
    id: undefined,
    createdAt:
      p.createdAt ||
      timestamp,
    updatedAt:
      timestamp,
  };

  const id =
    Number(
      await d.players.add(
        created,
      ),
    );

  queueUpsert(
    "player",
    id,
    true,
  );

  return id;
}

export async function deletePlayer(
  id: number,
) {
  const d = db();

  await d.transaction(
    "rw",
    d.players,
    d.controls,
    d.weightRecords,
    d.fullAnthropometries,
    async () => {
      await d.controls
        .where("playerId")
        .equals(id)
        .delete();

      await d.weightRecords
        .where("playerId")
        .equals(id)
        .delete();

      await d.fullAnthropometries
        .where("playerId")
        .equals(id)
        .delete();

      await d.players.delete(
        id,
      );
    },
  );

  queueDelete(
    "player",
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
  const timestamp =
    nowISO();

  if (
    period.id != null
  ) {
    const updated:
      ObjectivePeriod = {
      ...period,
      updatedAt:
        timestamp,
    };

    await d.objectivePeriods.put(
      updated,
    );

    queueUpsert(
      "objectivePeriod",
      period.id,
      false,
    );

    return period.id;
  }

  const created:
    ObjectivePeriod = {
    ...period,
    id: undefined,
    createdAt:
      period.createdAt ||
      timestamp,
    updatedAt:
      timestamp,
  };

  const id =
    Number(
      await d.objectivePeriods.add(
        created,
      ),
    );

  queueUpsert(
    "objectivePeriod",
    id,
    true,
  );

  return id;
}

/* ============================================================
   HIDRATACIÓN
============================================================ */

export async function upsertHydrationTest(
  test: HydrationTest,
) {
  const d = db();
  const timestamp =
    nowISO();

  if (
    test.id != null
  ) {
    const updated:
      HydrationTest = {
      ...test,
      updatedAt:
        timestamp,
    };

    await d.hydrationTests.put(
      updated,
    );

    queueUpsert(
      "hydrationTest",
      test.id,
      false,
    );

    return test.id;
  }

  const created:
    HydrationTest = {
    ...test,
    id: undefined,
    createdAt:
      test.createdAt ||
      timestamp,
    updatedAt:
      timestamp,
  };

  const id =
    Number(
      await d.hydrationTests.add(
        created,
      ),
    );

  queueUpsert(
    "hydrationTest",
    id,
    true,
  );

  return id;
}

export async function deleteHydrationTest(
  id: number,
) {
  await db()
    .hydrationTests
    .delete(id);

  queueDelete(
    "hydrationTest",
    id,
  );
}

/* ============================================================
   ANTROPOMETRÍA COMPLETA
============================================================ */

export async function upsertFullAnthropometry(
  anthropometry:
    FullAnthropometry,
) {
  const d = db();

  const result =
    await d.transaction(
      "rw",
      d.fullAnthropometries,
      d.controls,
      async () => {
        const timestamp =
          nowISO();

        const results =
          calculateFiveComponents(
            anthropometry,
          );

        const controlData =
          controlDataFromFullAnthropometry(
            anthropometry,
          );

        let existingControl:
          | Control
          | undefined;

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

        let controlId: number;
        let controlIsNew =
          false;

        if (
          existingControl?.id !=
          null
        ) {
          const updatedControl:
            Control = {
            ...existingControl,
            ...controlData,
            updatedAt:
              timestamp,
          };

          await d.controls.put(
            updatedControl,
          );

          controlId =
            existingControl.id;
        } else {
          const newControl:
            Control = {
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

          controlId =
            Number(
              await d.controls.add(
                newControl,
              ),
            );

          controlIsNew =
            true;
        }

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

        const finalRecord:
          FullAnthropometry = {
          ...anthropometry,
          id:
            existingAnthropometry
              ?.id ??
            undefined,
          results,
          linkedControlId:
            controlId,
          createdAt:
            existingAnthropometry
              ?.createdAt ??
            anthropometry.createdAt ??
            timestamp,
          updatedAt:
            timestamp,
        };

        let anthropometryId:
          number;

        let anthropometryIsNew =
          false;

        if (
          existingAnthropometry?.id !=
          null
        ) {
          anthropometryId =
            existingAnthropometry.id;

          await d.fullAnthropometries.put(
            {
              ...finalRecord,
              id:
                anthropometryId,
            },
          );
        } else {
          anthropometryId =
            Number(
              await d.fullAnthropometries.add(
                finalRecord,
              ),
            );

          anthropometryIsNew =
            true;
        }

        return {
          controlId,
          controlIsNew,
          anthropometryId,
          anthropometryIsNew,
        };
      },
    );

  queueUpsertOperation(
    "control",
    result.controlId,
    result.controlIsNew,
  );

  queueUpsertOperation(
    "fullAnthropometry",
    result.anthropometryId,
    result.anthropometryIsNew,
  );

  schedulePendingSync();

  return result.anthropometryId;
}

export async function deleteFullAnthropometry(
  id: number,
) {
  await db()
    .fullAnthropometries
    .delete(id);

  queueDelete(
    "fullAnthropometry",
    id,
  );
}

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
