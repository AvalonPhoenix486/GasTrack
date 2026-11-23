/**
 * Formatacao de textos em portugues do Brasil, sem `Date` nem `Intl`.
 * Datas: so lemos os componentes (ano, mes, dia) de uma data "YYYY-MM-DD" ja
 * produzida pelo dominio, por `parseDate`; nunca se calcula nem se desloca data.
 */
import { parseDate } from '../../core/domain/dates/index.ts';
import type { CalendarDate } from '../../core/domain/dates/index.ts';

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

export function monthName(month: number): string {
  return MONTHS[month - 1] as string;
}

/** Dia do mes: o primeiro dia e escrito "1º"; os demais, em algarismos. */
export function dayLabel(day: number): string {
  return day === 1 ? '1º' : String(day);
}

/** "15 de dezembro de 2026" */
export function formatLongDate(iso: string): string {
  const d = parseDate(iso);
  return `${dayLabel(d.day)} de ${monthName(d.month)} de ${d.year}`;
}

/**
 * Janela de datas:
 *  - mesmo mes e ano: "14 a 16 de dezembro";
 *  - meses diferentes no mesmo ano: "30 de janeiro a 2 de fevereiro";
 *  - anos diferentes: "30 de dezembro de 2026 a 1º de janeiro de 2027" (anos nos dois lados);
 *  - inicio e fim iguais: uma data so.
 */
export function formatDateWindow(startIso: string, endIso: string): string {
  const a: CalendarDate = parseDate(startIso);
  const b: CalendarDate = parseDate(endIso);
  if (a.year !== b.year) {
    return `${dayLabel(a.day)} de ${monthName(a.month)} de ${a.year} a ${dayLabel(b.day)} de ${monthName(b.month)} de ${b.year}`;
  }
  if (a.month !== b.month) {
    return `${dayLabel(a.day)} de ${monthName(a.month)} a ${dayLabel(b.day)} de ${monthName(b.month)}`;
  }
  if (a.day === b.day) return `${dayLabel(a.day)} de ${monthName(a.month)}`;
  return `${dayLabel(a.day)} a ${dayLabel(b.day)} de ${monthName(a.month)}`;
}

/** Numero em pt-BR com virgula decimal ("28,5"); inteiros sem casas. */
export function formatNumber(value: number): string {
  return String(value).replace('.', ',');
}

/** "0 dias", "1 dia", "1,5 dias", "2 dias", "28,5 dias" (singular somente quando o valor e exatamente 1). */
export function formatDays(value: number): string {
  return `${formatNumber(value)} ${value === 1 ? 'dia' : 'dias'}`;
}

/** "1 ciclo", "3 ciclos" */
export function formatCycles(count: number): string {
  return `${count} ${count === 1 ? 'ciclo' : 'ciclos'}`;
}

/** "1 ciclo fechado", "8 ciclos fechados" */
export function formatClosedCycles(count: number): string {
  return `${count} ${count === 1 ? 'ciclo fechado' : 'ciclos fechados'}`;
}

/** Razao como porcentagem de exibicao, no maximo 1 casa decimal: 0.05 -> "5%", 0.0175 -> "1,8%". */
export function formatPercent(ratio: number): string {
  return `${formatNumber(Math.round(ratio * 1000) / 10)}%`;
}
