/**
 * API publica do dominio de datas. A UI/outras camadas importam so daqui.
 * Nao exporta detalhes internos (toEpochDay, fromEpochDay, daysInMonth, isLeapYear).
 */
export { isValidDate, parseDate, formatDate, compareDates, daysBetween, addDays } from './calendar.ts';
export type { CalendarDate } from './calendar.ts';
export { calendarDuration } from './duration.ts';
export type { CalendarDuration } from './duration.ts';
export { InvalidDateError, InvalidDateRangeError, InvalidDayCountError } from './errors.ts';
