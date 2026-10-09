/**
 * Erros do dominio de datas. Sem dependencias externas.
 */

function describe(input: unknown): string {
  if (typeof input === 'string') {
    const shown = input.length > 40 ? `${input.slice(0, 40)}...` : input;
    return JSON.stringify(shown);
  }
  return input === null ? 'null' : `<${typeof input}>`;
}

/** Lancado quando um valor nao e uma data "YYYY-MM-DD" valida do calendario. */
export class InvalidDateError extends Error {
  readonly code = 'INVALID_DATE';
  readonly input: unknown;

  constructor(input: unknown, reason: string) {
    super(`Data invalida (${reason}): ${describe(input)}`);
    this.name = 'InvalidDateError';
    this.input = input;
  }
}

/** Lancado quando o fim de um periodo e anterior ao inicio. */
export class InvalidDateRangeError extends Error {
  readonly code = 'INVALID_DATE_RANGE';
  readonly start: string;
  readonly end: string;

  constructor(start: string, end: string) {
    super(`Periodo invalido: o fim (${end}) e anterior ao inicio (${start}).`);
    this.name = 'InvalidDateRangeError';
    this.start = start;
    this.end = end;
  }
}
