import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidDate, parseDate, formatDate, compareDates, daysBetween, InvalidDateError,
} from './index.ts';
import { toEpochDay, isLeapYear, daysInMonth, MIN_YEAR, MAX_YEAR } from './calendar.ts';
import { oracleEpochDay, oracleDaysInMonth, oracleIsReal, iso, MS_PER_DAY } from './test-support.ts';

describe('validacao e parse', () => {
  test('datas validas', () => {
    for (const s of ['2026-10-05', '2024-02-29', '2000-02-29', '0001-01-01', '9999-12-31', '2026-12-31', '2026-01-01']) {
      assert.equal(isValidDate(s), true, s);
      assert.equal(formatDate(parseDate(s)), s, s);
    }
    assert.deepEqual(parseDate('2026-10-05'), { year: 2026, month: 10, day: 5 });
  });

  test('mes invalido', () => {
    for (const s of ['2026-00-10', '2026-13-01', '2026-99-01']) assert.equal(isValidDate(s), false, s);
  });

  test('dia invalido', () => {
    for (const s of ['2026-01-00', '2026-01-32', '2026-02-30', '2026-04-31', '2026-06-31', '2026-09-31', '2026-11-31', '2026-02-29', '2023-02-29', '2100-02-29', '1900-02-29', '2026-01-99']) {
      assert.equal(isValidDate(s), false, s);
    }
  });

  test('ano invalido', () => {
    for (const s of ['0000-01-01', '10000-01-01', '-001-01-01', '+2026-01-01', '20-26-01-01']) assert.equal(isValidDate(s), false, s);
  });

  test('formato diferente de YYYY-MM-DD', () => {
    const bad: unknown[] = [
      '', ' ', '2026-1-1', '26-01-01', '2026/01/01', '01/02/2026', '2026.01.01', '20260101',
      '2026-01-01T00:00:00', '2026-01-01T00:00:00Z', '2026-01-01 ', ' 2026-01-01', '2026-01-01\n', '\n2026-01-01',
      '2026-01-011', '2026-001-01', '2026-01-1e', '２０２６-01-01', '2026-01-01\u0000', 'abcd-ef-gh',
      null, undefined, 20260101, new Date(0), {}, [], true,
    ];
    for (const v of bad) {
      assert.equal(isValidDate(v), false, String(v));
      assert.throws(() => parseDate(v), InvalidDateError, String(v));
    }
  });

  test('erro tem codigo e entrada original', () => {
    try { parseDate('2026-02-30'); assert.fail('deveria lancar'); } catch (e) {
      if (!(e instanceof InvalidDateError)) throw e;
      assert.equal(e.code, 'INVALID_DATE');
      assert.equal(e.input, '2026-02-30');
    }
  });

  test('formatDate rejeita componentes invalidos', () => {
    for (const c of [
      { year: 2026, month: 2, day: 30 }, { year: 2026, month: 13, day: 1 }, { year: 0, month: 1, day: 1 },
      { year: 2026.5, month: 1, day: 1 }, { year: 2026, month: 1.5, day: 1 }, { year: 2026, month: 1, day: 0 },
    ]) assert.throws(() => formatDate(c), InvalidDateError, JSON.stringify(c));
  });
});

describe('anos bissextos', () => {
  test('regra gregoriana', () => {
    for (const y of [1904, 2000, 2024, 2400, 1996]) assert.equal(isLeapYear(y), true, String(y));
    for (const y of [1900, 2100, 2023, 2025, 2026, 1800, 1999]) assert.equal(isLeapYear(y), false, String(y));
  });
  test('29 de fevereiro', () => {
    assert.equal(isValidDate('2024-02-29'), true);
    assert.equal(isValidDate('2023-02-29'), false);
    assert.equal(isValidDate('2000-02-29'), true);
    assert.equal(isValidDate('1900-02-29'), false);
  });
});

