/**
 * Duracao de calendario para apresentacao humana ("meses + dias").
 *
 * O total exato de dias (`totalDays`) e SEMPRE a medida fundamental.
 * "Meses + dias" e so uma representacao humana e so e produzida quando nao e
 * ambigua. Regra completa e tabela de exemplos: ./README.md
 */
import { InvalidDateRangeError } from './errors.ts';
import { daysInMonth, parseDate, toEpochDay } from './calendar.ts';

export interface CalendarDuration {
  /** Total exato de dias (fim - inicio). Medida fundamental. */
  readonly totalDays: number;
  /** Meses de calendario completos. 0 quando `representation` e 'days-only'. */
  readonly months: number;
  /** Dias restantes apos os meses. Em 'days-only' e igual a `totalDays`. */
  readonly days: number;
  /**
   * 'months-days': a UI pode mostrar "N meses e M dias" (alem do total).
   * 'days-only': a UI deve mostrar apenas o total de dias.
   */
  readonly representation: 'months-days' | 'days-only';
}

function daysOnly(totalDays: number): CalendarDuration {
  return { totalDays, months: 0, days: totalDays, representation: 'days-only' };
}

/**
 * Duracao de calendario entre `start` e `end` (inclusive no sentido de
 * diferenca: mesma data = 0 dias). Lanca InvalidDateError se alguma data for
 * invalida e InvalidDateRangeError se `end` < `start`.
 *
 * Regra de "meses + dias" (sem usar "1 mes = 30 dias" e sem ajustar dias
 * inexistentes):
 *  - Um "aniversario mensal" e a mesma data (mesmo dia do mes) em um mes
 *    posterior. Mes completo = aniversario que existe no calendario.
 *  - Inicio nos dias 1-28: o aniversario existe em todo mes. meses = numero
 *    de aniversarios ja alcancados; dias = restante. Se nenhum mes completo,
 *    'days-only'.
 *  - Inicio nos dias 29-31: o dia nao existe em todos os meses, entao a
 *    decomposicao seria enganosa (ex.: 31/01 -> 01/03 virar "1 mes e 1 dia").
 *    So ha 'months-days' quando o fim cai exatamente em um aniversario
 *    (mesmo dia, mes posterior): "N meses e 0 dias". Nos demais casos,
 *    'days-only'.
 */
export function calendarDuration(start: string, end: string): CalendarDuration {
  const s = parseDate(start);
  const e = parseDate(end);
  const totalDays = toEpochDay(e) - toEpochDay(s);
  if (totalDays < 0) throw new InvalidDateRangeError(start, end);

  const monthSpan = (e.year - s.year) * 12 + (e.month - s.month);

  if (s.day > 28) {
    if (monthSpan >= 1 && e.day === s.day) {
      return { totalDays, months: monthSpan, days: 0, representation: 'months-days' };
    }
    return daysOnly(totalDays);
  }

  const months = e.day < s.day ? monthSpan - 1 : monthSpan;
  if (months < 1) return daysOnly(totalDays);

  const index = s.month - 1 + months;
  const anchorYear = s.year + Math.floor(index / 12);
  const anchorMonth = (index % 12) + 1;
  // s.day <= 28, logo o aniversario sempre existe nesse mes.
  if (s.day > daysInMonth(anchorYear, anchorMonth)) throw new Error('invariante violada');
  const anchorDay = toEpochDay({ year: anchorYear, month: anchorMonth, day: s.day });
  return { totalDays, months, days: toEpochDay(e) - anchorDay, representation: 'months-days' };
}
