// Apoio de testes do dominio de estatisticas. NAO faz parte do modulo.
// Deterministico: sem relogio e sem Math.random. Usa Date.UTC so aqui, nos testes, para somar dias.
import { closeCycle, createCycle } from '../cycles/index.ts';
import type { ClosedCycle } from '../cycles/index.ts';

export { prng, randInt, randomDate, shuffled, makeOpen, makeClosed } from '../cycles/test-support.ts';

const MS_PER_DAY = 86_400_000;

/** Soma `n` dias a uma data ISO (oraculo de teste, em UTC). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  const u = new Date(t.getTime() + n * MS_PER_DAY);
  return `${String(u.getUTCFullYear()).padStart(4, '0')}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(u.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Ciclos fechados encadeados, na ordem dada, com as duracoes pedidas (em dias).
 * Cada ciclo comeca `gap` dias depois do fim do anterior (padrao 0: os ciclos
 * "encostam" na mesma data, que e permitido pela decisao PD-001).
 */
export function closedFromDurations(
  durations: readonly number[],
  options: { start?: string; gap?: number; idPrefix?: string } = {},
): ClosedCycle[] {
  const gap = options.gap ?? 0;
  const prefix = options.idPrefix ?? 'c';
  let cursor = options.start ?? '2020-01-01';
  return durations.map((days, i) => {
    const start = cursor;
    const end = addDays(start, days);
    cursor = addDays(end, gap);
    return closeCycle(createCycle({ id: `${prefix}${String(i + 1).padStart(3, '0')}`, startDate: start }), end);
  });
}
