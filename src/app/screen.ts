/**
 * Modelo das telas: funcao pura (historico + data de hoje + idioma -> textos e numeros prontos).
 * Previsao: SOMENTE presentNextChange / buildTimeline (camada ui). Duracoes e estatisticas:
 * SOMENTE o dominio (cycleDuration, calculateStatistics). Aqui so se formata e se organiza para exibir.
 */
import { cycleDuration, getClosedCycles, getOpenCycle } from '../core/domain/cycles/index.ts';
import type { CycleHistory } from '../core/domain/cycles/index.ts';
import { compareDates, parseDate } from '../core/domain/dates/index.ts';
import { calculateStatistics } from '../core/domain/statistics/index.ts';
import { presentNextChange } from '../ui/forecast/index.ts';
import type { ForecastView } from '../ui/forecast/index.ts';
import { formatDateWindow, formatDays, formatLongDate, formatNumber, formatPercent, formatShortDate, monthShort } from '../ui/forecast/format.ts';
import { buildTimeline } from '../ui/timeline/index.ts';
import type { Timeline, TimelineOk } from '../ui/timeline/index.ts';
import { messagesFor } from './i18n/index.ts';
import type { Locale, Messages } from './i18n/index.ts';

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
  /** Ano do inicio ("2026"), para o filtro por periodo. */
  readonly year: string;
  /** "1 mês e 5 dias" quando o dominio tem uma decomposicao nao ambigua; senao null. */
  readonly calendarText: string | null;
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
      /** Informacoes sobre os registros (contagens e datas do historico). */
      readonly records: readonly StatCard[];
    };

/** Progresso do ciclo em andamento ate a data central ESTIMADA. */
export interface ProgressView {
  readonly pct: number;
  readonly startText: string;
  readonly endText: string;
}

/** Linha "Proxima troca" da tela inicial. */
export interface NextRow {
  readonly kind: 'ok' | 'insufficient-data' | 'no-open-cycle' | 'unavailable';
  readonly title: string;
  readonly subtitle: string;
}

export interface AlertView {
  readonly tone: 'attention';
  readonly title: string;
  readonly text: string;
}

export interface Kpi {
  readonly id: 'closed' | 'median' | 'mean';
  readonly label: string;
  readonly value: string;
}

/** Cartao principal e detalhes da aba Previsao (alem do `forecast` textual). */
export interface ForecastPage {
  /** 'attention' quando a janela esta proxima, em andamento ou ja passou; senao 'neutral'. */
  readonly tone: 'neutral' | 'attention';
  readonly hero: { readonly big: string; readonly approx: string } | null;
  readonly progress: ProgressView | null;
  /** Ciclos fechados vs. minimo exigido (quando ainda nao ha previsao de data). */
  readonly collecting: { readonly pct: number; readonly text: string } | null;
  readonly rows: readonly StatCard[];
}

export interface Screen {
  readonly locale: Locale;
  readonly today: string;
  readonly currentText: string;
  readonly openCycle: OpenCycleInfo | null;
  readonly hasOpenCycle: boolean;
  readonly defaultStartDate: string;
  readonly defaultEndDate: string;
  /** Ciclos fechados, mais recente primeiro. */
  readonly historyRows: readonly HistoryRow[];
  readonly closedCount: number;
  /** Anos (do inicio) presentes no historico, do mais recente ao mais antigo. */
  readonly years: readonly string[];
  readonly emptyHistoryText: string;
  readonly forecast: ForecastView | ForecastUnavailable;
  readonly stats: StatsView;
  readonly progress: ProgressView | null;
  readonly next: NextRow;
  readonly alert: AlertView | null;
  readonly kpis: readonly Kpi[];
  readonly forecastPage: ForecastPage;
  readonly totalCycles: number;
}

