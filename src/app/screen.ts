/**
 * Modelo das telas: funcao pura (historico + data de hoje -> textos e numeros prontos).
 * Previsao: SOMENTE presentNextChange. Duracoes e estatisticas: SOMENTE o dominio
 * (cycleDuration, calculateStatistics). Aqui so se formata e se organiza para exibir.
 */
import { cycleDuration, getClosedCycles, getOpenCycle } from '../core/domain/cycles/index.ts';
import type { CycleHistory } from '../core/domain/cycles/index.ts';
import { compareDates, parseDate } from '../core/domain/dates/index.ts';
import { calculateStatistics } from '../core/domain/statistics/index.ts';
import { presentNextChange } from '../ui/forecast/index.ts';
import type { ForecastView } from '../ui/forecast/index.ts';
import { formatDays, formatLongDate, formatNumber, formatPercent, monthName } from '../ui/forecast/format.ts';

export interface HistoryRow {
  readonly id: string;
  /** "YYYY-MM-DD", para preencher a edicao. */
  readonly startDate: string;
  readonly endDate: string;
  readonly startText: string;
  readonly endText: string;
  readonly durationText: string;
  /** Dias totais (do dominio), para ordenar. */
  readonly totalDays: number;
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
  /** Dias desde o inicio ate hoje ("49"); null se o inicio e posterior a hoje. */
  readonly daysValue: string | null;
  readonly daysUnit: string;
  /** Explicacao quando `daysValue` e null. */
  readonly note: string | null;
}

export interface StatCard {
  readonly label: string;
  readonly value: string;
}

export interface DurationBar {
  readonly id: string;
  readonly label: string;
  readonly valueText: string;
  /** Largura da barra, 0..100 (relativa ao maior ciclo). */
  readonly widthPct: number;
}

export type StatsView =
  | { readonly kind: 'empty'; readonly message: string }
  | {
      readonly kind: 'ok';
      readonly cards: readonly StatCard[];
      readonly bars: readonly DurationBar[];
      /** Posicao da mediana no grafico, 0..100. */
      readonly medianPct: number;
      readonly medianLabel: string;
      readonly basisLine: string;
      /** Aviso quando ainda nao ha ciclos para a previsao (vem da previsao, nao e fixo). */
      readonly caution: string | null;
    };

export interface Screen {
  readonly today: string;
  readonly currentText: string;
  readonly openCycle: OpenCycleInfo | null;
  readonly hasOpenCycle: boolean;
  readonly defaultStartDate: string;
  readonly defaultEndDate: string;
  /** Ciclos fechados, mais recente primeiro. */
  readonly historyRows: readonly HistoryRow[];
  readonly closedCount: number;
  readonly emptyHistoryText: string;
  readonly forecast: ForecastView | ForecastUnavailable;
  readonly stats: StatsView;
}

export type HistorySort = 'recent' | 'oldest' | 'longest' | 'shortest';

export const SORT_LABELS: Readonly<Record<HistorySort, string>> = {
  recent: 'Mais recentes',
  oldest: 'Mais antigos',
  longest: 'Mais longos',
  shortest: 'Mais curtos',
};

/** Ordena sem alterar a lista recebida. Base: `historyRows` ja vem do mais recente ao mais antigo. */
export function sortRows(rows: readonly HistoryRow[], sort: HistorySort): readonly HistoryRow[] {
  const copy = [...rows];
  if (sort === 'recent') return copy;
  if (sort === 'oldest') return copy.reverse();
  // empate: o mais recente primeiro (ordem original, pois o sort e estavel)
  return copy.sort((a, b) => (sort === 'longest' ? b.totalDays - a.totalDays : a.totalDays - b.totalDays));
}

/** "5 abr" a partir de "YYYY-MM-DD" (rotulo curto para o grafico). */
export function shortDateLabel(iso: string): string {
  const d = parseDate(iso);
  return `${d.day} ${monthName(d.month).slice(0, 3)}`;
}

function openInfo(id: string, startDate: string, today: string): OpenCycleInfo {
  const base = { id, startDate, startText: formatLongDate(startDate), daysUnit: 'dias' };
  if (compareDates(startDate, today) > 0) {
    return { ...base, daysValue: null, note: 'O início está em uma data futura.' };
  }
  const days = cycleDuration({ id, startDate, endDate: null }, today).totalDays;
  return { ...base, daysValue: String(days), daysUnit: days === 1 ? 'dia' : 'dias', note: null };
}

function buildStats(history: CycleHistory, forecast: ForecastView | ForecastUnavailable): StatsView {
  const s = calculateStatistics(history.cycles);
  if (!s.hasData) {
    return { kind: 'empty', message: 'As estatísticas aparecem depois que você encerrar o primeiro ciclo.' };
  }
  const closed = getClosedCycles(history);
  const durations = closed.map((c) => ({ id: c.id, start: c.startDate, days: cycleDuration(c).totalDays }));
  const scaleMax = Math.max(...durations.map((d) => d.days), s.median, 1);
  const cards: StatCard[] = [
    { label: 'Mediana', value: formatDays(s.median) },
    { label: 'Média', value: formatDays(s.mean) },
    { label: 'Mais curto', value: formatDays(s.min) },
    { label: 'Mais longo', value: formatDays(s.max) },
    { label: 'Amplitude', value: formatDays(s.range) },
    { label: 'Variação típica (MAD)', value: formatDays(s.mad) },
  ];
  if (s.relativeMad !== null) cards.push({ label: 'Variação relativa', value: formatPercent(s.relativeMad) });
  return {
    kind: 'ok',
    cards,
    bars: durations.map((d) => ({
      id: d.id,
      label: shortDateLabel(d.start),
      valueText: formatDays(d.days),
      widthPct: Math.round((d.days / scaleMax) * 100),
    })),
    medianPct: Math.round((s.median / scaleMax) * 100),
    medianLabel: `Mediana: ${formatNumber(s.median)} d`,
    basisLine: `Baseado em ${s.count} ${s.count === 1 ? 'ciclo fechado' : 'ciclos fechados'}`,
    caution: forecast.kind === 'insufficient-data'
      ? `A previsão ainda não é feita: ${forecast.historyLine.toLowerCase()}; ${forecast.requiredLine.toLowerCase()}.`
      : null,
  };
}

export function buildScreen(history: CycleHistory, today: string): Screen {
  const open = getOpenCycle(history);
  const rows = getClosedCycles(history)
    .map((c): HistoryRow => {
      const totalDays = cycleDuration(c).totalDays;
      return {
        id: c.id,
        startDate: c.startDate,
        endDate: c.endDate,
        startText: formatLongDate(c.startDate),
        endText: formatLongDate(c.endDate),
        durationText: formatDays(totalDays),
        totalDays,
      };
    })
    .reverse();

  let forecast: ForecastView | ForecastUnavailable;
  try {
    forecast = presentNextChange(history.cycles);
  } catch (cause) {
    forecast = { kind: 'unavailable', message: 'Não foi possível calcular a previsão.', cause };
  }

  return {
    today,
    currentText: open === undefined ? 'Nenhum ciclo em andamento.' : `Em andamento desde ${formatLongDate(open.startDate)}`,
    openCycle: open === undefined ? null : openInfo(open.id, open.startDate, today),
    hasOpenCycle: open !== undefined,
    defaultStartDate: today,
    defaultEndDate: today,
    historyRows: rows,
    closedCount: rows.length,
    emptyHistoryText: 'Nenhum ciclo encerrado ainda.',
    forecast,
    stats: buildStats(history, forecast),
  };
}
