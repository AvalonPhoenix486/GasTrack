/**
 * Apresentacao da previsao: transforma o resultado de `forecastNextChange` em
 * textos para o usuario. So formata; nao recalcula mediana, MAD, janela nem datas.
 *
 * Linguagem: "estimada", "estimativa", "janela estimada", "variacao observada".
 * Nunca: confianca, probabilidade, chance, certeza ou garantia. A janela nao e
 * intervalo de confianca. Os ciclos recentes NAO tem mais peso e nao ha filtro
 * pelos ultimos N ciclos; a apresentacao nao sugere nada disso.
 */
import { FLOOR_DAYS, forecastNextChange } from '../../core/domain/forecast/index.ts';
import type { Forecast, OkForecast } from '../../core/domain/forecast/index.ts';
import type { Cycle } from '../../core/domain/cycles/index.ts';
import { DEFAULT_LOCALE } from '../locale.ts';
import type { Locale } from '../locale.ts';
import { formatClosedCycles, formatCycles, formatDateWindow, formatDays, formatLongDate, formatPercent } from './format.ts';
import { forecastText } from './text.ts';
import type { DetailRow, ForecastView, OkView } from './types.ts';

function variabilityLines(f: OkForecast, locale: Locale): readonly string[] {
  const t = forecastText(locale);
  if (f.floorApplied) return Object.freeze([t.floorApplied(formatDays(FLOOR_DAYS, locale))]);
  return Object.freeze([t.typicalVariation(formatDays(f.variability.madDays, locale))]);
}

function details(f: OkForecast, locale: Locale): readonly DetailRow[] {
  const t = forecastText(locale);
  const relative = f.variability.relativeMad;
  const rows: DetailRow[] = [
    { label: t.labels.median, value: formatDays(f.medianDays, locale) },
    { label: t.labels.mad, value: formatDays(f.variability.madDays, locale) },
    { label: t.labels.halfWidth, value: formatDays(f.halfWidthDays, locale) },
    { label: t.labels.relative, value: relative === null ? t.relativeUnavailable : formatPercent(relative, locale) },
    { label: t.labels.shortest, value: formatDays(f.variability.minDays, locale) },
    { label: t.labels.longest, value: formatDays(f.variability.maxDays, locale) },
    { label: t.labels.range, value: formatDays(f.variability.rangeDays, locale) },
  ];
  return Object.freeze(rows.map((r) => Object.freeze(r)));
}

function presentOk(f: OkForecast, locale: Locale): OkView {
  const t = forecastText(locale);
  return Object.freeze({
    kind: 'ok',
    title: t.titleOk,
    centralDate: formatLongDate(f.centralDate, locale),
    windowLine: t.window(formatDateWindow(f.windowStartDate, f.windowEndDate, locale)),
    variabilityLines: variabilityLines(f, locale),
    basisLine: t.basis(formatClosedCycles(f.closedCount, locale)),
    detailsTitle: t.detailsTitle,
    details: details(f, locale),
  });
}

/**
 * Textos para os tres estados normais da previsao. Lanca Error se receber um
 * estado desconhecido (nao deveria ocorrer com a API atual do dominio).
 */
export function presentForecast(forecast: Forecast, locale: Locale = DEFAULT_LOCALE): ForecastView {
  const t = forecastText(locale);
  switch (forecast.status) {
    case 'insufficient-data':
      return Object.freeze({
        kind: 'insufficient-data',
        title: t.title,
        message: t.insufficientMessage,
        historyLine: t.history(formatCycles(forecast.closedCount, locale)),
        requiredLine: t.required(formatCycles(forecast.requiredCount, locale)),
      });
    case 'no-open-cycle':
      return Object.freeze({
        kind: 'no-open-cycle',
        title: t.title,
        message: t.noOpenMessage,
        basisLine: t.basis(formatClosedCycles(forecast.closedCount, locale)),
      });
    case 'ok':
      return presentOk(forecast, locale);
    default: {
      const unknown: never = forecast;
      throw new Error(`Estado de previsão desconhecido: ${JSON.stringify(unknown)}`);
    }
  }
}

/**
 * Ponto unico de integracao para a tela: ciclos -> previsao do dominio -> textos.
 * Propaga os erros do dominio (entrada invalida, data fora de 0001-9999), que nao
 * sao estados normais da previsao.
 */
export function presentNextChange(cycles: readonly Cycle[], locale: Locale = DEFAULT_LOCALE): ForecastView {
  return presentForecast(forecastNextChange(cycles), locale);
}
