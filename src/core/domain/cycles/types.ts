/**
 * Tipos do dominio de ciclos de consumo. So tipos: nenhuma logica aqui.
 *
 * Um ciclo e o periodo de uso de UM botijao. Ha apenas dois estados, e o estado
 * e DERIVADO de endDate (null = aberto), nao armazenado: assim nao existe
 * combinacao inconsistente como "aberto com data de fim".
 */

/** Gas em uso: tem inicio e nenhuma data de fim. */
export interface OpenCycle {
  readonly id: string;
  /** "YYYY-MM-DD" */
  readonly startDate: string;
  readonly endDate: null;
}

/** Gas que ja acabou: tem inicio e fim (fim >= inicio). */
export interface ClosedCycle {
  readonly id: string;
  /** "YYYY-MM-DD" */
  readonly startDate: string;
  /** "YYYY-MM-DD", nunca anterior a startDate */
  readonly endDate: string;
}

export type Cycle = OpenCycle | ClosedCycle;

export type CycleStatus = 'open' | 'closed';

/** Dados para criar um ciclo (sempre nasce aberto). O id e fornecido por quem chama. */
export interface NewCycle {
  readonly id: string;
  readonly startDate: string;
}

/**
 * Alteracoes permitidas em um ciclo. `undefined` = nao muda.
 * Nao e possivel mudar o id. Dar endDate a um ciclo aberto o fecha.
 */
export interface CycleChanges {
  readonly startDate?: string;
  readonly endDate?: string;
}

/**
 * Historico de ciclos: valor imutavel, sempre em ordem cronologica
 * (ver compareCycles) e sempre com no maximo um ciclo aberto e ids unicos.
 * Construa so por emptyHistory() ou historyFromCycles().
 */
export interface CycleHistory {
  readonly cycles: readonly Cycle[];
}
