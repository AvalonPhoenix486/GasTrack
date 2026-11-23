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
import { formatClosedCycles, formatCycles, formatDateWindow, formatDays, formatLongDate, formatPercent } from './format.ts';
import type { DetailRow, ForecastView, OkView } from './types.ts';

function variabilityLines(f: OkForecast): readonly string[] {
  if (f.floorApplied) {
    const minimum = formatDays(FLOOR_DAYS);
    return Object.freeze([
      `A variabilidade observada foi inferior a ${minimum}. Por isso, foi aplicada a largura mínima de ${minimum} à janela estimada.`,
    ]);
  }
  return Object.freeze([`Variação típica: cerca de ${formatDays(f.variability.madDays)}.`]);
}

function details(f: OkForecast): readonly DetailRow[] {
  const relative = f.variability.relativeMad;
  const rows: DetailRow[] = [
    { label: 'Mediana', value: formatDays(f.medianDays) },
    { label: 'MAD (desvio absoluto mediano)', value: formatDays(f.variability.madDays) },
    { label: 'Meia-largura da janela', value: formatDays(f.halfWidthDays) },
    { label: 'Variabilidade relativa', value: relative === null ? 'indisponível (mediana 0)' : formatPercent(relative) },
    { label: 'Menor ciclo', value: formatDays(f.variability.minDays) },
    { label: 'Maior ciclo', value: formatDays(f.variability.maxDays) },
    { label: 'Amplitude', value: formatDays(f.variability.rangeDays) },
  ];
  return Object.freeze(rows.map((r) => Object.freeze(r)));
}

function presentOk(f: OkForecast): OkView {
  return Object.freeze({
    kind: 'ok',
    title: 'Próxima mudança estimada',
    centralDate: formatLongDate(f.centralDate),
    windowLine: `Janela estimada: ${formatDateWindow(f.windowStartDate, f.windowEndDate)}`,
    variabilityLines: variabilityLines(f),
    basisLine: `Baseado em ${formatClosedCycles(f.closedCount)}`,
    detailsTitle: 'Detalhes técnicos',
    details: details(f),
  });
}

/**
 * Textos para os tres estados normais da previsao. Lanca Error se receber um
 * estado desconhecido (nao deveria ocorrer com a API atual do dominio).
 */
export function presentForecast(forecast: Forecast): ForecastView {
  switch (forecast.status) {
    case 'insufficient-data':
      return Object.freeze({
        kind: 'insufficient-data',
        title: 'Próxima mudança',
        message: 'Ainda não há histórico suficiente para estimar a próxima mudança.',
        historyLine: `Histórico: ${formatCycles(forecast.closedCount)}`,
        requiredLine: `Necessário: ${formatCycles(forecast.requiredCount)}`,
      });
    case 'no-open-cycle':
      return Object.freeze({
        kind: 'no-open-cycle',
        title: 'Próxima mudança',
        message: 'Há histórico suficiente para fazer a estimativa, mas não existe um ciclo em andamento para aplicar a previsão.',
        basisLine: `Baseado em ${formatClosedCycles(forecast.closedCount)}`,
      });
    case 'ok':
      return presentOk(forecast);
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
export function presentNextChange(cycles: readonly Cycle[]): ForecastView {
  return presentForecast(forecastNextChange(cycles));
}
