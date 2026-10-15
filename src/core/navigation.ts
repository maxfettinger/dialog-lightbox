// Which slide comes next: indices with or without looping, and the neighbours to render.

/** The index `delta` slides away from `index`, or null when that leaves the gallery. */
export function step(index: number, delta: number, count: number, loop: boolean): number | null {
  const target = index + delta;
  if (target >= 0 && target < count) return target;
  if (!loop || count < 2) return null;
  return ((target % count) + count) % count;
}

/** Previous, current and next index. With two looping slides the other one appears once, as next. */
export function neighbours(
  index: number,
  count: number,
  loop: boolean,
): [number | null, number, number | null] {
  const prev = step(index, -1, count, loop);
  const next = step(index, 1, count, loop);
  return [prev === next ? null : prev, index, next];
}
