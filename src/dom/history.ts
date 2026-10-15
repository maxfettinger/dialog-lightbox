// The back button and deep links. Opening adds one history entry (#dlb=<id>), slide changes replace it, and
// the back button closes the box instead of leaving the page.
const PREFIX = "#dlb=";

/** The slide id in the URL when the page was opened with #dlb=<id>. */
export function hashId(): string | null {
  return location.hash.startsWith(PREFIX) ? decodeURIComponent(location.hash.slice(PREFIX.length)) : null;
}

export interface HistoryLink {
  /** On open; `deep` when the URL already has the hash, so there is no entry to add. */
  open(id: string, deep: boolean): void;
  change(id: string): void;
  /** When the box closes by any means but the back button: removes the entry, or the hash. */
  close(): void;
}

export function createHistory(onBack: () => void, signal: AbortSignal): HistoryLink {
  let active = false;
  let pushed = false;
  const url = (id: string | null): string =>
    `${location.pathname}${location.search}${id === null ? "" : PREFIX + encodeURIComponent(id)}`;
  addEventListener(
    "popstate",
    () => {
      // After close() went back itself, active is false and this popstate is ignored.
      if (!active) return;
      active = false;
      onBack();
    },
    { signal },
  );
  return {
    open(id, deep) {
      active = true;
      pushed = !deep;
      if (deep) history.replaceState(history.state, "", url(id));
      else history.pushState(history.state, "", url(id));
    },
    change(id) {
      if (active) history.replaceState(history.state, "", url(id));
    },
    close() {
      if (!active) return;
      active = false;
      if (pushed) history.back();
      else history.replaceState(history.state, "", url(null));
    },
  };
}
