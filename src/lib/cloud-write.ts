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
   SESIÓN
============================================================ */

async function requireOwnerId() {
  if (!supabase) {
    throw new Error(
      "Supabase no está configurado.",
    );
  }

  if (
    typeof navigator !==
      "undefined" &&
    !navigator.onLine
  ) {
    throw new Error(
      "No hay conexión a internet.",
    );
  }

  const {
    data,
    error,
  } =
    await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const ownerId =
    data.session?.user.id;

  if (!ownerId) {
    throw new Error(
      "No hay una sesión iniciada.",
    );
  }

  return ownerId;
}

function requireReturnedId(
  id: unknown,
) {
  const value =
    Number(id);

  if (
    !Number.isFinite(value)
  ) {
    throw new Error(
      "Supabase no devolvió un ID válido.",
    );
  }

  return value;
}

/* ============================================================
   JUGADORAS
============================================================ */

export async function cloudUpsertPlayer(
  player: PlayerProfile,
) {
  const ownerId =
    await requireOwnerId();

  if (!supabase) {
    throw new Error(
      "Supabase no está disponible.",
    );
  }

  const payload = {
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
  };

  /*
   * NUEVA JUGADORA:
   * Supabase genera el ID.
   */
  if (player.id == null) {
    const {
      data,
      error,
    } =
      await supabase
        .from("players")
        .insert(payload)
        .select("id")
        .single();

    if (error) {
      throw error;
    }

    return requireReturnedId(
      data.id,
    );
  }

  /*
   * JUGADORA EXISTENTE:
   * el ID ya es el ID real de Supabase.
   */
  const {
    data,
    error,
  } =
    await supabase
      .from("players")
      .update(payload)
      .eq(
        "id",
        player.id,
      )
      .eq(
        "owner_id",
        ownerId,
      )
      .select("id")
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "La jugadora no existe en Supabase.",
    );
  }

  return requireReturnedId(
    data.id,
  );
}

export async function cloudDeletePlayer(
  id: number,
) {
  const ownerId =
    await requireOwnerId();

  if (!supabase) {
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
  const ownerId =
    await requireOwnerId();

  if (!supabase) {
    throw new Error(
      "Supabase no está disponible.",
    );
  }

  const payload = {
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
  };

  if (control.id == null) {
    const {
      data,
      error,
    } =
      await supabase
        .from("controls")
        .insert(payload)
        .select("id")
        .single();

    if (error) {
      throw error;
    }

    return requireReturnedId(
      data.id,
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from("controls")
      .update(payload)
      .eq(
        "id",
        control.id,
      )
      .eq(
        "owner_id",
        ownerId,
      )
      .select("id")
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "El control no existe en Supabase.",
    );
  }

  return requireReturnedId(
    data.id,
  );
}

export async function cloudDeleteControl(
  id: number,
) {
  const ownerId =
    await requireOwnerId();

  if (!supabase) {
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
  const ownerId =
    await requireOwnerId();

  if (!supabase) {
    throw new Error(
      "Supabase no está disponible.",
    );
  }

  const payload = {
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
  };

  /*
   * NUEVO PESAJE.
   */
  if (record.id == null) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "weight_records",
        )
        .insert(payload)
        .select("id")
        .single();

    if (error) {
      throw error;
    }

    return requireReturnedId(
      data.id,
    );
  }

  /*
   * PESAJE EXISTENTE.
   */
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "weight_records",
      )
      .update(payload)
      .eq(
        "id",
        record.id,
      )
      .eq(
        "owner_id",
        ownerId,
      )
      .select("id")
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "El pesaje no existe en Supabase.",
    );
  }

  return requireReturnedId(
    data.id,
  );
}

export async function cloudDeleteWeightRecord(
  id: number,
) {
  const ownerId =
    await requireOwnerId();

  if (!supabase) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from(
        "weight_records",
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

/* ============================================================
   OBJETIVOS
============================================================ */

export async function cloudUpsertObjectivePeriod(
  period: ObjectivePeriod,
) {
  const ownerId =
    await requireOwnerId();

  if (!supabase) {
    throw new Error(
      "Supabase no está disponible.",
    );
  }

  const payload = {
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
  };

  if (period.id == null) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "objective_periods",
        )
        .insert(payload)
        .select("id")
        .single();

    if (error) {
      throw error;
    }

    return requireReturnedId(
      data.id,
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "objective_periods",
      )
      .update(payload)
      .eq(
        "id",
        period.id,
      )
      .eq(
        "owner_id",
        ownerId,
      )
      .select("id")
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "El período de objetivos no existe en Supabase.",
    );
  }

  return requireReturnedId(
    data.id,
  );
}

/* ============================================================
   HIDRATACIÓN
============================================================ */

export async function cloudUpsertHydrationTest(
  test: HydrationTest,
) {
  const ownerId =
    await requireOwnerId();

  if (!supabase) {
    throw new Error(
      "Supabase no está disponible.",
    );
  }

  const payload = {
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
  };

  if (test.id == null) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "hydration_tests",
        )
        .insert(payload)
        .select("id")
        .single();

    if (error) {
      throw error;
    }

    return requireReturnedId(
      data.id,
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "hydration_tests",
      )
      .update(payload)
      .eq(
        "id",
        test.id,
      )
      .eq(
        "owner_id",
        ownerId,
      )
      .select("id")
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "El test de hidratación no existe en Supabase.",
    );
  }

  return requireReturnedId(
    data.id,
  );
}

export async function cloudDeleteHydrationTest(
  id: number,
) {
  const ownerId =
    await requireOwnerId();

  if (!supabase) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from(
        "hydration_tests",
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

/* ============================================================
   ANTROPOMETRÍAS COMPLETAS
============================================================ */

export async function cloudUpsertFullAnthropometry(
  anthropometry: FullAnthropometry,
) {
  const ownerId =
    await requireOwnerId();

  if (!supabase) {
    throw new Error(
      "Supabase no está disponible.",
    );
  }

  const payload = {
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
  };

  if (
    anthropometry.id == null
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "full_anthropometries",
        )
        .insert(payload)
        .select("id")
        .single();

    if (error) {
      throw error;
    }

    return requireReturnedId(
      data.id,
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "full_anthropometries",
      )
      .update(payload)
      .eq(
        "id",
        anthropometry.id,
      )
      .eq(
        "owner_id",
        ownerId,
      )
      .select("id")
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "La antropometría no existe en Supabase.",
    );
  }

  return requireReturnedId(
    data.id,
  );
}

export async function cloudDeleteFullAnthropometry(
  id: number,
) {
  const ownerId =
    await requireOwnerId();

  if (!supabase) {
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
