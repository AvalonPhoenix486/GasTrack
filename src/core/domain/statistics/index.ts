/**
 * API publica do dominio de estatisticas. Outras camadas importam so daqui.
 * Depende apenas do dominio de ciclos (../cycles/index.ts).
 */
export type {
  DistributionEntry, StatisticsOptions, NoDataStatistics, DurationStatisticsWithData, DurationStatistics,
} from './types.ts';
export { calculateStatistics } from './calculate.ts';
export { closedCycles, lastClosedCycles } from './select.ts';
export { InvalidStatisticsInputError } from './errors.ts';
