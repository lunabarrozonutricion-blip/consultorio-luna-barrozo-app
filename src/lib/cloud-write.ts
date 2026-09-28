import { supabase } from "./supabase";

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

/* ============================================================
   USUARIO / SESIÓN
============================================================ */

async function getOwnerId() {
  if (!supabase) {
    return null;
  }

  /*
   * Si estamos sin internet dejamos trabajar
   * con IndexedDB.
   *
   * Más adelante vamos a agregar la cola offline
   * para enviar esos cambios al recuperar conexión.
   */
  if (
    typeof navigator !== "undefined" &&
    !navigator.onLine
  ) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return (
    data.session?.user.id ??
    null
  );
}

/* ============================================================
   JUGADORAS
============================================================ */

export async function cloudUpsertPlayer(
  player: PlayerProfile,
) {
  if (player.id == null) {
    throw new Error(
      "La jugadora debe tener un ID local antes de sincronizarse.",
    );
  }

  const ownerId =
    await getOwnerId();

  if (!ownerId || !supabase) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from("players")
      .upsert(
        {
          id: player.id,

          owner_id:
            ownerId,

          name:
            player.name,

          position:
            player.position ??
            null,

          birth_date:
            player.birthDate ??
            null,

          phone:
            player.phone ??
            null,

          email:
            player.email ??
            null,

          general_notes:
            player.generalNotes ??
            null,

          active:
            player.active,

          created_at:
            player.createdAt,

          updated_at:
            player.updatedAt,
        },
        {
          onConflict: "id",
        },
      );

  if (error) {
    throw error;
  }
}

export async function cloudDeletePlayer(
  id: number,
) {
  const ownerId =
    await getOwnerId();

  if (!ownerId || !supabase) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from("players")
      .delete()
      .eq("id", id)
      .eq(
        "owner_id",
        ownerId,
      );

  if (error) {
    throw error;
  }
}

/* ============================================================
   CONTROLES
============================================================ */

export async function cloudUpsertControl(
  control: Control,
) {
  if (control.id == null) {
    throw new Error(
      "El control debe tener un ID local antes de sincronizarse.",
    );
  }

  const ownerId =
    await getOwnerId();

  if (!ownerId || !supabase) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from("controls")
      .upsert(
        {
          id: control.id,

          owner_id:
            ownerId,

          player_id:
            control.playerId,

          date:
            control.date,

          weight:
            control.weight,

          triceps:
            control.triceps,

          subscapular:
            control.subscapular,

          supraespinal:
            control.supraespinal,

          abdominal:
            control.abdominal,

          thigh_skinfold:
            control.thighSkinfold,

          calf_skinfold:
            control.calfSkinfold,

          arm_perimeter:
            control.armPerimeter,

          thigh_perimeter:
            control.thighPerimeter,

          calf_perimeter:
            control.calfPerimeter,

          notes:
            control.notes,

          created_at:
            control.createdAt,

          updated_at:
            control.updatedAt,
        },
        {
          onConflict: "id",
        },
      );

  if (error) {
    throw error;
  }
}

export async function cloudDeleteControl(
  id: number,
) {
  const ownerId =
    await getOwnerId();

  if (!ownerId || !supabase) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from("controls")
      .delete()
      .eq("id", id)
      .eq(
        "owner_id",
        ownerId,
      );

  if (error) {
    throw error;
  }
}

/* ============================================================
   PESAJES
============================================================ */

export async function cloudUpsertWeightRecord(
  record: WeightRecord,
) {
  if (record.id == null) {
    throw new Error(
      "El pesaje debe tener un ID local antes de sincronizarse.",
    );
  }

  const ownerId =
    await getOwnerId();

  if (!ownerId || !supabase) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from("weight_records")
      .upsert(
        {
          id: record.id,

          owner_id:
            ownerId,

          player_id:
            record.playerId,

          date:
            record.date,

          weight:
            record.weight,

          condition:
            record.condition,

          notes:
            record.notes,

          created_at:
            record.createdAt,

          updated_at:
            record.updatedAt,
        },
        {
          onConflict: "id",
        },
      );

  if (error) {
    throw error;
  }
}

