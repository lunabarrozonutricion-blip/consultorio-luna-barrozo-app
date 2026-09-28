import { db } from "./db";
import { supabase } from "./supabase";

import {
  hasUnsyncedLocalChanges,
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

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase no está configurado.",
    );
  }

  return supabase;
}

async function requireSession() {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client.auth.getSession();

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error(
      "No hay una sesión iniciada.",
    );
  }
}

/* ============================================================
   JUGADORAS
============================================================ */

async function loadPlayers(): Promise<
  PlayerProfile[]
> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from("players")
      .select("*")
      .order("id", {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row) => ({
      id:
        Number(row.id),

      name:
        row.name,

      position:
        row.position ??
        null,

      birthDate:
        row.birth_date ??
        null,

      active:
        Number(
          row.active ?? 1,
        ),

      phone:
        row.phone ??
        null,

      email:
        row.email ??
        null,

      generalNotes:
        row.general_notes ??
        null,

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,
    }),
  );
}

/* ============================================================
   CONTROLES
============================================================ */

async function loadControls(): Promise<
  Control[]
> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from("controls")
      .select("*")
      .order("id", {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row) => ({
      id:
        Number(row.id),

      playerId:
        Number(
          row.player_id,
        ),

      date:
        row.date,

      weight:
        row.weight,

      triceps:
        row.triceps,

      subscapular:
        row.subscapular,

      supraespinal:
        row.supraespinal,

      abdominal:
        row.abdominal,

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

      notes:
        row.notes,

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,
    }),
  );
}

/* ============================================================
   PESAJES
============================================================ */

async function loadWeightRecords(): Promise<
  WeightRecord[]
> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        "weight_records",
      )
      .select("*")
      .order("id", {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row) => ({
      id:
        Number(row.id),

      playerId:
        Number(
          row.player_id,
        ),

      date:
        row.date,

      weight:
        row.weight,

      condition:
        row.condition,

      notes:
        row.notes,

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,
    }),
  );
}

/* ============================================================
   OBJETIVOS
============================================================ */

async function loadObjectivePeriods(): Promise<
  ObjectivePeriod[]
> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        "objective_periods",
      )
      .select("*")
      .order("id", {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row) => ({
      id:
        Number(row.id),

      key:
        row.key,

      label:
        row.label,

      year:
        Number(row.year),

      month:
        Number(row.month),

      targets:
        Array.isArray(
          row.targets,
        )
          ? row.targets
          : [],

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,
    }),
  );
}

/* ============================================================
   HIDRATACIÓN
============================================================ */

async function loadHydrationTests(): Promise<
  HydrationTest[]
> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        "hydration_tests",
      )
      .select("*")
      .order("id", {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row) => ({
      id:
        Number(row.id),

      date:
        row.date,

      round:
        row.round == null
          ? null
          : Number(
              row.round,
            ),

      rival:
        row.rival ??
        null,

      dayType:
        row.day_type,

      context:
        row.context,

      customContext:
        row.custom_context ??
        null,

      entries:
        Array.isArray(
          row.entries,
        )
          ? row.entries
          : [],

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,
    }),
  );
}

/* ============================================================
   ANTROPOMETRÍAS COMPLETAS
============================================================ */

async function loadFullAnthropometries(): Promise<
  FullAnthropometry[]
> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        "full_anthropometries",
      )
      .select("*")
      .order("id", {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row) => ({
      id:
        Number(row.id),

      playerId:
        Number(
          row.player_id,
        ),

      date:
        row.date,

      measurementNumber:
        row.measurement_number ==
        null
          ? null
          : Number(
              row.measurement_number,
            ),

      sport:
        row.sport ??
        null,

      physicalActivity:
        row.physical_activity ??
        null,

      activityType:
        row.activity_type ??
        null,

      sex:
        row.sex,

      birthDate:
        row.birth_date ??
        null,

      ageYears:
        row.age_years ==
        null
          ? null
          : Number(
              row.age_years,
            ),

      measures:
        row.measures ??
        {},

      boneReferenceKg:
        row.bone_reference_kg ==
        null
          ? null
          : Number(
              row.bone_reference_kg,
            ),

      results:
        row.results ??
        null,

      linkedControlId:
        row.linked_control_id ==
        null
          ? null
          : Number(
              row.linked_control_id,
            ),

      source:
        row.source,

      sourceFileName:
        row.source_file_name ??
        null,

      sourceSheetName:
        row.source_sheet_name ??
        null,

      sourcePlayerName:
        row.source_player_name ??
        null,

      notes:
        row.notes ??
        null,

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,
    }),
  );
}

/* ============================================================
   DATOS LOCALES
============================================================ */

export async function hasLocalData() {
  const d = db();

  const count =
    await d.players.count();

  return count > 0;
}

/* ============================================================
   SINCRONIZAR NUBE -> LOCAL
============================================================ */

export async function syncCloudToLocal(
  onProgress?: (
    message: string,
  ) => void,
): Promise<CloudSyncResult> {
  await requireSession();

  /*
   * PROTECCIÓN CRÍTICA.
   *
   * Si hubo un guardado local que no pudo
   * llegar a Supabase, NO reemplazamos la
   * base local por una copia vieja.
   */
  if (
    hasUnsyncedLocalChanges()
  ) {
    throw new Error(
      "Hay cambios guardados en este dispositivo que todavía no llegaron a Supabase. Por seguridad no se reemplazó la copia local.",
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

      if (
        players.length > 0
      ) {
        await d.players.bulkPut(
          players,
        );
      }

      if (
        controls.length > 0
      ) {
        await d.controls.bulkPut(
          controls,
        );
      }

      if (
        weightRecords.length >
        0
      ) {
        await d.weightRecords.bulkPut(
          weightRecords,
        );
      }

      if (
        objectivePeriods.length >
        0
      ) {
        await d.objectivePeriods.bulkPut(
          objectivePeriods,
        );
      }

      if (
        hydrationTests.length >
        0
      ) {
        await d.hydrationTests.bulkPut(
          hydrationTests,
        );
      }

      if (
        fullAnthropometries.length >
        0
      ) {
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
    players:
      players.length,

    controls:
      controls.length,

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