export interface ScreenOptions {
  readonly locale?: Locale;
  /** Aviso dentro do app habilitado? (padrao: sim) */
  readonly reminderEnabled?: boolean;
  /** Antecedencia do aviso, em dias (padrao: 2). */
  readonly noticeDays?: number;
}

export type HistorySort = 'recent' | 'oldest' | 'longest' | 'shortest';

/** Rotulos em pt-BR (compatibilidade); a tela usa `messages.history.sort` no idioma escolhido. */
export const SORT_LABELS: Readonly<Record<HistorySort, string>> = messagesFor('pt-BR').history.sort;

/** Ordena sem alterar a lista recebida. Base: `historyRows` ja vem do mais recente ao mais antigo. */
export function sortRows(rows: readonly HistoryRow[], sort: HistorySort): readonly HistoryRow[] {
  const copy = [...rows];
  if (sort === 'recent') return copy;
  if (sort === 'oldest') return copy.reverse();
  // empate: o mais recente primeiro (ordem original, pois o sort e estavel)
  return copy.sort((a, b) => (sort === 'longest' ? b.totalDays - a.totalDays : a.totalDays - b.totalDays));
}

/** Filtra por ano do inicio; 'all' devolve tudo. Nao altera a lista recebida. */
export function filterRows(rows: readonly HistoryRow[], year: string): readonly HistoryRow[] {
  return year === 'all' ? [...rows] : rows.filter((r) => r.year === year);
}

/** "5 abr" a partir de "YYYY-MM-DD" (rotulo curto para o grafico). */
export function shortDateLabel(iso: string, locale: Locale = 'pt-BR'): string {
  const d = parseDate(iso);
  return locale === 'en' ? `${monthShort(d.month, locale)} ${d.day}` : `${d.day} ${monthShort(d.month, locale)}`;
}

function openInfo(id: string, startDate: string, today: string, locale: Locale, m: Messages): OpenCycleInfo {
  const base = { id, startDate, startText: formatLongDate(startDate, locale) };
  if (compareDates(startDate, today) > 0) {
    return { ...base, daysUnit: m.common.days, daysValue: null, note: m.home.futureStart };
  }
  const days = cycleDuration({ id, startDate, endDate: null }, today).totalDays;
  return { ...base, daysValue: String(days), daysUnit: days === 1 ? m.common.day : m.common.days, note: null };
}

function buildStats(history: CycleHistory, forecast: ForecastView | ForecastUnavailable, locale: Locale, m: Messages): StatsView {
  const s = calculateStatistics(history.cycles);
  if (!s.hasData) return { kind: 'empty', message: m.stats.empty };
  const closed = getClosedCycles(history);
  const d = (n: number) => formatDays(n, locale);
  const durations = closed.map((c) => ({ id: c.id, start: c.startDate, days: cycleDuration(c).totalDays }));
  const scaleMax = Math.max(...durations.map((x) => x.days), s.median, 1);
  const cards: StatCard[] = [
    { label: m.stats.median, value: d(s.median) },
    { label: m.stats.mean, value: d(s.mean) },
    { label: m.stats.shortest, value: d(s.min) },
    { label: m.stats.longest, value: d(s.max) },
    { label: m.stats.range, value: d(s.range) },
    { label: m.stats.mad, value: d(s.mad) },
  ];
  if (s.relativeMad !== null) cards.push({ label: m.stats.relative, value: formatPercent(s.relativeMad, locale) });

  const open = getOpenCycle(history);
  const lastEnd = closed.length === 0 ? null : (closed[closed.length - 1]?.endDate ?? null);
  const first = history.cycles.length === 0 ? null : history.cycles.reduce((a, c) => (compareDates(c.startDate, a) < 0 ? c.startDate : a), history.cycles[0]?.startDate ?? '');
  const records: StatCard[] = [
    { label: m.stats.recordsTotal, value: String(history.cycles.length) },
    { label: m.stats.recordsOpen, value: open === undefined ? m.stats.no : m.stats.yes },
  ];
  if (first !== null && first !== '') records.push({ label: m.stats.recordsFirst, value: formatLongDate(first, locale) });
  if (lastEnd !== null) records.push({ label: m.stats.recordsLast, value: formatLongDate(lastEnd, locale) });

  return {
    kind: 'ok',
    cards,
    bars: durations.map((x) => ({
      id: x.id,
      label: shortDateLabel(x.start, locale),
      valueText: d(x.days),
      widthPct: Math.round((x.days / scaleMax) * 100),
    })),
    medianPct: Math.round((s.median / scaleMax) * 100),
    medianLabel: m.stats.medianLegend(formatNumber(s.median, locale)),
    basisLine: m.stats.basis(s.count),
    caution: forecast.kind === 'insufficient-data'
      ? `${m.stats.cautionIntro}: ${forecast.historyLine.toLowerCase()}; ${forecast.requiredLine.toLowerCase()}.`
      : null,
    records,
  };
}

