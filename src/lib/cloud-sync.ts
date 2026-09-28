import { db } from "./db";
import { supabase } from "./supabase";

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

import {
  clearUnsyncedLocalChanges,
  getPendingSyncOperations,
  hasUnsyncedLocalChanges,
  removePendingSyncOperation,
  replacePendingSyncOperations,
  type PendingSyncOperation,
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

export interface CloudSyncResult {
  players: number;
  controls: number;
  weightRecords: number;
  objectivePeriods: number;
  hydrationTests: number;
  fullAnthropometries: number;
}

export interface PendingSyncResult {
  synced: number;
  remaining: number;
}

let pendingSyncInFlight:
  Promise<PendingSyncResult> | null = null;

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase no está configurado.",
    );
  }

  return supabase;
}

async function requireSession() {
  const client = requireSupabase();

  const { data, error } =
    await client.auth.getSession();

  if (error) throw error;

  if (!data.session) {
    throw new Error(
      "No hay una sesión iniciada.",
    );
  }
}

function isOnline() {
  return (
    typeof navigator === "undefined" ||
    navigator.onLine
  );
}

async function remapPendingLocalId(
  entity: SyncEntity,
  oldId: number,
  newId: number,
) {
  const queue =
    getPendingSyncOperations();

  const next = queue.map(
    (operation) =>
      operation.entity === entity &&
      operation.localId === oldId
        ? {
            ...operation,
            localId: newId,
            isNew: false,
          }
        : operation,
  );

  replacePendingSyncOperations(next);
}

async function remapLocalEntityId(
  entity: SyncEntity,
  oldId: number,
  newId: number,
) {
  if (oldId === newId) return;

  const d = db();

  if (entity === "player") {
    await d.transaction(
      "rw",
      d.players,
      d.controls,
      d.weightRecords,
      d.objectivePeriods,
      d.hydrationTests,
      d.fullAnthropometries,
      async () => {
        const player =
          await d.players.get(oldId);

        if (player) {
          await d.players.delete(oldId);
          await d.players.put({
            ...player,
            id: newId,
          });
        }

        await d.controls
          .where("playerId")
          .equals(oldId)
          .modify({
            playerId: newId,
          });

        await d.weightRecords
          .where("playerId")
          .equals(oldId)
          .modify({
            playerId: newId,
          });

        await d.fullAnthropometries
          .where("playerId")
          .equals(oldId)
          .modify({
            playerId: newId,
          });

        const periods =
          await d.objectivePeriods.toArray();

        for (const period of periods) {
          const targets =
            period.targets.map(
              (target) =>
                target.playerId === oldId
                  ? {
                      ...target,
                      playerId: newId,
                    }
                  : target,
            );

          await d.objectivePeriods.update(
            period.id!,
            { targets },
          );
        }

        const tests =
          await d.hydrationTests.toArray();

        for (const test of tests) {
          const entries =
            test.entries.map(
              (entry) =>
                entry.playerId === oldId
                  ? {
                      ...entry,
                      playerId: newId,
                    }
                  : entry,
            );

          await d.hydrationTests.update(
            test.id!,
            { entries },
          );
        }
      },
    );
  } else if (entity === "control") {
    await d.transaction(
      "rw",
      d.controls,
      d.fullAnthropometries,
      async () => {
        const record =
          await d.controls.get(oldId);

        if (record) {
          await d.controls.delete(oldId);
          await d.controls.put({
            ...record,
            id: newId,
          });
        }

        await d.fullAnthropometries
          .where("linkedControlId")
          .equals(oldId)
          .modify({
            linkedControlId: newId,
          });
      },
    );
  } else if (entity === "weightRecord") {
    const record =
      await d.weightRecords.get(oldId);

    if (record) {
      await d.weightRecords.delete(oldId);
      await d.weightRecords.put({
        ...record,
        id: newId,
      });
    }
  } else if (entity === "objectivePeriod") {
    const record =
      await d.objectivePeriods.get(oldId);

    if (record) {
      await d.objectivePeriods.delete(oldId);
      await d.objectivePeriods.put({
        ...record,
        id: newId,
      });
    }
  } else if (entity === "hydrationTest") {
    const record =
      await d.hydrationTests.get(oldId);

    if (record) {
      await d.hydrationTests.delete(oldId);
      await d.hydrationTests.put({
        ...record,
        id: newId,
      });
    }
  } else if (entity === "fullAnthropometry") {
    const record =
      await d.fullAnthropometries.get(oldId);

    if (record) {
      await d.fullAnthropometries.delete(oldId);
      await d.fullAnthropometries.put({
        ...record,
        id: newId,
      });
    }
  }

  await remapPendingLocalId(
    entity,
    oldId,
    newId,
  );
}

