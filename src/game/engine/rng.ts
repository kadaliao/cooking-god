/**
 * 可序列化的种子随机数（mulberry32）。状态就是一个 uint32，存在 RunState.rng 里，
 * 因此同一种子 + 同样的操作序列 = 完全相同的对局。
 */
export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export interface RngHolder {
  rng: number;
}

/** 返回 [0, 1)，并推进 holder.rng */
export function next(holder: RngHolder): number {
  let t = (holder.rng = (holder.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(holder: RngHolder, n: number): number {
  return Math.floor(next(holder) * n);
}

export function shuffle<T>(holder: RngHolder, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(holder, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weightedPick<T>(holder: RngHolder, items: T[], weight: (t: T) => number): T | undefined {
  const total = items.reduce((s, it) => s + weight(it), 0);
  if (total <= 0) return undefined;
  let r = next(holder) * total;
  for (const it of items) {
    r -= weight(it);
    if (r < 0) return it;
  }
  return items[items.length - 1];
}

export function randomSeed(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
