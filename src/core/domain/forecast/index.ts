/**
 * API publica do dominio de previsao. Outras camadas importam so daqui.
 * Depende apenas de ../cycles, ../dates e ../statistics (suas APIs publicas).
 */
export type {
  Forecast, OkForecast, InsufficientDataForecast, NoOpenCycleForecast, DayWindow, ForecastVariability,
} from './types.ts';
export { MIN_CLOSED_CYCLES, FLOOR_DAYS } from './types.ts';
export { forecastNextChange } from './forecast.ts';
export { halfWidth, toDayWindow } from './window.ts';
export { InvalidForecastInputError } from './errors.ts';
