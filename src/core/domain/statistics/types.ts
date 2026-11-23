/**
 * Tipos do dominio de estatisticas. So tipos: nenhuma logica aqui.
 *
 * Todas as medidas sao em DIAS TOTAIS de duracao (inteiros vindos do dominio de
 * ciclos). Nunca se usa a representacao "meses + dias".
 */

/** Quantos ciclos fechados tiveram exatamente `durationDays` dias. */
export interface DistributionEntry {
  readonly durationDays: number;
  readonly count: number;
}

export interface StatisticsOptions {
  /**
   * Janela: considerar apenas os N ciclos fechados mais recentes (ordem
   * cronologica real). Inteiro >= 0. Ausente = todos os ciclos fechados.
   * N = 0 seleciona nenhum ciclo (resultado sem dados). N maior que a
   * quantidade existente usa todos os disponiveis (nao e erro).
   */
  readonly lastN?: number;
}

/**
 * Nenhum ciclo fechado na janela. Nao existe media, mediana, minimo etc.:
 * esses campos NAO EXISTEM neste resultado (nao sao 0, nem NaN, nem null),
 * para nunca confundir "sem dado" com "duracao zero".
 */
export interface NoDataStatistics {
  readonly hasData: false;
  readonly count: 0;
}

export interface DurationStatisticsWithData {
  readonly hasData: true;
  /** Ciclos fechados na janela (>= 1). */
  readonly count: number;
  /** Soma das duracoes, em dias (inteiro). */
  readonly totalDays: number;
  /** Media aritmetica, em dias, SEM arredondar (quociente unico totalDays / count). */
  readonly mean: number;
  /** Mediana, em dias: inteiro ou meio-inteiro (media dos dois centrais), nunca arredondada. */
  readonly median: number;
  readonly min: number;
  readonly max: number;
  /** max - min (>= 0). */
  readonly range: number;
  /**
   * MAD (desvio absoluto mediano) BRUTO, em dias: mediana de |x - mediana|.
   * Nao e multiplicado por constante de consistencia (ex.: 1,4826).
   * Com count = 1 vale 0, mas sem informacao real de dispersao: veja `count`.
   */
  readonly mad: number;
  /**
   * Dispersao relativa robusta: mad / median (sem unidade). `null` quando a
   * mediana e 0 (a razao nao esta definida). Nao e uma classificacao.
   */
  readonly relativeMad: number | null;
  /** Distribuicao das duracoes, ordenada por durationDays crescente, sem repeticoes. */
  readonly distribution: readonly DistributionEntry[];
}

export type DurationStatistics = NoDataStatistics | DurationStatisticsWithData;
