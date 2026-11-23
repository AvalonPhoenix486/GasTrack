/**
 * Tipos e parametros do dominio de previsao.
 *
 * A previsao e ESTATISTICA: descreve onde cai a troca se o proximo ciclo se
 * parecer com os ja observados. Nao e garantia, nao e intervalo de confianca e
 * nao carrega nenhuma probabilidade de acerto.
 *
 * Todas as medidas em dias totais de duracao (vindos de `statistics`).
 */

/** Minimo de ciclos FECHADOS para existir previsao de data. */
export const MIN_CLOSED_CYCLES = 4;

/** Meia-largura minima da faixa, em dias: h = max(FLOOR_DAYS, MAD). */
export const FLOOR_DAYS = 1;

/** Faixa em dias de duracao, ja convertida para inteiros (>= 0), com lowerDays <= centralDays <= upperDays. */
export interface DayWindow {
  readonly lowerDays: number;
  readonly centralDays: number;
  readonly upperDays: number;
}

/** Quanto os ciclos observados variam. Informacao descritiva, nao uma classificacao. */
export interface ForecastVariability {
  /** MAD bruto (multiplo de 0,5), sem arredondar. */
  readonly madDays: number;
  /** MAD / mediana; `null` quando a mediana e 0. */
  readonly relativeMad: number | null;
  readonly minDays: number;
  readonly maxDays: number;
  readonly rangeDays: number;
}

/** Menos de MIN_CLOSED_CYCLES ciclos fechados: nao existe previsao de data. */
export interface InsufficientDataForecast {
  readonly status: 'insufficient-data';
  readonly closedCount: number;
  readonly requiredCount: number;
}

/** Ha dados suficientes, mas nenhum ciclo aberto de onde contar as datas. Nenhuma data e fabricada. */
export interface NoOpenCycleForecast {
  readonly status: 'no-open-cycle';
  readonly closedCount: number;
}

export interface OkForecast {
  readonly status: 'ok';
  /** Ciclos fechados usados (todos os disponiveis). */
  readonly closedCount: number;
  /** Inicio do ciclo aberto, de onde as datas sao contadas. */
  readonly openCycleStart: string;
  /** Mediana exata, em dias (inteiro ou meio-inteiro). */
  readonly medianDays: number;
  /** Meia-largura exata h = max(FLOOR_DAYS, MAD). */
  readonly halfWidthDays: number;
  /** true quando h veio do piso (MAD < FLOOR_DAYS). */
  readonly floorApplied: boolean;
  readonly window: DayWindow;
  /** openCycleStart + centralDays */
  readonly centralDate: string;
  /** openCycleStart + lowerDays */
  readonly windowStartDate: string;
  /** openCycleStart + upperDays */
  readonly windowEndDate: string;
  readonly variability: ForecastVariability;
}

export type Forecast = InsufficientDataForecast | NoOpenCycleForecast | OkForecast;