function progressOf(t: TimelineOk, locale: Locale): ProgressView {
  return { pct: t.progressPct, startText: formatShortDate(t.startDate, locale), endText: formatShortDate(t.centralDate, locale) };
}

function nextRowFor(t: Timeline | null, forecast: ForecastView | ForecastUnavailable, locale: Locale, m: Messages): NextRow {
  if (t !== null && t.status === 'ok') {
    const days = (n: number) => formatDays(n, locale);
    const subtitle = m.home.nextCentral(formatLongDate(t.centralDate, locale));
    if (t.phase === 'after-window') return { kind: 'ok', title: m.home.nextAfter(days(t.daysPastWindowEnd)), subtitle };
    if (t.phase === 'in-window') return { kind: 'ok', title: t.remainingDays === 0 && t.overdueDays === 0 ? m.home.nextToday : m.home.nextInWindow, subtitle };
    return { kind: 'ok', title: m.home.nextIn(days(t.remainingDays)), subtitle };
  }
  if (forecast.kind === 'insufficient-data') return { kind: 'insufficient-data', title: m.home.nextUnavailable, subtitle: `${forecast.historyLine} · ${forecast.requiredLine}` };
  if (forecast.kind === 'no-open-cycle') return { kind: 'no-open-cycle', title: m.home.nextNoCycle, subtitle: forecast.basisLine };
  return { kind: 'unavailable', title: m.home.nextUnavailable, subtitle: forecast.kind === 'unavailable' ? forecast.message : '' };
}

function alertFor(t: Timeline | null, options: Required<ScreenOptions>, m: Messages): AlertView | null {
  if (!options.reminderEnabled || t === null || t.status !== 'ok') return null;
  const days = (n: number) => formatDays(n, options.locale);
  switch (t.phase) {
    case 'approaching': return { tone: 'attention', title: m.home.alertTitle, text: m.home.alertApproaching(days(t.daysToWindowStart)) };
    case 'in-window': return { tone: 'attention', title: m.home.alertTitle, text: m.home.alertInWindow };
    case 'after-window': return { tone: 'attention', title: m.home.alertTitle, text: m.home.alertAfter(days(t.daysPastWindowEnd)) };
    case 'before': return null;
  }
}

