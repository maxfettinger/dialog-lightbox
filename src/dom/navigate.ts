// Moving between slides: the strip springs to the new slide, or back where there is none.
import { FIT_VIEW } from "../core/geometry.js";
import { spring } from "../core/motion.js";
import { step } from "../core/navigation.js";
import { play } from "./animate.js";
import { current, GAP, place, type Session, setSlots } from "./session.js";

/** Springs the strip from where it is to `to`, starting at `velocity` px/ms. */
export async function springStrip(s: Session, to: number, velocity: number): Promise<void> {
  const { frames, duration } = spring([s.stripX], [to], [velocity], 30);
  s.stripX = to;
  place(s);
  await play(
    s.strip,
    frames.map(([x = 0]) => ({ transform: `translateX(${x}px)` })),
    duration,
  );
}

/**
 * Goes one slide back (-1) or forward (1), starting at `velocity`, and calls `changed` once the current
 * slide has changed. Where there is no slide in that direction the strip springs back.
 */
export function change(s: Session, direction: -1 | 1, velocity: number, changed: () => void): void {
  const next = step(s.index, direction, s.slides.length, s.loop);
  if (next !== null) {
    current(s).base = 1;
    s.view = FIT_VIEW;
    // The new current slide keeps its place on screen; the strip then springs it to the middle.
    s.stripX += direction * s.size.width * (1 + GAP);
    setSlots(s, next);
    changed();
  }
  void springStrip(s, 0, velocity);
}
