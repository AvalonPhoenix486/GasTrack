/**
 * Previsao da proxima troca de botijao. Funcao pura: sem relogio, sem fuso.
 *
 * Usa TODOS os ciclos fechados (sem lastN, sem peso por recencia) e as medidas
 * de `statistics` (mediana, MAD, min, max), sem recalcula-las. O ciclo aberto
 * so fornece a data de inicio: o tempo ja decorrido NAO altera a previsao.
 */
import { isOpen } from '../cycles/index.ts';
import type { Cycle } from '../cycles/index.ts';
import { addDays } from '../dates/index.ts';
import { calculateStatistics } from '../statistics/index.ts';
import { InvalidForecastInputError } from './errors.ts';
import { MIN_CLOSED_CYCLES } from './types.ts';
import type { Forecast } from './types.ts';
import { halfWidth, toDayWindow } from './window.ts';

/**
 * Entrada: lista de ciclos de um historico valido (use listCycles(historico)), em qualquer ordem.
 * Estados:
 *  - 'insufficient-data': menos de MIN_CLOSED_CYCLES ciclos fechados (tem precedencia sobre 'no-open-cycle');
 *  - 'no-open-cycle': dados suficientes, mas nenhum ciclo aberto; sem datas;
 *  - 'ok': previsao completa.
 * Lanca InvalidForecastInputError se a entrada nao for uma lista ou tiver mais de um ciclo aberto,
 * e InvalidDateError se uma data resultante sair de 0001-01-01..9999-12-31.
 */
export function forecastNextChange(cycles: readonly Cycle[]): Forecast {
  if (!Array.isArray(cycles)) throw new InvalidForecastInputError('os ciclos devem ser uma lista');
  const openCycles = cycles.filter(isOpen);
  if (openCycles.length > 1) throw new InvalidForecastInputError('o historico tem mais de um ciclo aberto');

  const stats = calculateStatistics(cycles);
  const closedCount = stats.hasData ? stats.count : 0;
  if (!stats.hasData || stats.count < MIN_CLOSED_CYCLES) {
    return Object.freeze({ status: 'insufficient-data', closedCount, requiredCount: MIN_CLOSED_CYCLES });
  }

  const open = openCycles[0];
  if (open === undefined) return Object.freeze({ status: 'no-open-cycle', closedCount });

  const h = halfWidth(stats.mad);
  const window = toDayWindow(stats.median, h);
  return Object.freeze({
    status: 'ok',
    closedCount,
    openCycleStart: open.startDate,
    medianDays: stats.median,
    halfWidthDays: h,
    floorApplied: stats.mad < h,
    window,
    centralDate: addDays(open.startDate, window.centralDays),
    windowStartDate: addDays(open.startDate, window.lowerDays),
    windowEndDate: addDays(open.startDate, window.upperDays),
    variability: Object.freeze({
      madDays: stats.mad,
      relativeMad: stats.relativeMad,
      minDays: stats.min,
      maxDays: stats.max,
      rangeDays: stats.range,
    }),
  });
}