function forecastPageFor(t: Timeline | null, forecast: ForecastView | ForecastUnavailable, locale: Locale, m: Messages): ForecastPage {
  if (t !== null && t.status === 'ok' && forecast.kind === 'ok') {
    const days = (n: number) => formatDays(n, locale);
    let big: string;
    if (t.phase === 'after-window') big = m.forecast.heroAfter(days(t.daysPastWindowEnd));
    else if (t.phase === 'in-window') big = t.remainingDays === 0 && t.overdueDays === 0 ? m.forecast.heroToday : m.forecast.heroInWindow;
    else big = m.forecast.heroIn(days(t.remainingDays));
    return {
      tone: t.phase === 'before' ? 'neutral' : 'attention',
      hero: { big, approx: m.forecast.heroApprox(formatLongDate(t.centralDate, locale)) },
      progress: progressOf(t, locale),
      collecting: null,
      rows: [
        { label: m.forecast.centralDate, value: formatLongDate(t.centralDate, locale) },
        { label: m.forecast.windowDates, value: formatDateWindow(t.windowStartDate, t.windowEndDate, locale) },
        { label: m.forecast.estimatedDuration, value: days(t.centralDays) },
        { label: m.forecast.basedOn, value: forecast.basisLine },
      ],
    };
  }
  if (t !== null && t.status === 'none' && t.reason === 'insufficient-data') {
    const pct = t.requiredCount === 0 ? 100 : Math.round((t.closedCount / t.requiredCount) * 100);
    return { tone: 'neutral', hero: null, progress: null, collecting: { pct, text: m.forecast.collecting(t.closedCount, t.requiredCount) }, rows: [] };
  }
  return { tone: 'neutral', hero: null, progress: null, collecting: null, rows: [] };
}

export function buildScreen(history: CycleHistory, today: string, opts: ScreenOptions = {}): Screen {
  const options: Required<ScreenOptions> = {
    locale: opts.locale ?? 'pt-BR',
    reminderEnabled: opts.reminderEnabled ?? true,
    noticeDays: opts.noticeDays ?? 2,
  };
  const { locale } = options;
  const m = messagesFor(locale);
  const open = getOpenCycle(history);
  const rows = getClosedCycles(history)
    .map((c): HistoryRow => {
      const duration = cycleDuration(c);
      return {
        id: c.id,
        startDate: c.startDate,
        endDate: c.endDate,
        startText: formatLongDate(c.startDate, locale),
        endText: formatLongDate(c.endDate, locale),
        durationText: formatDays(duration.totalDays, locale),
        totalDays: duration.totalDays,
        year: String(parseDate(c.startDate).year),
        calendarText: duration.representation === 'months-days' ? m.history.monthsDays(duration.months, duration.days) : null,
      };
    })
    .reverse();
  const years = [...new Set(rows.map((r) => r.year))].sort().reverse();

  let forecast: ForecastView | ForecastUnavailable;
  let timeline: Timeline | null = null;
  try {
    forecast = presentNextChange(history.cycles, locale);
    timeline = buildTimeline(history.cycles, today, options.noticeDays);
  } catch (cause) {
    forecast = { kind: 'unavailable', message: locale === 'en' ? 'Could not calculate the forecast.' : 'Não foi possível calcular a previsão.', cause };
    timeline = null;
  }

  const stats = buildStats(history, forecast, locale, m);
  const kpis: Kpi[] = [
    { id: 'closed', label: m.home.kpiClosed, value: String(rows.length) },
    { id: 'median', label: m.home.kpiMedian, value: stats.kind === 'ok' ? (stats.cards[0]?.value ?? '—') : '—' },
    { id: 'mean', label: m.home.kpiMean, value: stats.kind === 'ok' ? (stats.cards[1]?.value ?? '—') : '—' },
  ];

  return {
    locale,
    today,
    currentText: open === undefined ? m.home.noneText : m.home.sinceText(formatLongDate(open.startDate, locale)),
    openCycle: open === undefined ? null : openInfo(open.id, open.startDate, today, locale, m),
    hasOpenCycle: open !== undefined,
    defaultStartDate: today,
    defaultEndDate: today,
    historyRows: rows,
    closedCount: rows.length,
    years,
    emptyHistoryText: m.history.empty,
    forecast,
    stats,
    progress: timeline !== null && timeline.status === 'ok' ? progressOf(timeline, locale) : null,
    next: nextRowFor(timeline, forecast, locale, m),
    alert: alertFor(timeline, options, m),
    kpis,
    forecastPage: forecastPageFor(timeline, forecast, locale, m),
    totalCycles: history.cycles.length,
  };
}