describe('meses com 28, 29, 30 e 31 dias', () => {
  test('tamanhos', () => {
    assert.equal(daysInMonth(2026, 2), 28);
    assert.equal(daysInMonth(2024, 2), 29);
    assert.equal(daysInMonth(2026, 4), 30);
    assert.equal(daysInMonth(2026, 1), 31);
  });
  test('primeiro ao primeiro do mes seguinte = tamanho do mes (nao 30)', () => {
    assert.equal(daysBetween('2026-02-01', '2026-03-01'), 28);
    assert.equal(daysBetween('2024-02-01', '2024-03-01'), 29);
    assert.equal(daysBetween('2026-04-01', '2026-05-01'), 30);
    assert.equal(daysBetween('2026-01-01', '2026-02-01'), 31);
  });
});

describe('daysBetween (total exato de dias)', () => {
  test('mesma data, 1 dia, varios dias', () => {
    assert.equal(daysBetween('2026-05-10', '2026-05-10'), 0);
    assert.equal(daysBetween('2026-05-10', '2026-05-11'), 1);
    assert.equal(daysBetween('2026-05-10', '2026-05-25'), 15);
    assert.equal(daysBetween('2026-05-01', '2026-05-31'), 30);
  });
  test('ordem invertida devolve valor negativo', () => {
    assert.equal(daysBetween('2026-10-15', '2026-10-05'), -10);
    assert.equal(daysBetween('2027-01-15', '2026-10-05'), -102);
  });
  test('mesmo mes, virada de mes, fim de mes', () => {
    assert.equal(daysBetween('2026-03-05', '2026-03-20'), 15);
    assert.equal(daysBetween('2026-03-31', '2026-04-01'), 1);
    assert.equal(daysBetween('2026-01-31', '2026-02-01'), 1);
    assert.equal(daysBetween('2026-01-31', '2026-03-01'), 29);
    assert.equal(daysBetween('2026-04-30', '2026-05-30'), 30);
    assert.equal(daysBetween('2026-05-31', '2026-06-30'), 30);
  });
  test('virada de ano', () => {
    assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
    assert.equal(daysBetween('2026-12-15', '2027-01-15'), 31);
  });
  test('ano bissexto', () => {
    assert.equal(daysBetween('2024-02-28', '2024-02-29'), 1);
    assert.equal(daysBetween('2024-02-29', '2024-03-01'), 1);
    assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2);
    assert.equal(daysBetween('2023-02-28', '2023-03-01'), 1);
    assert.equal(daysBetween('2024-01-01', '2025-01-01'), 366);
    assert.equal(daysBetween('2025-01-01', '2026-01-01'), 365);
  });
  test('exemplo oficial do projeto: 102 dias', () => {
    assert.equal(daysBetween('2026-10-05', '2027-01-15'), 102);
  });
  test('periodos longos (valores conhecidos)', () => {
    assert.equal(daysBetween('1900-01-01', '2000-01-01'), 36524);
    assert.equal(daysBetween('2000-01-01', '2001-01-01'), 366);
    assert.equal(daysBetween('1970-01-01', '2000-01-01'), 10957);
    assert.equal(daysBetween('0001-01-01', '9999-12-31'), 3652058);
    assert.equal(toEpochDay({ year: 1970, month: 1, day: 1 }), 0);
  });
  test('datas invalidas lancam erro', () => {
    assert.throws(() => daysBetween('2026-02-30', '2026-03-01'), InvalidDateError);
    assert.throws(() => daysBetween('2026-02-01', '2026-13-01'), InvalidDateError);
    assert.throws(() => daysBetween('', '2026-02-01'), InvalidDateError);
  });
});

describe('compareDates', () => {
  test('ordem', () => {
    assert.equal(compareDates('2026-01-01', '2026-01-01'), 0);
    assert.equal(compareDates('2026-01-01', '2026-01-02'), -1);
    assert.equal(compareDates('2026-02-01', '2026-01-31'), 1);
    assert.equal(compareDates('2025-12-31', '2026-01-01'), -1);
    assert.equal(compareDates('0999-12-31', '1000-01-01'), -1);
  });
  test('invalida lanca erro', () => {
    assert.throws(() => compareDates('2026-02-30', '2026-03-01'), InvalidDateError);
  });
});

