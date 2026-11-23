/**
 * Matematica pura sobre listas de numeros (nenhuma entrada e alterada).
 *
 * Politica numerica: numeros IEEE-754 (double), sem arredondamento.
 *  - soma de inteiros: exata (ate 2^53);
 *  - mediana e MAD de inteiros: exatas (multiplos de 0,25, representaveis em double);
 *  - media: UM unico quociente soma / quantidade (arredondamento correto do
 *    IEEE, sem erro acumulado); e a unica medida que pode ser dizima.
 */
import { InvalidStatisticsInputError } from './errors.ts';

function requireNonEmpty(values: readonly number[]): void {
  if (values.length === 0) throw new InvalidStatisticsInputError('a lista de valores esta vazia');
}

export function sortedAscending(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function mean(values: readonly number[]): number {
  requireNonEmpty(values);
  return sum(values) / values.length;
}

/** Mediana de uma lista JA ordenada de forma crescente. */
export function medianOfSorted(sorted: readonly number[]): number {
  requireNonEmpty(sorted);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export function median(values: readonly number[]): number {
  return medianOfSorted(sortedAscending(values));
}

/** MAD bruto: mediana dos desvios absolutos em relacao a mediana. */
export function mad(values: readonly number[]): number {
  const center = median(values);
  return median(values.map((v) => Math.abs(v - center)));
}

/** Distribuicao de uma lista ordenada: [{valor, quantidade}] crescente e sem repeticoes. */
export function distributionOfSorted(sorted: readonly number[]): Array<{ durationDays: number; count: number }> {
  const out: Array<{ durationDays: number; count: number }> = [];
  for (const v of sorted) {
    const last = out[out.length - 1];
    if (last !== undefined && last.durationDays === v) last.count += 1;
    else out.push({ durationDays: v, count: 1 });
  }
  return out;
}
