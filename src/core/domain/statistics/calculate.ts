/**
 * Estatisticas de duracao dos ciclos FECHADOS, em dias totais.
 * Funcao pura: sem relogio, sem fuso, sem previsao.
 */
import { cycleDuration } from '../cycles/index.ts';
import type { Cycle } from '../cycles/index.ts';
import { InvalidStatisticsInputError } from './errors.ts';
import { distributionOfSorted, mad, mean, medianOfSorted, sortedAscending, sum } from './math.ts';
import { closedCycles, lastClosedCycles } from './select.ts';
import type { DistributionEntry, DurationStatistics, NoDataStatistics, StatisticsOptions } from './types.ts';

const NO_DATA: NoDataStatistics = Object.freeze({ hasData: false, count: 0 });

/**
 * Estatisticas de duracao.
 *  - `cycles`: lista de ciclos (use listCycles(historico)); qualquer ordem. Ciclos
 *    abertos sao ignorados: nao tem duracao final. Assume um historico valido.
 *  - `options.lastN`: janela dos N ciclos fechados mais recentes; ausente = todos.
 * Sem ciclos fechados na janela devolve { hasData: false, count: 0 }.
 */
export function calculateStatistics(cycles: readonly Cycle[], options: StatisticsOptions = {}): DurationStatistics {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new InvalidStatisticsInputError('as opcoes devem ser um objeto');
  }
  for (const key of Object.keys(options)) {
    if (key !== 'lastN') throw new InvalidStatisticsInputError(`opcao desconhecida: ${key}`);
  }

  const window = options.lastN === undefined ? closedCycles(cycles) : lastClosedCycles(cycles, options.lastN);
  if (window.length === 0) return NO_DATA;

  // Dias totais, calculados pelo dominio de ciclos/datas (nada de meses + dias).
  const durations = window.map((c) => cycleDuration(c).totalDays);
  const sorted = sortedAscending(durations);
  const median = medianOfSorted(sorted);
  const min = sorted[0] as number;
  const max = sorted[sorted.length - 1] as number;
  const deviation = mad(durations);
  const distribution: readonly DistributionEntry[] = Object.freeze(
    distributionOfSorted(sorted).map((entry) => Object.freeze(entry)),
  );

  return Object.freeze({
    hasData: true,
    count: durations.length,
    totalDays: sum(durations),
    mean: mean(durations),
    median,
    min,
    max,
    range: max - min,
    mad: deviation,
    relativeMad: median > 0 ? deviation / median : null,
    distribution,
  });
}
