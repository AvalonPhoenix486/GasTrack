/**
 * Selecao de ciclos fechados e janela dos N mais recentes.
 * "Mais recente" = posicao na ordem cronologica real do dominio de ciclos
 * (compareCycles: startDate crescente...), NUNCA a ordem de insercao.
 */
import { compareCycles, isClosed } from '../cycles/index.ts';
import type { ClosedCycle, Cycle } from '../cycles/index.ts';
import { InvalidStatisticsInputError } from './errors.ts';

function requireList(cycles: unknown): readonly Cycle[] {
  if (!Array.isArray(cycles)) throw new InvalidStatisticsInputError('os ciclos devem ser uma lista');
  return cycles as readonly Cycle[];
}

/** Somente os ciclos fechados, em ordem cronologica. Ciclos abertos sao ignorados. */
export function closedCycles(cycles: readonly Cycle[]): readonly ClosedCycle[] {
  const closed = requireList(cycles).filter(isClosed).sort(compareCycles);
  return Object.freeze(closed);
}

/**
 * Os `n` ciclos fechados mais recentes, em ordem cronologica (do mais antigo
 * ao mais recente dentro da janela).
 *  - n maior que a quantidade: devolve todos os disponiveis (nao e erro);
 *  - n = 0: devolve lista vazia;
 *  - n negativo, fracionario, NaN, Infinity ou nao numerico: InvalidStatisticsInputError.
 */
export function lastClosedCycles(cycles: readonly Cycle[], n: number): readonly ClosedCycle[] {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
    throw new InvalidStatisticsInputError('lastN deve ser um inteiro >= 0');
  }
  const closed = closedCycles(cycles);
  // Nao usar slice(-n): slice(-0) devolveria TODOS os ciclos.
  return Object.freeze(closed.slice(closed.length - Math.min(n, closed.length)));
}
