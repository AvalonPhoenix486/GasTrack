/** Erro do dominio de estatisticas: entrada ou opcao invalida. */
export class InvalidStatisticsInputError extends Error {
  readonly code = 'INVALID_STATISTICS_INPUT';

  constructor(reason: string) {
    super(`Entrada invalida para estatisticas: ${reason}`);
    this.name = 'InvalidStatisticsInputError';
  }
}
