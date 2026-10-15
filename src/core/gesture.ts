// The gesture state machine: pointer events in, intents out. Pure: time comes with the inputs, and the
// 300 ms wait for a double tap is a timer the caller runs and reports back as a "timeout" input.

export type PointerKind = "mouse" | "touch" | "pen";
export type Mode = "swipe" | "pan" | "dismiss";

/** What is under the pointer when it goes down; the DOM shell measures it. */
export interface Target {
  area: "media" | "outside";
  type: "image" | "video";
  zoomable: boolean;
  zoomed: boolean;
  /** A zoomed photo that is already at its left (or right) pan bound. */
  atLeft: boolean;
  atRight: boolean;
}

interface PointerInput {
  id: number;
  x: number;
  y: number;
  t: number;
  kind: PointerKind;
}

export type GestureInput =
  | (PointerInput & { type: "down"; target: Target })
  | (PointerInput & { type: "move" | "up" | "cancel" })
  | { type: "timeout"; t: number };

export type Intent =
  // A drag in progress. dx and dy count from where the drag was recognised, so it starts at 0, 0.
  | { type: "drag"; mode: Mode; dx: number; dy: number }
  | { type: "release"; mode: Mode; dx: number; dy: number; vx: number; vy: number }
  // A drag ended by a second finger or by the browser: spring back.
  | { type: "abort"; mode: Mode }
  | { type: "tap"; x: number; y: number; kind: PointerKind; target: Target }
  | { type: "double-tap"; x: number; y: number; target: Target };

interface Sample {
  x: number;
  y: number;
  t: number;
}

interface Tap extends Sample {
  kind: PointerKind;
  target: Target;
}

export interface GestureState {
  phase: "idle" | "pressed" | "dragging" | "ignored" | "blocked";
  /** The pointer being followed. */
  id: number;
  kind: PointerKind;
  target: Target | null;
  mode: Mode | null;
  start: Sample;
  /** Where the drag was recognised. */
  origin: Sample;
  /** Positions of the last 100 ms, for the release velocity. */
  samples: Sample[];
  /** Every pointer that is down. */
  pointers: number[];
  /** A single tap waiting for a possible second one. */
  pending: Tap | null;
}

export interface GestureStep {
  state: GestureState;
  intents: Intent[];
  /** Start the timer with this delay in ms, cancel it (null), or leave it alone (undefined). */
  timer?: number | null;
}

export const SLOP = 10;
export const TAP_MS = 300;
export const DOUBLE_TAP_PX = 30;
const VELOCITY_MS = 100;

const ZERO: Sample = { x: 0, y: 0, t: 0 };

export const initialGesture: GestureState = {
  phase: "idle",
  id: -1,
  kind: "mouse",
  target: null,
  mode: null,
  start: ZERO,
  origin: ZERO,
  samples: [],
  pointers: [],
  pending: null,
};

export function gesture(state: GestureState, input: GestureInput): GestureStep {
  switch (input.type) {
    case "timeout":
      return state.pending
        ? { state: { ...state, pending: null }, intents: [tapOf(state.pending)] }
        : { state, intents: [] };
    case "down":
      return down(state, input);
    case "move":
      return move(state, input);
    case "up":
      return up(state, input);
    case "cancel":
      return cancel(state, input);
  }
}

function down(s: GestureState, i: PointerInput & { target: Target }): GestureStep {
  const pointers = [...s.pointers, i.id];
  if (s.phase !== "idle") {
    // v1 follows one finger: a second one cancels the gesture until every finger is up.
    const intents: Intent[] = s.phase === "dragging" && s.mode ? [{ type: "abort", mode: s.mode }] : [];
    return { state: { ...s, phase: "blocked", pointers }, intents };
  }
  const p = sample(i);
  return {
    state: {
      ...s,
      phase: "pressed",
      id: i.id,
      kind: i.kind,
      target: i.target,
      mode: null,
      start: p,
      origin: p,
      samples: [p],
      pointers,
    },
    intents: [],
  };
}

