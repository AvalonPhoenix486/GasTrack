/** Erro do dominio de previsao: entrada invalida (nao e um estado normal da previsao). */
export class InvalidForecastInputError extends Error {
  readonly code = 'INVALID_FORECAST_INPUT';

  constructor(reason: string) {
    super(`Entrada invalida para previsao: ${reason}`);
    this.name = 'InvalidForecastInputError';
  }
}
