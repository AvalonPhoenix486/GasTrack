/**
 * API publica da apresentacao da previsao. A tela importa so daqui.
 * Depende apenas das APIs publicas de `core/domain/forecast`, `cycles` e `dates`.
 */
export type { ForecastView, InsufficientDataView, NoOpenCycleView, OkView, DetailRow } from './types.ts';
export { presentForecast, presentNextChange } from './present.ts';
