// The page's own buttons and outputs in the dialog, found by data-dlb-* attributes, and the state
// attributes the page styles with.

const NAMES = [
  "close",
  "prev",
  "next",
  "zoom",
  "counter",
  "total",
  "play",
  "mute",
  "progress",
  "fullscreen",
] as const;

export type Controls = Record<(typeof NAMES)[number], HTMLElement[]>;

/** What the dialog shows about the current slide. */
export interface UiState {
  type: "image" | "video";
  index: number;
  count: number;
  first: boolean;
  last: boolean;
  loading: boolean;
  error: boolean;
  zoomable: boolean;
  zoomed: boolean;
  uiHidden: boolean;
  paused: boolean;
  muted: boolean;
  noaudio: boolean;
  /** The current slide is a video and the browser can show it fullscreen. */
  fullscreen: boolean;
}

export function findControls(dialog: HTMLDialogElement): Controls {
  const controls = {} as Controls;
  for (const name of NAMES) controls[name] = [...dialog.querySelectorAll<HTMLElement>(`[data-dlb-${name}]`)];
  return controls;
}

export function render(dialog: HTMLDialogElement, controls: Controls, ui: UiState): void {
  dialog.dataset.dlbType = ui.type;
  const flags: Record<string, boolean> = {
    first: ui.first,
    last: ui.last,
    loading: ui.loading,
    error: ui.error,
    zoomable: ui.zoomable,
    zoomed: ui.zoomed,
    "ui-hidden": ui.uiHidden,
    paused: ui.paused,
    muted: ui.muted,
    noaudio: ui.noaudio,
  };
  for (const [name, on] of Object.entries(flags)) dialog.toggleAttribute(`data-dlb-${name}`, on);
  for (const counter of controls.counter) counter.textContent = String(ui.index + 1);
  for (const total of controls.total) total.textContent = String(ui.count);
  disable(controls.prev, ui.first);
  disable(controls.next, ui.last);
  disable(controls.zoom, !ui.zoomable);
  disable(controls.mute, ui.noaudio);
  disable(controls.fullscreen, !ui.fullscreen);
  press(controls.zoom, ui.zoomed);
  press(controls.play, !ui.paused);
  press(controls.mute, ui.muted);
}

/** Removes the state attributes when the box closes; `data-dlb` itself stays. */
export function clear(dialog: HTMLDialogElement): void {
  for (const name of dialog.getAttributeNames())
    if (name.startsWith("data-dlb-")) dialog.removeAttribute(name);
}

function disable(elements: HTMLElement[], disabled: boolean): void {
  for (const element of elements) element.toggleAttribute("disabled", disabled);
}

function press(elements: HTMLElement[], pressed: boolean): void {
  for (const element of elements) element.setAttribute("aria-pressed", String(pressed));
}
