import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDuration, InvalidDateError, InvalidDateRangeError } from './index.ts';
import { parseDate } from './index.ts';
import { oracleEpochDay, oracleIsReal, oracleAddDays, iso } from './test-support.ts';

type Expected = { total: number; months: number; days: number; rep: 'months-days' | 'days-only' };
const MD = 'months-days' as const;
const DO = 'days-only' as const;

// [inicio, fim, esperado]. Valores calculados a mao a partir da regra do README.
const TABLE: ReadonlyArray<readonly [string, string, Expected]> = [
  // exemplo oficial
  ['2026-10-05', '2027-01-15', { total: 102, months: 3, days: 10, rep: MD }],
  // basicos
  ['2026-05-10', '2026-05-10', { total: 0, months: 0, days: 0, rep: DO }],
  ['2026-05-10', '2026-05-11', { total: 1, months: 0, days: 1, rep: DO }],
  ['2026-05-10', '2026-05-25', { total: 15, months: 0, days: 15, rep: DO }],
  // inicio -> fim do mesmo mes
  ['2026-03-01', '2026-03-31', { total: 30, months: 0, days: 30, rep: DO }],
  ['2026-03-05', '2026-03-31', { total: 26, months: 0, days: 26, rep: DO }],
  // virada de mes
  ['2026-03-31', '2026-04-01', { total: 1, months: 0, days: 1, rep: DO }],
  ['2026-03-15', '2026-04-15', { total: 31, months: 1, days: 0, rep: MD }],
  ['2026-03-15', '2026-04-14', { total: 30, months: 0, days: 30, rep: DO }],
  ['2026-03-15', '2026-04-16', { total: 32, months: 1, days: 1, rep: MD }],
  // meses de 28, 29, 30 e 31 dias contam como 1 mes (nunca 30 dias)
  ['2026-02-01', '2026-03-01', { total: 28, months: 1, days: 0, rep: MD }],
  ['2024-02-01', '2024-03-01', { total: 29, months: 1, days: 0, rep: MD }],
  ['2026-04-01', '2026-05-01', { total: 30, months: 1, days: 0, rep: MD }],
  ['2026-01-01', '2026-02-01', { total: 31, months: 1, days: 0, rep: MD }],
  // fim de mes (decisao de produto)
  ['2026-01-31', '2026-02-01', { total: 1, months: 0, days: 1, rep: DO }],
  ['2026-01-31', '2026-03-01', { total: 29, months: 0, days: 29, rep: DO }],   // NUNCA "1 mes e 1 dia"
  ['2026-01-31', '2026-03-31', { total: 59, months: 2, days: 0, rep: MD }],
  ['2026-01-31', '2026-04-30', { total: 89, months: 0, days: 89, rep: DO }],
  ['2026-01-30', '2026-03-01', { total: 30, months: 0, days: 30, rep: DO }],
  ['2026-04-30', '2026-05-30', { total: 30, months: 1, days: 0, rep: MD }],
  ['2026-04-30', '2026-05-31', { total: 31, months: 0, days: 31, rep: DO }],
  ['2026-05-31', '2026-06-30', { total: 30, months: 0, days: 30, rep: DO }],
  ['2026-05-31', '2026-07-31', { total: 61, months: 2, days: 0, rep: MD }],
  // bissexto
  ['2024-02-28', '2024-02-29', { total: 1, months: 0, days: 1, rep: DO }],
  ['2024-02-29', '2024-03-01', { total: 1, months: 0, days: 1, rep: DO }],
  ['2024-02-28', '2024-03-01', { total: 2, months: 0, days: 2, rep: DO }],
  ['2023-02-28', '2023-03-01', { total: 1, months: 0, days: 1, rep: DO }],
  ['2024-01-29', '2024-02-29', { total: 31, months: 1, days: 0, rep: MD }],
  ['2024-02-29', '2025-02-28', { total: 365, months: 0, days: 365, rep: DO }],
  ['2024-02-29', '2028-02-29', { total: 1461, months: 48, days: 0, rep: MD }],
  // virada de ano
  ['2026-12-31', '2027-01-01', { total: 1, months: 0, days: 1, rep: DO }],
  ['2026-12-15', '2027-01-15', { total: 31, months: 1, days: 0, rep: MD }],
  ['2026-12-20', '2027-01-10', { total: 21, months: 0, days: 21, rep: DO }],
  ['2026-11-20', '2027-02-10', { total: 82, months: 2, days: 21, rep: MD }],
  // periodos longos (sem anos: 12 meses = "12 meses")
  ['2025-01-15', '2026-01-15', { total: 365, months: 12, days: 0, rep: MD }],
  ['2024-01-15', '2025-01-15', { total: 366, months: 12, days: 0, rep: MD }],
  ['2000-01-01', '2001-01-01', { total: 366, months: 12, days: 0, rep: MD }],
  ['1900-01-01', '2000-01-01', { total: 36524, months: 1200, days: 0, rep: MD }],
];