function move(s: GestureState, i: PointerInput): GestureStep {
  if (i.id !== s.id || (s.phase !== "pressed" && s.phase !== "dragging")) return { state: s, intents: [] };
  const p = sample(i);
  const samples = recent([...s.samples, p]);
  if (s.phase === "dragging") {
    return {
      state: { ...s, samples },
      intents: [{ type: "drag", mode: s.mode!, dx: p.x - s.origin.x, dy: p.y - s.origin.y }],
    };
  }
  const dx = p.x - s.start.x;
  const dy = p.y - s.start.y;
  if (Math.hypot(dx, dy) < SLOP) return { state: { ...s, samples }, intents: [] };
  // The press became a drag: a single tap that was waiting for its second one stands alone now.
  const intents: Intent[] = s.pending ? [tapOf(s.pending)] : [];
  const timer = s.pending ? null : undefined;
  const mode = lock(s.target!, dx, dy);
  if (!mode) return { state: { ...s, phase: "ignored", samples, pending: null }, intents, timer };
  intents.push({ type: "drag", mode, dx: 0, dy: 0 });
  return { state: { ...s, phase: "dragging", mode, origin: p, samples, pending: null }, intents, timer };
}

function up(s: GestureState, i: PointerInput): GestureStep {
  const pointers = s.pointers.filter((id) => id !== i.id);
  if (s.phase === "blocked")
    return { state: { ...s, phase: pointers.length ? "blocked" : "idle", pointers }, intents: [] };
  if (i.id !== s.id) return { state: { ...s, pointers }, intents: [] };
  const p = sample(i);
  const idle: GestureState = { ...s, phase: "idle", mode: null, pointers };
  if (s.phase === "dragging") {
    const { vx, vy } = velocity(recent([...s.samples, p]));
    return {
      state: idle,
      intents: [{ type: "release", mode: s.mode!, dx: p.x - s.origin.x, dy: p.y - s.origin.y, vx, vy }],
    };
  }
  if (s.phase !== "pressed" || p.t - s.start.t > TAP_MS) return { state: idle, intents: [] };
  const tap: Tap = { ...p, kind: s.kind, target: s.target! };
  const { pending } = s;
  if (pending && Math.hypot(p.x - pending.x, p.y - pending.y) <= DOUBLE_TAP_PX && p.t - pending.t <= TAP_MS) {
    return {
      state: { ...idle, pending: null },
      intents: [{ type: "double-tap", x: p.x, y: p.y, target: pending.target }],
      timer: null,
    };
  }
  const intents: Intent[] = pending ? [tapOf(pending)] : [];
  if (waitsForSecondTap(tap)) return { state: { ...idle, pending: tap }, intents, timer: TAP_MS };
  intents.push(tapOf(tap));
  return { state: { ...idle, pending: null }, intents, timer: pending ? null : undefined };
}

function cancel(s: GestureState, i: PointerInput): GestureStep {
  const pointers = s.pointers.filter((id) => id !== i.id);
  if (s.phase === "blocked")
    return { state: { ...s, phase: pointers.length ? "blocked" : "idle", pointers }, intents: [] };
  if (i.id !== s.id) return { state: { ...s, pointers }, intents: [] };
  const intents: Intent[] = s.phase === "dragging" && s.mode ? [{ type: "abort", mode: s.mode }] : [];
  return { state: { ...s, phase: "idle", mode: null, pointers }, intents };
}

/** What a drag does, decided once when it passes the slop. Null: nothing (dragging up). */
function lock(target: Target, dx: number, dy: number): Mode | null {
  const horizontal = Math.abs(dx) > Math.abs(dy);
  if (target.zoomed) return horizontal && (dx < 0 ? target.atRight : target.atLeft) ? "swipe" : "pan";
  if (horizontal) return "swipe";
  return dy > 0 ? "dismiss" : null;
}

const waitsForSecondTap = (tap: Tap): boolean =>
  tap.kind !== "mouse" && tap.target.area === "media" && tap.target.type === "image" && tap.target.zoomable;

const tapOf = ({ x, y, kind, target }: Tap): Intent => ({ type: "tap", x, y, kind, target });

const sample = ({ x, y, t }: PointerInput): Sample => ({ x, y, t });

function recent(samples: Sample[]): Sample[] {
  const last = samples[samples.length - 1]!;
  return samples.filter((p) => last.t - p.t <= VELOCITY_MS);
}

function velocity(samples: Sample[]): { vx: number; vy: number } {
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  const dt = last.t - first.t;
  return dt > 0 ? { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt } : { vx: 0, vy: 0 };
}
