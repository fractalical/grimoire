export function hash(value: string) {
  let h = 2166136261;
  for (const char of value) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function shuffle<T>(items: T[], seed: string): T[] {
  let n = hash(seed);
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    const j = n % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