async function syncUpsert(
  operation: PendingSyncOperation,
) {
  const d = db();

  if (operation.entity === "player") {
    const record =
      await d.players.get(
        operation.localId,
      );

    if (!record) return;

    const cloudId =
      await cloudUpsertPlayer({
        ...record,
        id: operation.isNew
          ? undefined
          : record.id,
      });

    await remapLocalEntityId(
      "player",
      operation.localId,
      cloudId,
    );

    return;
  }

  if (operation.entity === "control") {
    const record =
      await d.controls.get(
        operation.localId,
      );

    if (!record) return;

    const cloudId =
      await cloudUpsertControl({
        ...record,
        id: operation.isNew
          ? undefined
          : record.id,
      });

    await remapLocalEntityId(
      "control",
      operation.localId,
      cloudId,
    );

    return;
  }

  if (operation.entity === "weightRecord") {
    const record =
      await d.weightRecords.get(
        operation.localId,
      );

    if (!record) return;

    const cloudId =
      await cloudUpsertWeightRecord({
        ...record,
        id: operation.isNew
          ? undefined
          : record.id,
      });

    await remapLocalEntityId(
      "weightRecord",
      operation.localId,
      cloudId,
    );

    return;
  }

  if (operation.entity === "objectivePeriod") {
    const record =
      await d.objectivePeriods.get(
        operation.localId,
      );

    if (!record) return;

    const cloudId =
      await cloudUpsertObjectivePeriod({
        ...record,
        id: operation.isNew
          ? undefined
          : record.id,
      });

    await remapLocalEntityId(
      "objectivePeriod",
      operation.localId,
      cloudId,
    );

    return;
  }

  if (operation.entity === "hydrationTest") {
    const record =
      await d.hydrationTests.get(
        operation.localId,
      );

    if (!record) return;

    const cloudId =
      await cloudUpsertHydrationTest({
        ...record,
        id: operation.isNew
          ? undefined
          : record.id,
      });

    await remapLocalEntityId(
      "hydrationTest",
      operation.localId,
      cloudId,
    );

    return;
  }

  const record =
    await d.fullAnthropometries.get(
      operation.localId,
    );

  if (!record) return;

  const cloudId =
    await cloudUpsertFullAnthropometry({
      ...record,
      id: operation.isNew
        ? undefined
        : record.id,
    });

  await remapLocalEntityId(
    "fullAnthropometry",
    operation.localId,
    cloudId,
  );
}

async function syncDelete(
  operation: PendingSyncOperation,
) {
  if (operation.entity === "player") {
    await cloudDeletePlayer(
      operation.localId,
    );
  } else if (operation.entity === "control") {
    await cloudDeleteControl(
      operation.localId,
    );
  } else if (operation.entity === "weightRecord") {
    await cloudDeleteWeightRecord(
      operation.localId,
    );
  } else if (operation.entity === "hydrationTest") {
    await cloudDeleteHydrationTest(
      operation.localId,
    );
  } else if (operation.entity === "fullAnthropometry") {
    await cloudDeleteFullAnthropometry(
      operation.localId,
    );
  }
}

const PRIORITY: Record<SyncEntity, number> = {
  player: 1,
  control: 2,
  weightRecord: 3,
  objectivePeriod: 4,
  hydrationTest: 5,
  fullAnthropometry: 6,
};

