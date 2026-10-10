import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { daysBetween, calendarDuration } from './index.ts';
import { oracleAddDays, oracleEpochDay } from './test-support.ts';

/** Calculo INGENUO (o que NAO deve ser feito): horario local + floor. So existe nos testes. */
function naiveLocalDays(a: string, b: string): number {
  return Math.floor((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000);
}

const TZ = process.env.TZ;

// Deslocamento de 2026-01-01 (minutos, sinal de getTimezoneOffset) por fuso usado em test:tz.
const JAN_2026_OFFSET: Record<string, number> = {
  UTC: 0,
  'America/Sao_Paulo': 180,
  'America/New_York': 300,
  'Europe/London': 0,
  'Asia/Kolkata': -330,
  'Pacific/Kiritimati': -840,
  'Pacific/Pago_Pago': 660,
  'Pacific/Auckland': -780,
};

describe('fuso horario', () => {
  test(`o TZ do processo (${TZ ?? 'nao definido'}) realmente esta em vigor`, { skip: TZ === undefined || !(TZ in JAN_2026_OFFSET) }, () => {
    assert.equal(new Date(2026, 0, 1).getTimezoneOffset(), JAN_2026_OFFSET[TZ as string]);
  });

  test('REGRESSAO 2018-10-31 -> 2018-11-10 = 10 dias (qualquer fuso)', () => {
    assert.equal(daysBetween('2018-10-31', '2018-11-10'), 10);
    const r = calendarDuration('2018-10-31', '2018-11-10');
    assert.equal(r.totalDays, 10);
    assert.equal(r.days, 10);
  });

  test('o bug ingenuo e reproduzido em America/Sao_Paulo (9 em vez de 10)', { skip: TZ !== 'America/Sao_Paulo' }, () => {
    assert.equal(naiveLocalDays('2018-10-31', '2018-11-10'), 9);
    assert.equal(daysBetween('2018-10-31', '2018-11-10'), 10);
  });

  test('em UTC o calculo ingenuo coincide (confirma que o problema e do fuso)', { skip: TZ !== 'UTC' }, () => {
    assert.equal(naiveLocalDays('2018-10-31', '2018-11-10'), 10);
  });

  test('dias consecutivos de 2010-01-01 a 2030-12-31 sempre valem 1 (cobre todas as viradas de horario de verao)', () => {
    let prev = '2010-01-01';
    let n = 0;
    while (prev < '2030-12-31') {
      const next = oracleAddDays(prev, 1);
      if (daysBetween(prev, next) !== 1) assert.fail(`${prev} -> ${next}`);
      prev = next;
      n++;
    }
    assert.equal(n, oracleEpochDay(2030, 12, 31) - oracleEpochDay(2010, 1, 1));
  });

  test('datas de transicao conhecidas de varios fusos', () => {
    const pairs: ReadonlyArray<readonly [string, string, number]> = [
      ['2018-11-03', '2018-11-05', 2],   // Sao Paulo: inicio do horario de verao (00:00 pulou para 01:00)
      ['2019-02-16', '2019-02-18', 2],   // Sao Paulo: fim do horario de verao
      ['2026-03-07', '2026-03-09', 2],   // Nova York: inicio
      ['2026-10-31', '2026-11-02', 2],   // Nova York: fim
      ['2026-09-26', '2026-09-28', 2],   // Auckland: inicio
      ['2026-04-04', '2026-04-06', 2],   // Auckland: fim
      ['2011-12-29', '2011-12-31', 2],   // Samoa pulou 30/12/2011 no calendario local
      ['2018-10-31', '2018-11-10', 10],
    ];
    for (const [a, b, n] of pairs) assert.equal(daysBetween(a, b), n, `${a} -> ${b}`);
  });
});
