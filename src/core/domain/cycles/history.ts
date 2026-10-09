/**
 * Historico (colecao) de ciclos, em memoria. Valor IMUTAVEL: toda operacao
 * devolve um novo historico e nunca altera o recebido; se falhar, lanca erro e
 * o historico original continua valido. Ciclos nao afetados mantem a mesma
 * referencia.
 *
 * Invariantes sempre garantidos: ids unicos; no maximo um ciclo aberto; todo
 * ciclo fechado com inicio <= fim; ordem cronologica (compareCycles).
 *
 * Contrato para persistencia futura: guardar registros {id, startDate, endDate},
 * recarregar com historyFromCycles() e aplicar as operacoes abaixo.
 */
import { closeCycle, editCycle, isClosed, isOpen } from './cycle.ts';
import {
  CycleNotFoundError, CycleStateError, DuplicateCycleIdError, InvalidCycleError, OpenCycleConflictError,
} from './errors.ts';
import { compareCycles } from './order.ts';
import { parseCycle } from './validate.ts';
import type { ClosedCycle, Cycle, CycleChanges, CycleHistory, OpenCycle } from './types.ts';

function build(cycles: readonly Cycle[]): CycleHistory {
  const sorted = Object.freeze([...cycles].sort(compareCycles));
  return Object.freeze({ cycles: sorted });
}

function replace(history: CycleHistory, id: string, next: Cycle): CycleHistory {
  return build(history.cycles.map((c) => (c.id === id ? next : c)));
}

function mustFind(history: CycleHistory, id: string): Cycle {
  const found = findCycle(history, id);
  if (found === undefined) throw new CycleNotFoundError(id);
  return found;
}

export function emptyHistory(): CycleHistory {
  return build([]);
}

/**
 * Constroi um historico a partir de registros desconhecidos (carregamento ou
 * importacao), em QUALQUER ordem. Valida cada registro, rejeita ids repetidos
 * e mais de um ciclo aberto. Nao cria regras extras sobre sobreposicao (PD-001).
 */
export function historyFromCycles(values: unknown): CycleHistory {
  if (!Array.isArray(values)) throw new InvalidCycleError('o historico deve ser uma lista');
  const seen = new Set<string>();
  let open: Cycle | undefined;
  const cycles: Cycle[] = [];
  for (const value of values as unknown[]) {
    const cycle = parseCycle(value);
    if (seen.has(cycle.id)) throw new DuplicateCycleIdError(cycle.id);
    seen.add(cycle.id);
    if (isOpen(cycle)) {
      if (open !== undefined) throw new OpenCycleConflictError(open.id, cycle.id);
      open = cycle;
    }
    cycles.push(cycle);
  }
  return build(cycles);
}

/** Todos os ciclos em ordem cronologica. */
export function listCycles(history: CycleHistory): readonly Cycle[] {
  return history.cycles;
}

export function findCycle(history: CycleHistory, id: string): Cycle | undefined {
  return history.cycles.find((c) => c.id === id);
}

export function getOpenCycle(history: CycleHistory): OpenCycle | undefined {
  return history.cycles.find(isOpen);
}

export function hasOpenCycle(history: CycleHistory): boolean {
  return getOpenCycle(history) !== undefined;
}

/** Ciclos fechados em ordem cronologica. */
export function getClosedCycles(history: CycleHistory): readonly ClosedCycle[] {
  return history.cycles.filter(isClosed);
}

/**
 * Adiciona um ciclo (em qualquer posicao cronologica). Lanca
 * DuplicateCycleIdError (id repetido) ou OpenCycleConflictError (segundo aberto).
 */
export function addToHistory(history: CycleHistory, cycle: Cycle): CycleHistory {
  const valid = parseCycle(cycle);
  if (findCycle(history, valid.id) !== undefined) throw new DuplicateCycleIdError(valid.id);
  const existing = getOpenCycle(history);
  if (isOpen(valid) && existing !== undefined) throw new OpenCycleConflictError(existing.id, valid.id);
  return build([...history.cycles, valid]);
}

/** Edita as datas de um ciclo (ver editCycle). Lanca CycleNotFoundError se o id nao existir. */
export function updateInHistory(history: CycleHistory, id: string, changes: CycleChanges): CycleHistory {
  return replace(history, id, editCycle(mustFind(history, id), changes));
}

/**
 * Fecha o ciclo `id` (ver closeCycle). NAO cria outro ciclo. Lanca
 * CycleNotFoundError ou CycleStateError (se ja estiver fechado).
 */
export function closeInHistory(history: CycleHistory, id: string, endDate: string): CycleHistory {
  const cycle = mustFind(history, id);
  if (!isOpen(cycle)) throw new CycleStateError(`o ciclo ${id} ja esta fechado`);
  return replace(history, id, closeCycle(cycle, endDate));
}

/** Remove um ciclo (aberto ou fechado). Lanca CycleNotFoundError se o id nao existir. */
export function removeFromHistory(history: CycleHistory, id: string): CycleHistory {
  mustFind(history, id);
  return build(history.cycles.filter((c) => c.id !== id));
}
