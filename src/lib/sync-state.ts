  ) {
    withoutDelete[
      indexAfterDeleteRemoval
    ] = operation;
  } else {
    withoutDelete.push(
      operation,
    );
  }

  writeQueue(
    withoutDelete,
  );

  return operation.id;
}

export function queueDeleteOperation(
  entity: SyncEntity,
  localId: number,
) {
  const queue =
    readQueue();

  const pendingNew =
    queue.find(
      (operation) =>
        operation.entity === entity &&
        operation.localId === localId &&
        operation.action === "upsert" &&
        operation.isNew,
    );

  /*
   * Si el registro nació localmente y nunca
   * llegó a la nube, borrarlo significa que
   * simplemente podemos quitar su alta pendiente.
   */
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

  const withoutPrevious =
    queue.filter(
      (operation) =>
        !(
          operation.entity === entity &&
          operation.localId === localId
        ),
    );

  const operation:
    PendingSyncOperation = {
    id:
      createOperationId(),

    entity,
    action: "delete",
    localId,
    isNew: false,
    createdAt:
      new Date().toISOString(),
  };

  withoutPrevious.push(
    operation,
  );

  writeQueue(
    withoutPrevious,
  );

  return operation.id;
}

export function removePendingSyncOperation(
  operationId: string,
) {
  writeQueue(
    readQueue().filter(
      (operation) =>
        operation.id !==
        operationId,
    ),
  );
}

export function markUnsyncedLocalChanges() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    UNSYNCED_KEY,
    "1",
  );
}

export function hasUnsyncedLocalChanges() {
  if (!canUseStorage()) {
    return false;
  }

  return (
    readQueue().length > 0
  );
}

export function clearUnsyncedLocalChanges() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(
    QUEUE_KEY,
  );

  window.localStorage.removeItem(
