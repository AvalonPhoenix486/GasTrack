/**
 * Erros do dominio de ciclos. Erros de DATA (formato invalido, fim antes do
 * inicio) continuam sendo InvalidDateError e InvalidDateRangeError, do dominio
 * de datas.
 */

/** Ciclo/entrada malformado: id invalido, campos faltando ou desconhecidos. */
export class InvalidCycleError extends Error {
  readonly code = 'INVALID_CYCLE';

  constructor(reason: string) {
    super(`Ciclo invalido: ${reason}`);
    this.name = 'InvalidCycleError';
  }
}

/** Operacao incompativel com o estado do ciclo (ex.: fechar um ciclo ja fechado). */
export class CycleStateError extends Error {
  readonly code = 'CYCLE_STATE';

  constructor(reason: string) {
    super(`Operacao invalida para o estado do ciclo: ${reason}`);
    this.name = 'CycleStateError';
  }
}

/** Tentativa de ter dois ciclos abertos ao mesmo tempo. */
export class OpenCycleConflictError extends Error {
  readonly code = 'OPEN_CYCLE_CONFLICT';
  readonly existingId: string;
  readonly attemptedId: string;

  constructor(existingId: string, attemptedId: string) {
    super(`Ja existe um ciclo aberto (${existingId}); nao pode haver dois (${attemptedId}).`);
    this.name = 'OpenCycleConflictError';
    this.existingId = existingId;
    this.attemptedId = attemptedId;
  }
}

/** Ja existe um ciclo com esse id no historico. */
export class DuplicateCycleIdError extends Error {
  readonly code = 'DUPLICATE_CYCLE_ID';
  readonly id: string;

  constructor(id: string) {
    super(`Ja existe um ciclo com o id ${id}.`);
    this.name = 'DuplicateCycleIdError';
    this.id = id;
  }
}

/** Nao existe ciclo com esse id no historico. */
export class CycleNotFoundError extends Error {
  readonly code = 'CYCLE_NOT_FOUND';
  readonly id: string;

  constructor(id: string) {
    super(`Nao existe ciclo com o id ${id}.`);
    this.name = 'CycleNotFoundError';
    this.id = id;
  }
}

/** Duracao de ciclo aberto pedida sem data de referencia. */
export class MissingReferenceDateError extends Error {
  readonly code = 'MISSING_REFERENCE_DATE';
  readonly cycleId: string;

  constructor(cycleId: string) {
    super(`O ciclo ${cycleId} esta aberto: informe a data de referencia para calcular a duracao.`);
    this.name = 'MissingReferenceDateError';
    this.cycleId = cycleId;
  }
}

/** Dois ciclos do historico se sobrepoem (PD-001). Ciclos adjacentes sao permitidos. */
export class CycleOverlapError extends Error {
  readonly code = 'CYCLE_OVERLAP';
  readonly firstId: string;
  readonly secondId: string;

  constructor(firstId: string, secondId: string) {
    super(`Os ciclos ${firstId} e ${secondId} se sobrepoem; ciclos nao podem compartilhar dias.`);
    this.name = 'CycleOverlapError';
    this.firstId = firstId;
    this.secondId = secondId;
  }
}
