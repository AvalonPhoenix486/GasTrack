/**
 * Formatacao de textos por idioma (padrao: portugues do Brasil), sem `Date` nem `Intl`.
 * Datas: so lemos os componentes (ano, mes, dia) de uma data "YYYY-MM-DD" ja
 * produzida pelo dominio, por `parseDate`; nunca se calcula nem se desloca data.
 * Todas as funcoes aceitam `locale` por ultimo; sem ele, pt-BR (comportamento original).
 */
import { parseDate } from '../../core/domain/dates/index.ts';
import { DEFAULT_LOCALE } from '../locale.ts';
import type { Locale } from '../locale.ts';
import { forecastText } from './text.ts';

export function monthName(month: number, locale: Locale = DEFAULT_LOCALE): string {
  return forecastText(locale).months[month - 1] as string;
}

/** Dia do mes: em pt-BR o primeiro dia e escrito "1º"; os demais, em algarismos. */
export function dayLabel(day: number, locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'pt-BR' && day === 1 ? '1º' : String(day);
}

/** "nov" / "Nov" */
export function monthShort(month: number, locale: Locale = DEFAULT_LOCALE): string {
  return forecastText(locale).monthsShort[month - 1] as string;
}

/** "1 nov 2025" / "Nov 1, 2025" */
export function formatShortDate(iso: string, locale: Locale = DEFAULT_LOCALE): string {
  const d = parseDate(iso);
  return forecastText(locale).shortDate(d.day, monthShort(d.month, locale), d.year);
}

/** "15 de dezembro de 2026" / "December 15, 2026" */
export function formatLongDate(iso: string, locale: Locale = DEFAULT_LOCALE): string {
  const d = parseDate(iso);
  return forecastText(locale).longDate(d.day, monthName(d.month, locale), d.year);
}

/**
 * Janela de datas:
 *  - mesmo mes e ano: "14 a 16 de dezembro";
 *  - meses diferentes no mesmo ano: "30 de janeiro a 2 de fevereiro";
 *  - anos diferentes: "30 de dezembro de 2026 a 1º de janeiro de 2027" (anos nos dois lados);
 *  - inicio e fim iguais: uma data so.
 */
export function formatDateWindow(startIso: string, endIso: string, locale: Locale = DEFAULT_LOCALE): string {
  const a = parseDate(startIso);
  const b = parseDate(endIso);
  const t = forecastText(locale);
  if (a.year !== b.year) return t.crossYear(formatLongDate(startIso, locale), formatLongDate(endIso, locale));
  if (a.month !== b.month) return t.sameYear(a.day, monthName(a.month, locale), b.day, monthName(b.month, locale));
  if (a.day === b.day) return t.singleDay(a.day, monthName(a.month, locale));
  return t.sameMonth(a.day, b.day, monthName(a.month, locale));
}

/** Numero com o separador decimal do idioma ("28,5" / "28.5"); inteiros sem casas. */
export function formatNumber(value: number, locale: Locale = DEFAULT_LOCALE): string {
  return String(value).replace('.', forecastText(locale).decimalSeparator);
}

/** "0 dias", "1 dia", "1,5 dias", "28,5 dias" (singular somente quando o valor e exatamente 1). */
export function formatDays(value: number, locale: Locale = DEFAULT_LOCALE): string {
  const t = forecastText(locale);
  return `${formatNumber(value, locale)} ${value === 1 ? t.day : t.days}`;
}

/** "1 ciclo", "3 ciclos" */
export function formatCycles(count: number, locale: Locale = DEFAULT_LOCALE): string {
  const t = forecastText(locale);
  return `${count} ${count === 1 ? t.cycle : t.cycles}`;
}

/** "1 ciclo fechado", "8 ciclos fechados" */
export function formatClosedCycles(count: number, locale: Locale = DEFAULT_LOCALE): string {
  const t = forecastText(locale);
  return `${count} ${count === 1 ? t.closedCycle : t.closedCycles}`;
}

/** Razao como porcentagem de exibicao, no maximo 1 casa decimal: 0.05 -> "5%", 0.0175 -> "1,8%". */
export function formatPercent(ratio: number, locale: Locale = DEFAULT_LOCALE): string {
  return `${formatNumber(Math.round(ratio * 1000) / 10, locale)}%`;
}