export async function cloudDeleteWeightRecord(
  id: number,
) {
  const ownerId =
    await getOwnerId();

  if (!ownerId || !supabase) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from("weight_records")
      .delete()
      .eq("id", id)
      .eq(
        "owner_id",
        ownerId,
      );

  if (error) {
    throw error;
  }
}

/* ============================================================
   OBJETIVOS
============================================================ */

export async function cloudUpsertObjectivePeriod(
  period: ObjectivePeriod,
) {
  if (period.id == null) {
    throw new Error(
      "El período debe tener un ID local antes de sincronizarse.",
    );
  }

  const ownerId =
    await getOwnerId();

  if (!ownerId || !supabase) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from(
        "objective_periods",
      )
      .upsert(
        {
          id: period.id,

          owner_id:
            ownerId,

          key:
            period.key,

          label:
            period.label,

          year:
            period.year,

          month:
            period.month,

          targets:
            period.targets,

          created_at:
            period.createdAt,

          updated_at:
            period.updatedAt,
        },
        {
          onConflict: "id",
        },
      );

  if (error) {
    throw error;
  }
}

/* ============================================================
   HIDRATACIÓN
============================================================ */

export async function cloudUpsertHydrationTest(
  test: HydrationTest,
) {
  if (test.id == null) {
    throw new Error(
      "El test debe tener un ID local antes de sincronizarse.",
    );
  }

  const ownerId =
    await getOwnerId();

  if (!ownerId || !supabase) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from(
        "hydration_tests",
      )
      .upsert(
        {
          id: test.id,

          owner_id:
            ownerId,

          date:
            test.date,

          round:
            test.round,

          rival:
            test.rival,

          day_type:
            test.dayType,

          context:
            test.context,

          custom_context:
            test.customContext,

          entries:
            test.entries,

          created_at:
            test.createdAt,

          updated_at:
            test.updatedAt,
        },
        {
          onConflict: "id",
        },
      );

  if (error) {
    throw error;
  }
}

export async function cloudDeleteHydrationTest(
  id: number,
) {
  const ownerId =
    await getOwnerId();

  if (!ownerId || !supabase) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from("hydration_tests")
      .delete()
      .eq("id", id)
      .eq(
        "owner_id",
        ownerId,
      );

  if (error) {
    throw error;
  }
}

/* ============================================================
   ANTROPOMETRÍAS COMPLETAS
============================================================ */

export async function cloudUpsertFullAnthropometry(
  anthropometry: FullAnthropometry,
) {
  if (
    anthropometry.id == null
  ) {
    throw new Error(
      "La antropometría debe tener un ID local antes de sincronizarse.",
    );
  }

  const ownerId =
    await getOwnerId();

  if (!ownerId || !supabase) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from(
        "full_anthropometries",
      )
      .upsert(
        {
          id:
            anthropometry.id,

          owner_id:
            ownerId,

          player_id:
            anthropometry.playerId,

          date:
            anthropometry.date,

          measurement_number:
            anthropometry.measurementNumber,

          sport:
            anthropometry.sport,

          physical_activity:
            anthropometry.physicalActivity,

          activity_type:
            anthropometry.activityType,

          sex:
            anthropometry.sex,

          birth_date:
            anthropometry.birthDate,

          age_years:
            anthropometry.ageYears,

          measures:
            anthropometry.measures,

          bone_reference_kg:
            anthropometry.boneReferenceKg,

          results:
            anthropometry.results,

          linked_control_id:
            anthropometry.linkedControlId,

          source:
            anthropometry.source,

          source_file_name:
            anthropometry.sourceFileName,

          source_sheet_name:
            anthropometry.sourceSheetName,

          source_player_name:
            anthropometry.sourcePlayerName,

          notes:
            anthropometry.notes,

          created_at:
            anthropometry.createdAt,

          updated_at:
            anthropometry.updatedAt,
        },
        {
          onConflict: "id",
        },
      );

  if (error) {
    throw error;
  }
}

export async function cloudDeleteFullAnthropometry(
  id: number,
) {
  const ownerId =
    await getOwnerId();

  if (!ownerId || !supabase) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from(
        "full_anthropometries",
      )
      .delete()
      .eq("id", id)
      .eq(
        "owner_id",
        ownerId,
      );

  if (error) {
    throw error;
  }
}
