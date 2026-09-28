import Dexie, { type Table } from "dexie";

import {
  calculateFiveComponents,
  controlDataFromFullAnthropometry,
} from "./kerr";

import {
  queueDeleteOperation,
  queueUpsertOperation,
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
