// GILDED — The Midnight Vault Job: a tiny seeded RNG (mulberry32) so the
// simulation is fully deterministic: the same seed always plays the same
// game, and no run ever reads Math.random or the wall clock.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
