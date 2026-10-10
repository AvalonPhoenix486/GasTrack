/**
 * Regra PD-001: ciclos nao podem se sobrepor.
 * Semantica de intervalos: ciclo fechado = [inicio, fim] (datas de calendario);
 * ciclo aberto = [inicio, infinito). Dois ciclos podem SE TOCAR (o fim de um e
 * igual ao inicio do outro: adjacentes), mas nao podem compartilhar dias alem
 * dessa data-fronteira. Formalmente: sobrepoem-se quando
 *   a.inicio < b.fim  E  b.inicio < a.fim   (fim de ciclo aberto = infinito).
 * Consequencia: um ciclo aberto so e valido depois de todos os fechados.
 * Funcoes puras; usa apenas o dominio de datas.
 */
import { compareDates } from '../dates/index.ts';
import { CycleOverlapError } from './errors.ts';
import type { Cycle } from './types.ts';

/** `start` estritamente antes de `end`; `end === null` significa sem fim. */
function startsBefore(start: string, end: string | null): boolean {
  return end === null || compareDates(start, end) < 0;
}

export function cyclesOverlap(a: Cycle, b: Cycle): boolean {
  return startsBefore(a.startDate, b.endDate) && startsBefore(b.startDate, a.endDate);
}

/** Lanca CycleOverlapError se algum par de ciclos se sobrepoe. */
export function assertNoOverlap(cycles: readonly Cycle[]): void {
  for (let i = 0; i < cycles.length; i++) {
    for (let j = i + 1; j < cycles.length; j++) {
      const a = cycles[i] as Cycle;
      const b = cycles[j] as Cycle;
      if (cyclesOverlap(a, b)) throw new CycleOverlapError(a.id, b.id);
    }
  }
}
