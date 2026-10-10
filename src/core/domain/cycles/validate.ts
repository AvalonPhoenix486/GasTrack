/**
 * Validacao de ciclos vindos de fora (carregamento, importacao) e de ids.
 */
import { daysBetween, parseDate, InvalidDateRangeError } from '../dates/index.ts';
import { InvalidCycleError } from './errors.ts';
import { makeCycle } from './factory.ts';
import type { Cycle } from './types.ts';

const CYCLE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const CYCLE_KEYS = 'endDate,id,startDate';

/** Id valido: 1 a 64 caracteres entre letras ASCII, digitos, "-" e "_" (cabe um UUID). */
export function isValidCycleId(value: unknown): value is string {
  return typeof value === 'string' && CYCLE_ID.test(value);
}

export function assertCycleId(value: unknown): string {
  if (!isValidCycleId(value)) {
    throw new InvalidCycleError('id deve ter 1 a 64 caracteres entre letras, digitos, "-" e "_"');
  }
  return value;
}

/**
 * Valida um registro desconhecido e devolve um Cycle congelado.
 * Exige exatamente os campos id, startDate e endDate (endDate = null para ciclo aberto);
 * qualquer campo a mais ou a menos e rejeitado. Lanca InvalidCycleError,
 * InvalidDateError ou InvalidDateRangeError.
 */
export function parseCycle(value: unknown): Cycle {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidCycleError('o registro deve ser um objeto');
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new InvalidCycleError('o registro deve ser um objeto simples');
  }
  const keys = Object.keys(value).sort().join(',');
  if (keys !== CYCLE_KEYS) {
    throw new InvalidCycleError('campos esperados: id, startDate, endDate (e mais nenhum)');
  }
  const record = value as { id: unknown; startDate: unknown; endDate: unknown };
  const id = assertCycleId(record.id);
  parseDate(record.startDate);
  if (record.endDate === null) return makeCycle(id, record.startDate as string, null);
  parseDate(record.endDate);
  if (daysBetween(record.startDate as string, record.endDate as string) < 0) {
    throw new InvalidDateRangeError(record.startDate as string, record.endDate as string);
  }
  return makeCycle(id, record.startDate as string, record.endDate as string);
}
