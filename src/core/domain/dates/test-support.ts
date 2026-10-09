// Apoio de testes. NAO faz parte do modulo: usa Date.UTC como ORACULO
// independente para conferir a aritmetica inteira do dominio.

export const MS_PER_DAY = 86_400_000;

/** Dias desde 1970-01-01 (UTC) calculados com Date; valido tambem para anos < 100. */
export function oracleEpochDay(year: number, month: number, day: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  return d.getTime() / MS_PER_DAY;
}

/** Quantidade de dias do mes segundo Date (dia 0 do mes seguinte). */
export function oracleDaysInMonth(year: number, month: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month, 0);
  return d.getUTCDate();
}

/** true se Date aceita a data sem "rolar" para outro dia/mes. */
export function oracleIsReal(year: number, month: number, day: number): boolean {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export function iso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Soma `n` dias a uma data ISO usando Date (oraculo). */
export function oracleAddDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d + n);
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
