/**
 * Datas de calendario puras ("YYYY-MM-DD"), sem horario e sem fuso.
 *
 * Este arquivo NAO usa Date, Intl, relogio nem variaveis de ambiente: toda a
 * aritmetica e feita com inteiros (algoritmo "days from civil", proleptico
 * gregoriano). Por isso o resultado nao pode depender do fuso do processo
 * nem de horario de verao.
 */
import { InvalidDateError } from './errors.ts';

/** Componentes de uma data de calendario. month: 1-12; day: 1-31. */
export interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export const MIN_YEAR = 1;
export const MAX_YEAR = 9999;

const ISO_DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Quantidade de dias do mes (month: 1-12). */
export function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return MONTH_LENGTHS[month - 1] as number;
}

type ParseResult =
  | { readonly ok: true; readonly date: CalendarDate }
  | { readonly ok: false; readonly reason: string };

function check(value: unknown): ParseResult {
  if (typeof value !== 'string') return { ok: false, reason: 'nao e texto' };
  const match = ISO_DATE.exec(value);
  if (match === null) return { ok: false, reason: 'formato diferente de YYYY-MM-DD' };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_YEAR || year > MAX_YEAR) return { ok: false, reason: 'ano fora de 0001-9999' };
  if (month < 1 || month > 12) return { ok: false, reason: 'mes fora de 01-12' };
  if (day < 1 || day > daysInMonth(year, month)) return { ok: false, reason: 'dia inexistente nesse mes' };
  return { ok: true, date: { year, month, day } };
}

/** true se `value` e exatamente uma data real "YYYY-MM-DD" (ano 0001-9999). */
export function isValidDate(value: unknown): value is string {
  return check(value).ok;
}

/** Converte "YYYY-MM-DD" em componentes. Lanca InvalidDateError se invalida. */
export function parseDate(value: unknown): CalendarDate {
  const result = check(value);
  if (!result.ok) throw new InvalidDateError(value, result.reason);
  return result.date;
}

/** Converte componentes em "YYYY-MM-DD". Lanca InvalidDateError se invalidos. */
export function formatDate(date: CalendarDate): string {
  const { year, month, day } = date;
  const text = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const result = check(text);
  if (!result.ok || !Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new InvalidDateError(text, 'componentes invalidos');
  }
  return text;
}

/**
 * Numero de dias desde 1970-01-01 (negativo antes). Inteiro puro, sem Date.
 * Assume componentes ja validos.
 */
export function toEpochDay(date: CalendarDate): number {
  const y = date.month <= 2 ? date.year - 1 : date.year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const shiftedMonth = date.month > 2 ? date.month - 3 : date.month + 9;
  const dayOfYear = Math.floor((153 * shiftedMonth + 2) / 5) + date.day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** -1, 0 ou 1. Lanca InvalidDateError se alguma data for invalida. */
export function compareDates(a: string, b: string): -1 | 0 | 1 {
  const diff = toEpochDay(parseDate(a)) - toEpochDay(parseDate(b));
  return diff < 0 ? -1 : diff > 0 ? 1 : 0;
}

/**
 * Total exato de dias entre duas datas (fim - inicio), com sinal:
 * negativo se `end` e anterior a `start`. Esta e a medida fundamental usada
 * por estatisticas e previsao.
 */
export function daysBetween(start: string, end: string): number {
  return toEpochDay(parseDate(end)) - toEpochDay(parseDate(start));
}
