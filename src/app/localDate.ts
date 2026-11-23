/**
 * Data CIVIL local ("YYYY-MM-DD") a partir do relogio do aparelho.
 * Usa os componentes LOCAIS (getFullYear/getMonth/getDate); nunca a conversao
 * para UTC, que erra o dia perto da meia-noite. E a unica porta de entrada do
 * relogio na aplicacao.
 */
import { formatDate } from '../core/domain/dates/index.ts';

export function localCivilDate(now: Date = new Date()): string {
  return formatDate({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
}
