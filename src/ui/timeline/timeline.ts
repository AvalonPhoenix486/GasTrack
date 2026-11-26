/**
 * Linha do tempo do ciclo atual frente a previsao: progresso e fase (antes, perto, dentro ou
 * depois da janela). So le o resultado de `forecastNextChange` e compara com a data de hoje
 * (aritmetica de calendario do dominio). Nao recalcula mediana, MAD nem janela.
 * Nada aqui e promessa: sao posicoes relativas a uma ESTIMATIVA estatistica.
 */
import type { Cycle } from '../../core/domain/cycles/index.ts';
import { compareDates, daysBetween } from '../../core/domain/dates/index.ts';
import { FLOOR_DAYS, MIN_CLOSED_CYCLES, forecastNextChange } from '../../core/domain/forecast/index.ts';

/** Parametros fixos do calculo, para exibicao informativa. Nao sao editaveis. */
export const FORECAST_PARAMETERS = Object.freeze({ minClosedCycles: MIN_CLOSED_CYCLES, floorDays: FLOOR_DAYS });

export type TimelinePhase = 'before' | 'approaching' | 'in-window' | 'after-window';

export interface TimelineOk {
  readonly status: 'ok';
  readonly startDate: string;
  readonly centralDate: string;
  readonly windowStartDate: string;
  readonly windowEndDate: string;
  /** Dias de calendario desde o inicio ate hoje (0 se o inicio e futuro). */
  readonly elapsedDays: number;
  /** Duracao central estimada em dias. */
  readonly centralDays: number;
  /** Dias de hoje ate a data central (0 se ja passou). */
  readonly remainingDays: number;
  /** Dias desde a data central ate hoje (0 se ainda nao chegou). */
  readonly overdueDays: number;
  /** Progresso 0..100 em relacao a data central (100 quando a duracao central e 0). */
  readonly progressPct: number;
  readonly phase: TimelinePhase;
  /** Dias de hoje ate o inicio da janela (0 se ja comecou). */
  readonly daysToWindowStart: number;
  /** Dias desde o fim da janela (0 se ainda nao acabou). */
  readonly daysPastWindowEnd: number;
}

/** Sem previsao de data: poucos ciclos fechados ou nenhum ciclo em andamento. */
export interface TimelineNone {
  readonly status: 'none';
  readonly reason: 'insufficient-data' | 'no-open-cycle';
  readonly closedCount: number;
  /** Minimo de ciclos fechados exigido pelo dominio. */
  readonly requiredCount: number;
}

export type Timeline = TimelineNone | TimelineOk;

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

/**
 * `noticeDays`: antecedencia (em dias inteiros >= 0) a partir da qual a fase passa de
 * 'before' para 'approaching'. Sem previsao 'ok' (poucos ciclos ou sem ciclo aberto): 'none'.
 */
export function buildTimeline(cycles: readonly Cycle[], today: string, noticeDays: number): Timeline {
  const forecast = forecastNextChange(cycles);
  if (forecast.status === 'insufficient-data') {
    return Object.freeze({ status: 'none', reason: 'insufficient-data', closedCount: forecast.closedCount, requiredCount: forecast.requiredCount });
  }
  if (forecast.status === 'no-open-cycle') {
    return Object.freeze({ status: 'none', reason: 'no-open-cycle', closedCount: forecast.closedCount, requiredCount: MIN_CLOSED_CYCLES });
  }
  const centralDays = forecast.window.centralDays;
  const elapsedDays = clamp(daysBetween(forecast.openCycleStart, today), 0, Number.MAX_SAFE_INTEGER);
  const toCentral = daysBetween(today, forecast.centralDate);
  const toWindowStart = daysBetween(today, forecast.windowStartDate);
  const sinceWindowEnd = daysBetween(forecast.windowEndDate, today);

  let phase: TimelinePhase;
  if (compareDates(today, forecast.windowStartDate) < 0) {
    phase = toWindowStart <= noticeDays ? 'approaching' : 'before';
  } else if (compareDates(today, forecast.windowEndDate) <= 0) {
    phase = 'in-window';
  } else {
    phase = 'after-window';
  }

  return Object.freeze({
    status: 'ok',
    startDate: forecast.openCycleStart,
    centralDate: forecast.centralDate,
    windowStartDate: forecast.windowStartDate,
    windowEndDate: forecast.windowEndDate,
    elapsedDays,
    centralDays,
    remainingDays: toCentral > 0 ? toCentral : 0,
    overdueDays: toCentral < 0 ? -toCentral : 0,
    progressPct: centralDays === 0 ? 100 : clamp(Math.round((elapsedDays / centralDays) * 100), 0, 100),
    phase,
    daysToWindowStart: toWindowStart > 0 ? toWindowStart : 0,
    daysPastWindowEnd: sinceWindowEnd > 0 ? sinceWindowEnd : 0,
  });
}
