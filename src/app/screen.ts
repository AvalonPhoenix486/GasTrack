/**
 * Modelo da tela principal: funcao pura (historico + data de hoje -> textos).
 * Previsao: SOMENTE presentNextChange. Duracao: SOMENTE cycleDuration do dominio.
 */
import { cycleDuration, getClosedCycles, getOpenCycle } from '../core/domain/cycles/index.ts';
import type { CycleHistory } from '../core/domain/cycles/index.ts';
import { presentNextChange } from '../ui/forecast/index.ts';
import type { ForecastView } from '../ui/forecast/index.ts';
import { formatDays, formatLongDate } from '../ui/forecast/format.ts';

export interface HistoryRow {
  readonly id: string;
  /** "YYYY-MM-DD", para preencher a edicao. */
  readonly startDate: string;
  readonly endDate: string;
  readonly startText: string;
  readonly endText: string;
  readonly durationText: string;
}

export interface ForecastUnavailable {
  readonly kind: 'unavailable';
  readonly message: string;
  readonly cause: unknown;
}

export interface OpenCycleInfo {
  readonly id: string;
  readonly startDate: string;
  readonly startText: string;
}

export interface Screen {
  readonly currentText: string;
  readonly openCycle: OpenCycleInfo | null;
  readonly hasOpenCycle: boolean;
  readonly defaultStartDate: string;
  readonly defaultEndDate: string;
  /** Mais recente primeiro. */
  readonly historyRows: readonly HistoryRow[];
  readonly emptyHistoryText: string;
  readonly forecast: ForecastView | ForecastUnavailable;
}

export function buildScreen(history: CycleHistory, today: string): Screen {
  const open = getOpenCycle(history);
  const rows = getClosedCycles(history)
    .map((c): HistoryRow => ({
      id: c.id,
      startDate: c.startDate,
      endDate: c.endDate,
      startText: formatLongDate(c.startDate),
      endText: formatLongDate(c.endDate),
      durationText: formatDays(cycleDuration(c).totalDays),
    }))
    .reverse();

  let forecast: ForecastView | ForecastUnavailable;
  try {
    forecast = presentNextChange(history.cycles);
  } catch (cause) {
    forecast = { kind: 'unavailable', message: 'Não foi possível calcular a previsão.', cause };
  }

  return {
    currentText: open === undefined ? 'Nenhum ciclo em andamento.' : `Em andamento desde ${formatLongDate(open.startDate)}`,
    openCycle: open === undefined ? null : { id: open.id, startDate: open.startDate, startText: formatLongDate(open.startDate) },
    hasOpenCycle: open !== undefined,
    defaultStartDate: today,
    defaultEndDate: today,
    historyRows: rows,
    emptyHistoryText: 'Nenhum ciclo encerrado ainda.',
    forecast,
  };
}
