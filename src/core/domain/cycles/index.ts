/**
 * API publica do dominio de ciclos. Outras camadas importam so daqui.
 * Depende apenas do dominio de datas (../dates/index.ts).
 */
export type {
  OpenCycle, ClosedCycle, Cycle, CycleStatus, NewCycle, CycleChanges, CycleHistory,
} from './types.ts';
export {
  createCycle, closeCycle, reopenCycle, editCycle, cycleDuration, isOpen, isClosed, cycleStatus,
} from './cycle.ts';
export { parseCycle, isValidCycleId } from './validate.ts';
export { compareCycles } from './order.ts';
export { cyclesOverlap } from './overlap.ts';
export {
  emptyHistory, historyFromCycles, listCycles, findCycle, getOpenCycle, hasOpenCycle,
  getClosedCycles, addToHistory, updateInHistory, closeInHistory, reopenInHistory, removeFromHistory,
} from './history.ts';
export {
  InvalidCycleError, CycleStateError, OpenCycleConflictError, DuplicateCycleIdError,
  CycleNotFoundError, MissingReferenceDateError, CycleOverlapError,
} from './errors.ts';
