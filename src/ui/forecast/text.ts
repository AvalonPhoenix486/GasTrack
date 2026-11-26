/**
 * Textos da apresentacao da previsao por idioma. Tabelas puras: sem Intl, sem Date.
 * Para adicionar um idioma: ver src/ui/locale.ts. O TypeScript exige que a tabela
 * tenha todos os campos e o teste de completude (locale.test.ts) confere as chaves.
 */
import { DEFAULT_LOCALE } from '../locale.ts';
import type { Locale } from '../locale.ts';

export interface ForecastText {
  readonly months: readonly string[];
  readonly monthsShort: readonly string[];
  readonly decimalSeparator: string;
  /** "15 de dezembro de 2026" */
  longDate(day: number, month: string, year: number): string;
  /** Mesmo mes e ano: "14 a 16 de dezembro". */
  sameMonth(dayA: number, dayB: number, month: string): string;
  /** Data curta com ano: "1 nov 2025" / "Nov 1, 2025". */
  shortDate(day: number, monthShort: string, year: number): string;
  /** Meses diferentes no mesmo ano. */
  sameYear(dayA: number, monthA: string, dayB: number, monthB: string): string;
  /** Anos diferentes (anos nos dois lados). */
  crossYear(a: string, b: string): string;
  /** Data unica (inicio = fim, sem ano). */
  singleDay(day: number, month: string): string;
  day: string;
  days: string;
  cycle: string;
  cycles: string;
  closedCycle: string;
  closedCycles: string;
  title: string;
  titleOk: string;
  insufficientMessage: string;
  noOpenMessage: string;
  history(cycles: string): string;
  required(cycles: string): string;
  basis(closedCycles: string): string;
  window(range: string): string;
  floorApplied(minimum: string): string;
  typicalVariation(days: string): string;
  detailsTitle: string;
  labels: {
    readonly median: string;
    readonly mad: string;
    readonly halfWidth: string;
    readonly relative: string;
    readonly shortest: string;
    readonly longest: string;
    readonly range: string;
  };
  relativeUnavailable: string;
}

const ptBR: ForecastText = {
  months: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  monthsShort: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  decimalSeparator: ',',
  shortDate: (d, m, y) => `${d} ${m} ${y}`,
  longDate: (d, m, y) => `${d === 1 ? '1º' : String(d)} de ${m} de ${y}`,
  sameMonth: (a, b, m) => `${a === 1 ? '1º' : String(a)} a ${b === 1 ? '1º' : String(b)} de ${m}`,
  sameYear: (a, ma, b, mb) => `${a === 1 ? '1º' : String(a)} de ${ma} a ${b === 1 ? '1º' : String(b)} de ${mb}`,
  crossYear: (a, b) => `${a} a ${b}`,
  singleDay: (d, m) => `${d === 1 ? '1º' : String(d)} de ${m}`,
  day: 'dia',
  days: 'dias',
  cycle: 'ciclo',
  cycles: 'ciclos',
  closedCycle: 'ciclo fechado',
  closedCycles: 'ciclos fechados',
  title: 'Próxima mudança',
  titleOk: 'Próxima mudança estimada',
  insufficientMessage: 'Ainda não há histórico suficiente para estimar a próxima mudança.',
  noOpenMessage: 'Há histórico suficiente para fazer a estimativa, mas não existe um ciclo em andamento para aplicar a previsão.',
  history: (c) => `Histórico: ${c}`,
  required: (c) => `Necessário: ${c}`,
  basis: (c) => `Baseado em ${c}`,
  window: (r) => `Janela estimada: ${r}`,
  floorApplied: (min) => `A variabilidade observada foi inferior a ${min}. Por isso, foi aplicada a largura mínima de ${min} à janela estimada.`,
  typicalVariation: (d) => `Variação típica: cerca de ${d}.`,
  detailsTitle: 'Detalhes técnicos',
  labels: {
    median: 'Mediana',
    mad: 'MAD (desvio absoluto mediano)',
    halfWidth: 'Meia-largura da janela',
    relative: 'Variabilidade relativa',
    shortest: 'Menor ciclo',
    longest: 'Maior ciclo',
    range: 'Amplitude',
  },
  relativeUnavailable: 'indisponível (mediana 0)',
};

const en: ForecastText = {
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  decimalSeparator: '.',
  shortDate: (d, m, y) => `${m} ${d}, ${y}`,
  longDate: (d, m, y) => `${m} ${d}, ${y}`,
  sameMonth: (a, b, m) => `${m} ${a}–${b}`,
  sameYear: (a, ma, b, mb) => `${ma} ${a} – ${mb} ${b}`,
  crossYear: (a, b) => `${a} – ${b}`,
  singleDay: (d, m) => `${m} ${d}`,
  day: 'day',
  days: 'days',
  cycle: 'cycle',
  cycles: 'cycles',
  closedCycle: 'closed cycle',
  closedCycles: 'closed cycles',
  title: 'Next change',
  titleOk: 'Estimated next change',
  insufficientMessage: 'There is not enough history yet to estimate the next change.',
  noOpenMessage: 'There is enough history to make an estimate, but no cycle is in progress to apply the forecast to.',
  history: (c) => `History: ${c}`,
  required: (c) => `Required: ${c}`,
  basis: (c) => `Based on ${c}`,
  window: (r) => `Estimated window: ${r}`,
  floorApplied: (min) => `The observed variability was below ${min}. For that reason, the minimum width of ${min} was applied to the estimated window.`,
  typicalVariation: (d) => `Typical variation: about ${d}.`,
  detailsTitle: 'Technical details',
  labels: {
    median: 'Median',
    mad: 'MAD (median absolute deviation)',
    halfWidth: 'Window half-width',
    relative: 'Relative variability',
    shortest: 'Shortest cycle',
    longest: 'Longest cycle',
    range: 'Range',
  },
  relativeUnavailable: 'unavailable (median is 0)',
};

const TEXTS: Readonly<Record<Locale, ForecastText>> = { 'pt-BR': ptBR, en };

/** Tabela do idioma; valor desconhecido cai em pt-BR. */
export function forecastText(locale: Locale): ForecastText {
  return TEXTS[locale] ?? TEXTS[DEFAULT_LOCALE];
}
