// Apoio de testes do dominio de ciclos. NAO faz parte do modulo.
// Deterministico: sem relogio e sem Math.random (gerador com semente).
import { isValidDate } from '../dates/index.ts';
import { closeCycle, createCycle } from './index.ts';
import type { ClosedCycle, OpenCycle } from './index.ts';

/** Gerador pseudoaleatorio mulberry32: mesma semente, mesma sequencia. Retorna [0, 1). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inteiro em [min, max]. */
export function randInt(rnd: () => number, min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}

/** Data valida aleatoria entre 2019 e 2030, incluindo dias 29-31 e fevereiro. */
export function randomDate(rnd: () => number): string {
  for (;;) {
    const y = randInt(rnd, 2019, 2030);
    const m = randInt(rnd, 1, 12);
    const d = randInt(rnd, 1, 31);
    const s = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (isValidDate(s)) return s;
  }
}

export function makeOpen(id: string, startDate: string): OpenCycle {
  return createCycle({ id, startDate });
}

export function makeClosed(id: string, startDate: string, endDate: string): ClosedCycle {
  return closeCycle(createCycle({ id, startDate }), endDate);
}

/** Todas as permutacoes de uma lista (so para listas pequenas). */
export function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const out: T[][] = [];
  items.forEach((item, i) => {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) out.push([item, ...p]);
  });
  return out;
}

/** Embaralha com Fisher-Yates usando o gerador com semente. */
export function shuffled<T>(items: readonly T[], rnd: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rnd, 0, i);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}