describe('conferencia contra oraculo independente (Date UTC)', () => {
  test('todos os dias de 0001-01-01 a 9999-12-31: numero do dia e igual ao do oraculo', () => {
    const cursor = new Date(0);
    cursor.setUTCFullYear(MIN_YEAR, 0, 1);
    const end = new Date(0);
    end.setUTCFullYear(MAX_YEAR, 11, 31);
    let t = cursor.getTime();
    const last = end.getTime();
    const tmp = new Date(0);
    let count = 0;
    let previous: number | undefined;
    while (t <= last) {
      tmp.setTime(t);
      const y = tmp.getUTCFullYear(), m = tmp.getUTCMonth() + 1, d = tmp.getUTCDate();
      const ours = toEpochDay({ year: y, month: m, day: d });
      if (ours !== t / MS_PER_DAY) assert.fail(`divergencia em ${iso(y, m, d)}: ${ours} vs ${t / MS_PER_DAY}`);
      if (previous !== undefined && ours !== previous + 1) assert.fail(`salto em ${iso(y, m, d)}`);
      previous = ours;
      t += MS_PER_DAY;
      count++;
    }
    assert.equal(count, 3652059);
  });

  test('1900-2200 por texto: valida, parse/format em ida e volta e daysBetween de dias seguidos = 1', () => {
    let prev = '';
    let n = 0;
    for (let y = 1900; y <= 2200; y++) {
      for (let m = 1; m <= 12; m++) {
        for (let d = 1; d <= oracleDaysInMonth(y, m); d++) {
          const s = iso(y, m, d);
          if (!isValidDate(s) || formatDate(parseDate(s)) !== s) assert.fail(`ida e volta falhou: ${s}`);
          if (prev !== '' && daysBetween(prev, s) !== 1) assert.fail(`${prev} -> ${s} nao e 1 dia`);
          prev = s;
          n++;
        }
      }
    }
    assert.equal(n, oracleEpochDay(2200, 12, 31) - oracleEpochDay(1900, 1, 1) + 1);
  });

  test('todos os anos 1-9999: ultimo dia valido e ultimo dia + 1 invalido (igual ao oraculo)', () => {
    for (let y = MIN_YEAR; y <= MAX_YEAR; y++) {
      for (let m = 1; m <= 12; m++) {
        const dim = oracleDaysInMonth(y, m);
        if (daysInMonth(y, m) !== dim) assert.fail(`daysInMonth(${y},${m})`);
        if (!isValidDate(iso(y, m, dim))) assert.fail(`${iso(y, m, dim)} deveria ser valida`);
        if (dim < 31 && oracleIsReal(y, m, dim + 1)) assert.fail('oraculo inconsistente');
        const over = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(dim + 1)}`;
        if (isValidDate(over)) assert.fail(`${over} deveria ser invalida`);
      }
    }
  });

  test('diferenca entre pares espalhados bate com o oraculo', () => {
    const years = [1, 4, 100, 400, 1582, 1600, 1900, 1970, 2000, 2018, 2023, 2024, 2026, 2100, 2400, 9999];
    for (const y1 of years) for (const y2 of years) for (const [m1, d1] of [[1, 1], [2, 28], [3, 1], [12, 31]] as const) {
      for (const [m2, d2] of [[1, 31], [2, 28], [6, 15], [12, 31]] as const) {
        const a = iso(y1, m1, d1), b = iso(y2, m2, d2);
        assert.equal(daysBetween(a, b), oracleEpochDay(y2, m2, d2) - oracleEpochDay(y1, m1, d1), `${a} -> ${b}`);
      }
    }
  });
});
