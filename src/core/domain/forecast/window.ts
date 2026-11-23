/**
 * Janela em dias de duracao. Funcoes puras sobre numeros: sem datas, sem ciclos.
 *
 * Politica numerica: mediana e MAD chegam EXATOS de `statistics` (multiplos de
 * 0,5) e assim permanecem durante todo o calculo. A conversao para dias
 * inteiros acontece UMA vez, aqui, na ultima etapa (`toDayWindow`).
 */
import { InvalidForecastInputError } from './errors.ts';
import { FLOOR_DAYS } from './types.ts';
import type { DayWindow } from './types.ts';

function requireNonNegativeFinite(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new InvalidForecastInputError(`${name} deve ser um numero finito >= 0`);
  }
  return value;
}

/** Meia-largura exata da faixa: max(FLOOR_DAYS, MAD). */
export function halfWidth(madDays: number): number {
  return Math.max(FLOOR_DAYS, requireNonNegativeFinite(madDays, 'madDays'));
}

/**
 * Converte mediana e meia-largura EXATAS em dias inteiros:
 *  - lowerDays   = max(0, ceil(mediana - h))   (nunca abaixo de 0 dia)
 *  - upperDays   = floor(mediana + h)
 *  - centralDays = floor(mediana)               (mediana x,5 -> o dia anterior)
 * A faixa resultante e exatamente o conjunto dos dias inteiros d >= 0 com
 * |d - mediana| <= h. Nao arredonda para fora.
 */
export function toDayWindow(medianDays: number, halfWidthDays: number): DayWindow {
  const median = requireNonNegativeFinite(medianDays, 'medianDays');
  const h = requireNonNegativeFinite(halfWidthDays, 'halfWidthDays');
  if (h < FLOOR_DAYS) throw new InvalidForecastInputError(`halfWidthDays deve ser >= ${FLOOR_DAYS}`);
  // Math.max(0, -0) e +0: a funcao nunca devolve -0.
  return Object.freeze({
    lowerDays: Math.max(0, Math.ceil(median - h)),
    centralDays: Math.floor(median),
    upperDays: Math.floor(median + h),
  });
}
