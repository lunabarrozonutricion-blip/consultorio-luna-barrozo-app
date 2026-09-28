const UNSYNCED_KEY =
  "san-lorenzo-antro-unsynced-changes";

export function markUnsyncedLocalChanges() {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  window.localStorage.setItem(
    UNSYNCED_KEY,
    "1",
  );
}

export function hasUnsyncedLocalChanges() {
  if (
    typeof window === "undefined"
  ) {
    return false;
  }

  return (
    window.localStorage.getItem(
      UNSYNCED_KEY,
    ) === "1"
  );
}

export function clearUnsyncedLocalChanges() {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  window.localStorage.removeItem(
    UNSYNCED_KEY,
  );
}
