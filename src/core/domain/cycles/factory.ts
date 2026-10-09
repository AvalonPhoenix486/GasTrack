/**
 * Fabrica interna de ciclos (nao faz parte da API publica, nao valida).
 * Todo ciclo sai daqui congelado, entao ninguem altera um ciclo por engano.
 */
import type { Cycle } from './types.ts';

export function makeCycle(id: string, startDate: string, endDate: string | null): Cycle {
  return endDate === null
    ? Object.freeze({ id, startDate, endDate: null })
    : Object.freeze({ id, startDate, endDate });
}