describe('calendarDuration: casos definidos', () => {
  for (const [start, end, x] of TABLE) {
    test(`${start} -> ${end}`, () => {
      const r = calendarDuration(start, end);
      assert.deepEqual(
        { total: r.totalDays, months: r.months, days: r.days, rep: r.representation },
        x,
      );
    });
  }

  test('exemplo oficial: 102 dias e 3 meses e 10 dias', () => {
    const r = calendarDuration('2026-10-05', '2027-01-15');
    assert.equal(r.totalDays, 102);
    assert.equal(r.months, 3);
    assert.equal(r.days, 10);
    assert.equal(r.representation, 'months-days');
  });

  test('exemplo de borda: 31/01 -> 01/03 = 29 dias e NAO "1 mes e 1 dia"', () => {
    const r = calendarDuration('2026-01-31', '2026-03-01');
    assert.equal(r.totalDays, 29);
    assert.equal(r.representation, 'days-only');
    assert.equal(r.months, 0);
    assert.notDeepEqual([r.months, r.days], [1, 1]);
  });
});

describe('calendarDuration: erros', () => {
  test('fim anterior ao inicio', () => {
    assert.throws(() => calendarDuration('2026-10-15', '2026-10-05'), InvalidDateRangeError);
    try { calendarDuration('2026-10-15', '2026-10-05'); } catch (e) {
      if (!(e instanceof InvalidDateRangeError)) throw e;
      assert.equal(e.code, 'INVALID_DATE_RANGE');
    }
  });
  test('datas invalidas', () => {
    assert.throws(() => calendarDuration('2026-02-30', '2026-03-01'), InvalidDateError);
    assert.throws(() => calendarDuration('2026-02-01', '2026-02-30'), InvalidDateError);
    assert.throws(() => calendarDuration('2026-2-1', '2026-03-01'), InvalidDateError);
    assert.throws(() => calendarDuration('', ''), InvalidDateError);
  });
});

/** Aniversario `n` meses depois, calculado com Date (oraculo). null se o dia nao existe. */
function oracleAnniversary(start: string, n: number): string | null {
  const s = parseDate(start);
  const idx = s.month - 1 + n;
  const y = s.year + Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return oracleIsReal(y, m, s.day) ? iso(y, m, s.day) : null;
}

describe('calendarDuration: propriedades contra oraculo', () => {
  test('todo inicio de 2023-2025 x 0..420 dias de duracao', () => {
    let checked = 0;
    for (let off = 0; off < 3 * 366; off++) {
      const start = oracleAddDays('2023-01-01', off);
      if (start > '2025-12-31') break;
      const s = parseDate(start);
      for (let len = 0; len <= 420; len++) {
        const end = oracleAddDays(start, len);
        const r = calendarDuration(start, end);
        const e = parseDate(end);
        const where = `${start} -> ${end}`;
        const expectedTotal = oracleEpochDay(e.year, e.month, e.day) - oracleEpochDay(s.year, s.month, s.day);

        // total sempre exato
        if (r.totalDays !== expectedTotal || r.totalDays !== len) assert.fail(`total ${where}`);

        if (r.representation === 'days-only') {
          if (r.months !== 0 || r.days !== r.totalDays) assert.fail(`days-only inconsistente ${where}`);
        } else {
          if (r.months < 1 || r.days < 0) assert.fail(`months-days invalido ${where}`);
          const anchor = oracleAnniversary(start, r.months);
          if (anchor === null) assert.fail(`aniversario inexistente usado em ${where}`);
          const a = parseDate(anchor);
          if (oracleEpochDay(a.year, a.month, a.day) + r.days !== oracleEpochDay(e.year, e.month, e.day)) assert.fail(`ancora+dias != fim em ${where}`);
        }

        if (s.day <= 28) {
          // maior numero de meses completos: o proximo aniversario ainda nao foi alcancado
          const next = oracleAnniversary(start, r.months + 1);
          if (next === null || next <= end) assert.fail(`nao e o maior numero de meses em ${where}`);
          // e 'days-only' se, e somente se, nenhum mes completo
          const first = oracleAnniversary(start, 1) as string;
          const noFullMonth = end < first;
          if ((r.representation === 'days-only') !== noFullMonth) assert.fail(`representacao ${where}`);
        } else {
          // inicio 29-31: so 'months-days' no aniversario exato
          const exact = e.day === s.day && (e.year * 12 + e.month) > (s.year * 12 + s.month);
          if ((r.representation === 'months-days') !== exact) assert.fail(`regra 29-31 ${where}`);
          if (exact && r.days !== 0) assert.fail(`dias != 0 em aniversario ${where}`);
        }
        checked++;
      }
    }
    assert.ok(checked > 400_000, `verificacoes: ${checked}`);
  });
});
