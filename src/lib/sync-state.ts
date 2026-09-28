export type SyncEntity =
  | "player"
  | "control"
  | "weightRecord"
  | "objectivePeriod"
  | "hydrationTest"
  | "fullAnthropometry";

export interface PendingSyncOperation {
  id: string;
  entity: SyncEntity;
  action: "upsert" | "delete";
  localId: number;
  isNew: boolean;
  createdAt: string;
}

const QUEUE_KEY = "san-lorenzo-antro-sync-queue";
const UNSYNCED_KEY = "san-lorenzo-antro-unsynced-changes";

function canUseStorage() {
  return typeof window !== "undefined";
}

function createOperationId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readQueue(): PendingSyncOperation[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingSyncOperation[]) {
  if (!canUseStorage()) return;

  if (queue.length === 0) {
    window.localStorage.removeItem(QUEUE_KEY);
    window.localStorage.removeItem(UNSYNCED_KEY);
    return;
  }

  window.localStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(queue),
  );

  window.localStorage.setItem(
    UNSYNCED_KEY,
    "1",
  );
}

export function getPendingSyncOperations() {
  return readQueue();
}

export function replacePendingSyncOperations(
  operations: PendingSyncOperation[],
) {
  writeQueue(operations);
}

export function queueUpsertOperation(
  entity: SyncEntity,
  localId: number,
  isNew: boolean,
) {
  const queue = readQueue();

  const previous = queue.find(
    (operation) =>
      operation.entity === entity &&
      operation.localId === localId,
  );

  const operation: PendingSyncOperation = {
    id: previous?.id ?? createOperationId(),
    entity,
    action: "upsert",
    localId,
    isNew:
      previous?.action === "upsert"
        ? previous.isNew || isNew
        : isNew,
    createdAt:
      previous?.createdAt ??
      new Date().toISOString(),
  };

  const next = queue.filter(
    (item) =>
      !(
        item.entity === entity &&
        item.localId === localId
      ),
  );

  next.push(operation);
  writeQueue(next);

  return operation.id;
}

export function queueDeleteOperation(
  entity: SyncEntity,
  localId: number,
) {
  const queue = readQueue();

  const pendingNew = queue.find(
    (operation) =>
      operation.entity === entity &&
      operation.localId === localId &&
      operation.action === "upsert" &&
      operation.isNew,
  );

  if (pendingNew) {
    writeQueue(
      queue.filter(
        (operation) =>
          !(
            operation.entity === entity &&
            operation.localId === localId
          ),
      ),
    );

    return null;
  }

  const operation: PendingSyncOperation = {
    id: createOperationId(),
    entity,
    action: "delete",
    localId,
    isNew: false,
    createdAt: new Date().toISOString(),
  };

  const next = queue.filter(
    (item) =>
      !(
        item.entity === entity &&
        item.localId === localId
      ),
  );

  next.push(operation);
  writeQueue(next);

  return operation.id;
}

export function removePendingSyncOperation(
  operationId: string,
) {
  writeQueue(
    readQueue().filter(
      (operation) =>
        operation.id !== operationId,
    ),
  );
}

export function markUnsyncedLocalChanges() {
  if (!canUseStorage()) return;

  window.localStorage.setItem(
    UNSYNCED_KEY,
    "1",
  );
}

export function hasUnsyncedLocalChanges() {
  if (!canUseStorage()) return false;

  return readQueue().length > 0;
}

export function clearUnsyncedLocalChanges() {
  if (!canUseStorage()) return;

  window.localStorage.removeItem(
    QUEUE_KEY,
  );

  window.localStorage.removeItem(
    UNSYNCED_KEY,
  );
}
