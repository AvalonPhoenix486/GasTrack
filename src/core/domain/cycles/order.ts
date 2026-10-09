/**
 * Ordem cronologica dos ciclos. Nao depende da ordem de insercao.
 */
import { compareDates } from '../dates/index.ts';
import type { Cycle } from './types.ts';

/**
 * Comparador total e deterministico:
 *  1. startDate crescente;
 *  2. em empate, ciclo fechado antes do aberto;
 *  3. entre fechados, endDate crescente;
 *  4. por ultimo, id (comparacao por unidade de codigo, sem depender de locale).
 */
export function compareCycles(a: Cycle, b: Cycle): -1 | 0 | 1 {
  const byStart = compareDates(a.startDate, b.startDate);
  if (byStart !== 0) return byStart;
  if (a.endDate === null && b.endDate !== null) return 1;
  if (a.endDate !== null && b.endDate === null) return -1;
  if (a.endDate !== null && b.endDate !== null) {
    const byEnd = compareDates(a.endDate, b.endDate);
    if (byEnd !== 0) return byEnd;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