async function runPendingSync():
  Promise<PendingSyncResult> {
  if (!isOnline()) {
    return {
      synced: 0,
      remaining:
        getPendingSyncOperations().length,
    };
  }

  await requireSession();

  const operations =
    [...getPendingSyncOperations()].sort(
      (a, b) => {
        if (a.action !== b.action) {
          return a.action === "upsert"
            ? -1
            : 1;
        }

        if (a.action === "delete") {
          return (
            PRIORITY[b.entity] -
            PRIORITY[a.entity]
          );
        }

        return (
          PRIORITY[a.entity] -
          PRIORITY[b.entity]
        );
      },
    );

  let synced = 0;

  for (const operation of operations) {
    try {
      if (operation.action === "upsert") {
        await syncUpsert(operation);
      } else {
        await syncDelete(operation);
      }

      removePendingSyncOperation(
        operation.id,
      );

      synced += 1;
    } catch (error) {
      console.warn(
        "No se pudo sincronizar un cambio pendiente:",
        operation,
        error,
      );
    }
  }

  const remaining =
    getPendingSyncOperations().length;

  if (remaining === 0) {
    clearUnsyncedLocalChanges();
  }

  return {
    synced,
    remaining,
  };
}

export function syncPendingLocalChanges() {
  if (!pendingSyncInFlight) {
    pendingSyncInFlight =
      runPendingSync().finally(() => {
        pendingSyncInFlight = null;
      });
  }

  return pendingSyncInFlight;
}

