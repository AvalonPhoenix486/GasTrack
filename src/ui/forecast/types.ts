/**
 * Modelo de apresentacao da previsao (view model): so TEXTOS ja formatados,
 * independentes de qualquer biblioteca de interface. A tela apenas os exibe.
 *
 * A fonte oficial e a API publica de `core/domain/forecast`. Nada aqui calcula
 * estatistica, janela ou data.
 */

/** Linha de detalhe tecnico: rotulo e valor ja formatados. */
export interface DetailRow {
  readonly label: string;
  readonly value: string;
}

/** Menos de 4 ciclos fechados: nenhuma data e mostrada. */
export interface InsufficientDataView {
  readonly kind: 'insufficient-data';
  readonly title: string;
  readonly message: string;
  /** Ex.: "Histórico: 3 ciclos" */
  readonly historyLine: string;
  /** Ex.: "Necessário: 4 ciclos" */
  readonly requiredLine: string;
}

/** Ha dados suficientes, mas nao ha ciclo em andamento: nenhuma data e mostrada. */
export interface NoOpenCycleView {
  readonly kind: 'no-open-cycle';
  readonly title: string;
  readonly message: string;
  /** Ex.: "Baseado em 8 ciclos fechados" */
  readonly basisLine: string;
}

export interface OkView {
  readonly kind: 'ok';
  /** "Próxima mudança estimada" */
  readonly title: string;
  /** Ex.: "15 de dezembro de 2026" (destaque principal) */
  readonly centralDate: string;
  /** Ex.: "Janela estimada: 14 a 16 de dezembro" */
  readonly windowLine: string;
  /** Informacao complementar sobre a variacao observada (discreta). */
  readonly variabilityLines: readonly string[];
  /** Ex.: "Baseado em 8 ciclos fechados" */
  readonly basisLine: string;
  /** Secao secundaria "detalhes tecnicos". */
  readonly detailsTitle: string;
  readonly details: readonly DetailRow[];
}

export type ForecastView = InsufficientDataView | NoOpenCycleView | OkView;
