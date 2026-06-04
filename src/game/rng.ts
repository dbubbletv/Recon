// A tiny deterministic-ish PRNG (mulberry32) so rolls are reproducible from a seed.
// Each call returns [value, nextSeed] keeping our systems pure.

export function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return [value, t >>> 0];
}

/** Random float in [min, max). */
export function randRange(seed: number, min: number, max: number): [number, number] {
  const [v, s] = nextRandom(seed);
  return [min + v * (max - min), s];
}

/** Random integer in [min, max] inclusive. */
export function randInt(seed: number, min: number, max: number): [number, number] {
  const [v, s] = nextRandom(seed);
  return [Math.floor(min + v * (max - min + 1)), s];
}

/** Pick a random element from an array. */
export function pick<T>(seed: number, arr: readonly T[]): [T, number] {
  const [i, s] = randInt(seed, 0, arr.length - 1);
  return [arr[i], s];
}

/** Returns true with probability p. */
export function chance(seed: number, p: number): [boolean, number] {
  const [v, s] = nextRandom(seed);
  return [v < p, s];
}