async function loadPlayers():
  Promise<PlayerProfile[]> {
  const client = requireSupabase();

  const { data, error } =
    await client
      .from("players")
      .select("*")
      .order("id", {
        ascending: true,
      });

  if (error) throw error;

  return (data ?? []).map(
    (row) => ({
      id: Number(row.id),
      name: row.name,
      position: row.position ?? null,
      birthDate:
        row.birth_date ?? null,
      active: Number(
        row.active ?? 1,
      ),
      phone: row.phone ?? null,
      email: row.email ?? null,
      generalNotes:
        row.general_notes ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

async function loadControls():
  Promise<Control[]> {
  const client = requireSupabase();

  const { data, error } =
    await client
      .from("controls")
      .select("*")
      .order("id", {
        ascending: true,
      });

  if (error) throw error;

  return (data ?? []).map(
    (row) => ({
      id: Number(row.id),
      playerId:
        Number(row.player_id),
      date: row.date,
      weight: row.weight,
      triceps: row.triceps,
      subscapular:
        row.subscapular,
      supraespinal:
        row.supraespinal,
      abdominal: row.abdominal,
      thighSkinfold:
        row.thigh_skinfold,
      calfSkinfold:
        row.calf_skinfold,
      armPerimeter:
        row.arm_perimeter,
      thighPerimeter:
        row.thigh_perimeter,
      calfPerimeter:
        row.calf_perimeter,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

async function loadWeightRecords():
  Promise<WeightRecord[]> {
  const client = requireSupabase();

  const { data, error } =
    await client
      .from("weight_records")
      .select("*")
      .order("id", {
        ascending: true,
      });

  if (error) throw error;

  return (data ?? []).map(
    (row) => ({
      id: Number(row.id),
      playerId:
        Number(row.player_id),
      date: row.date,
      weight: row.weight,
      condition: row.condition,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

async function loadObjectivePeriods():
  Promise<ObjectivePeriod[]> {
  const client = requireSupabase();

  const { data, error } =
    await client
      .from("objective_periods")
      .select("*")
      .order("id", {
        ascending: true,
      });

  if (error) throw error;

  return (data ?? []).map(
    (row) => ({
      id: Number(row.id),
      key: row.key,
      label: row.label,
      year: Number(row.year),
      month: Number(row.month),
      targets:
        Array.isArray(row.targets)
          ? row.targets
          : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

async function loadHydrationTests():
  Promise<HydrationTest[]> {
  const client = requireSupabase();

  const { data, error } =
    await client
      .from("hydration_tests")
      .select("*")
      .order("id", {
        ascending: true,
      });

  if (error) throw error;

  return (data ?? []).map(
    (row) => ({
      id: Number(row.id),
      date: row.date,
      round:
        row.round == null
          ? null
          : Number(row.round),
      rival: row.rival ?? null,
      dayType: row.day_type,
      context: row.context,
      customContext:
        row.custom_context ?? null,
      entries:
        Array.isArray(row.entries)
          ? row.entries
          : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

async function loadFullAnthropometries():
  Promise<FullAnthropometry[]> {
  const client = requireSupabase();

  const { data, error } =
    await client
      .from("full_anthropometries")
      .select("*")
      .order("id", {
        ascending: true,
      });

  if (error) throw error;

  return (data ?? []).map(
    (row) => ({
      id: Number(row.id),
      playerId:
        Number(row.player_id),
      date: row.date,
      measurementNumber:
        row.measurement_number == null
          ? null
          : Number(
              row.measurement_number,
            ),
      sport: row.sport ?? null,
      physicalActivity:
        row.physical_activity ?? null,
      activityType:
        row.activity_type ?? null,
      sex: row.sex,
      birthDate:
        row.birth_date ?? null,
      ageYears:
        row.age_years == null
          ? null
          : Number(row.age_years),
      measures:
        row.measures ?? {},
      boneReferenceKg:
        row.bone_reference_kg ==
        null
          ? null
          : Number(
              row.bone_reference_kg,
            ),
      results:
        row.results ?? null,
      linkedControlId:
        row.linked_control_id ==
        null
          ? null
          : Number(
              row.linked_control_id,
            ),
      source: row.source,
      sourceFileName:
        row.source_file_name ??
        null,
      sourceSheetName:
        row.source_sheet_name ??
        null,
      sourcePlayerName:
        row.source_player_name ??
        null,
      notes: row.notes ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

export async function hasLocalData() {
  return (
    (await db().players.count()) >
    0
  );
}

export async function syncCloudToLocal(
  onProgress?: (
    message: string,
  ) => void,
): Promise<CloudSyncResult> {
  await requireSession();

  if (
    hasUnsyncedLocalChanges()
  ) {
    onProgress?.(
      "Subiendo cambios pendientes...",
    );

    await syncPendingLocalChanges();
  }

  if (
    hasUnsyncedLocalChanges()
  ) {
    throw new Error(
      "Hay cambios guardados en este dispositivo que todavía no pudieron llegar a Supabase. Se conservó la copia local para no perderlos.",
    );
  }

  onProgress?.(
    "Descargando jugadoras...",
  );
  const players =
    await loadPlayers();

  onProgress?.(
    "Descargando controles...",
  );
  const controls =
    await loadControls();

  onProgress?.(
    "Descargando pesajes...",
  );
  const weightRecords =
    await loadWeightRecords();

  onProgress?.(
    "Descargando objetivos...",
  );
  const objectivePeriods =
    await loadObjectivePeriods();

  onProgress?.(
    "Descargando hidratación...",
  );
  const hydrationTests =
    await loadHydrationTests();

  onProgress?.(
    "Descargando antropometrías completas...",
  );
  const fullAnthropometries =
    await loadFullAnthropometries();

  const total =
    players.length +
    controls.length +
    weightRecords.length +
    objectivePeriods.length +
    hydrationTests.length +
    fullAnthropometries.length;

  if (
    total === 0 &&
    (await hasLocalData())
  ) {
    throw new Error(
      "Supabase no devolvió datos. Por seguridad no se reemplazó la base local.",
    );
  }

  onProgress?.(
    "Actualizando datos del dispositivo...",
  );

  const d = db();

  await d.transaction(
    "rw",
    d.players,
    d.controls,
    d.weightRecords,
    d.objectivePeriods,
    d.hydrationTests,
    d.fullAnthropometries,
    async () => {
      await d.fullAnthropometries.clear();
      await d.hydrationTests.clear();
      await d.controls.clear();
      await d.weightRecords.clear();
      await d.objectivePeriods.clear();
      await d.players.clear();

      if (players.length) {
        await d.players.bulkPut(
          players,
        );
      }

      if (controls.length) {
        await d.controls.bulkPut(
          controls,
        );
      }

      if (weightRecords.length) {
        await d.weightRecords.bulkPut(
          weightRecords,
        );
      }

      if (objectivePeriods.length) {
        await d.objectivePeriods.bulkPut(
          objectivePeriods,
        );
      }

      if (hydrationTests.length) {
        await d.hydrationTests.bulkPut(
          hydrationTests,
        );
      }

      if (fullAnthropometries.length) {
        await d.fullAnthropometries.bulkPut(
          fullAnthropometries,
        );
      }
    },
  );

  onProgress?.(
    "Datos actualizados.",
  );

  return {
    players: players.length,
    controls: controls.length,
    weightRecords:
      weightRecords.length,
    objectivePeriods:
      objectivePeriods.length,
    hydrationTests:
      hydrationTests.length,
    fullAnthropometries:
      fullAnthropometries.length,
  };
}

if (
  typeof window !== "undefined"
) {
  window.addEventListener(
    "online",
    () => {
      void syncPendingLocalChanges();
    },
  );
}
