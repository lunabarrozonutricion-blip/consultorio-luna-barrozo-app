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
