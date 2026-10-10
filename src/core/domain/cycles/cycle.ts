/**
 * Operacoes sobre UM ciclo. Funcoes puras: nunca alteram o ciclo recebido,
 * devolvem um novo ciclo congelado. Nao leem o relogio.
 */
import { calendarDuration, daysBetween, parseDate, InvalidDateRangeError } from '../dates/index.ts';
import type { CalendarDuration } from '../dates/index.ts';
import { CycleStateError, InvalidCycleError, MissingReferenceDateError } from './errors.ts';
import { makeCycle } from './factory.ts';
import { assertCycleId } from './validate.ts';
import type { ClosedCycle, Cycle, CycleChanges, CycleStatus, NewCycle, OpenCycle } from './types.ts';

export function isOpen(cycle: Cycle): cycle is OpenCycle {
  return cycle.endDate === null;
}

export function isClosed(cycle: Cycle): cycle is ClosedCycle {
  return cycle.endDate !== null;
}

export function cycleStatus(cycle: Cycle): CycleStatus {
  return cycle.endDate === null ? 'open' : 'closed';
}

/**
 * Cria um ciclo ABERTO. O id e fornecido por quem chama (o dominio nao gera ids
 * nem le o relogio). Lanca InvalidCycleError (id) ou InvalidDateError (data).
 */
export function createCycle(input: NewCycle): OpenCycle {
  const id = assertCycleId(input.id);
  parseDate(input.startDate);
  return makeCycle(id, input.startDate, null) as OpenCycle;
}

/**
 * Fecha um ciclo aberto com a data de fim. NAO cria outro ciclo.
 * Lanca CycleStateError (ja fechado), InvalidDateError (data invalida) ou
 * InvalidDateRangeError (fim antes do inicio). Fim = inicio e permitido (0 dias).
 */
export function closeCycle(cycle: OpenCycle, endDate: string): ClosedCycle {
  if (cycle.endDate !== null) {
    throw new CycleStateError(`o ciclo ${cycle.id} ja esta fechado`);
  }
  parseDate(endDate);
  if (daysBetween(cycle.startDate, endDate) < 0) {
    throw new InvalidDateRangeError(cycle.startDate, endDate);
  }
  return makeCycle(cycle.id, cycle.startDate, endDate) as ClosedCycle;
}

/**
 * Reabre um ciclo fechado (PD-002): mesmo id e mesmo inicio, sem data de fim.
 * Lanca CycleStateError se o ciclo ja estiver aberto. A verificacao de
 * sobreposicao/segundo ciclo aberto e feita por reopenInHistory.
 */
export function reopenCycle(cycle: ClosedCycle): OpenCycle {
  if (cycle.endDate === null) {
    throw new CycleStateError(`o ciclo ${cycle.id} ja esta aberto`);
  }
  return makeCycle(cycle.id, cycle.startDate, null) as OpenCycle;
}

/**
 * Duracao do ciclo, exatamente a do dominio de datas (calendarDuration):
 *  - ciclo fechado: de startDate a endDate; `referenceDate` e ignorada;
 *  - ciclo aberto: de startDate ate `referenceDate`, que o CHAMADOR informa
 *    (o dominio nunca consulta o relogio). Sem ela, lanca MissingReferenceDateError;
 *    anterior ao inicio, lanca InvalidDateRangeError.
 */
export function cycleDuration(cycle: ClosedCycle): CalendarDuration;
export function cycleDuration(cycle: OpenCycle, referenceDate: string): CalendarDuration;
export function cycleDuration(cycle: Cycle, referenceDate?: string): CalendarDuration;
export function cycleDuration(cycle: Cycle, referenceDate?: string): CalendarDuration {
  if (cycle.endDate !== null) return calendarDuration(cycle.startDate, cycle.endDate);
  if (referenceDate === undefined) throw new MissingReferenceDateError(cycle.id);
  return calendarDuration(cycle.startDate, referenceDate);
}

/**
 * Edita as datas de um ciclo, preservando o id. Tudo ou nada: se algo for
 * invalido, lanca erro e nada muda.
 *  - startDate: novo inicio;
 *  - endDate: novo fim; num ciclo aberto, o fecha.
 *  - endDate: null: reabre um ciclo fechado (PD-002), preservando o id. A
 *    integridade do HISTORICO (sobreposicao, segundo aberto) e verificada em
 *    updateInHistory/reopenInHistory, nao aqui.
 * Campos desconhecidos lancam InvalidCycleError.
 */
export function editCycle(cycle: Cycle, changes: CycleChanges): Cycle {
  if (typeof changes !== 'object' || changes === null || Array.isArray(changes)) {
    throw new InvalidCycleError('as alteracoes devem ser um objeto');
  }
  for (const key of Object.keys(changes)) {
    if (key !== 'startDate' && key !== 'endDate') {
      throw new InvalidCycleError(`campo nao editavel: ${key}`);
    }
  }
  const raw = changes as { startDate?: unknown; endDate?: unknown };
  if (raw.startDate !== undefined) parseDate(raw.startDate);
  if (raw.endDate !== undefined && raw.endDate !== null) parseDate(raw.endDate);
  const startDate = (raw.startDate as string | undefined) ?? cycle.startDate;
  const endDate = raw.endDate === null ? null : ((raw.endDate as string | undefined) ?? cycle.endDate);
  if (endDate !== null && daysBetween(startDate, endDate) < 0) {
    throw new InvalidDateRangeError(startDate, endDate);
  }
  return makeCycle(cycle.id, startDate, endDate);
}
