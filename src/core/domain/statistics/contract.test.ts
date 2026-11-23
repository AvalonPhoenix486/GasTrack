// TESTES NOVOS da etapa de reconstrucao de Statistics (R8). NAO fazem parte dos arquivos
// recuperados da evidencia R3 e nao sao testes originais recuperados. Cobrem as decisoes
// matematicas aprovadas (lastN = 0, MAD bruto, relativeMad) e propriedades com semente.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { historyFromCycles, listCycles, closeCycle, createCycle } from '../cycles/index.ts';
import type { Cycle } from '../cycles/index.ts';
import { calculateStatistics, closedCycles, lastClosedCycles, InvalidStatisticsInputError } from './index.ts';
import type { DurationStatistics, DurationStatisticsWithData } from './index.ts';
import { addDays, closedFromDurations, makeOpen, prng, randInt, shuffled } from './test-support.ts';

function data(s: DurationStatistics): DurationStatisticsWithData {
  if (!s.hasData) throw new Error('esperava dados');
  return s;
}

/** Historico VALIDO (PD-001/D021): ciclos separados por >= 1 dia, aberto so depois dos fechados. */
function validHistory(durations: readonly number[], withOpen: boolean): readonly Cycle[] {
  const closed = closedFromDurations(durations, { gap: 1 });
  const cycles: Cycle[] = [...closed];
  if (withOpen) {
    const last = closed[closed.length - 1];
    cycles.push(makeOpen('open', addDays(last ? (last.endDate as string) : '2020-01-01', 5)));
  }
  return listCycles(historyFromCycles(cycles));
}

describe('lastN = 0 (decisao aprovada): colecao vazia, sem erro', () => {
  test('lastClosedCycles(.., 0) devolve lista vazia, com e sem ciclos', () => {
    assert.deepEqual(lastClosedCycles(closedFromDurations([10, 20, 30]), 0), []);
    assert.deepEqual(lastClosedCycles([], 0), []);
    assert.deepEqual(lastClosedCycles([makeOpen('a', '2026-01-01')], 0), []);
  });
  test('calculateStatistics com lastN 0: "sem dados", sem lancar e sem metricas', () => {
    for (const cycles of [closedFromDurations([10, 20, 30]), [], validHistory([5, 6], true)]) {
      const s = calculateStatistics(cycles, { lastN: 0 });
      assert.deepEqual(s, { hasData: false, count: 0 });
      assert.equal('mean' in s, false);
    }
  });
  test('lastN 0 nunca vira "todos" (armadilha de slice(-0))', () => {
    assert.equal(lastClosedCycles(closedFromDurations([1, 2, 3, 4]), 0).length, 0);
    assert.equal(lastClosedCycles(closedFromDurations([1, 2, 3, 4]), 1).length, 1);
  });
  test('valores invalidos continuam rejeitados (convencao historica)', () => {
    for (const bad of [-1, 1.5, Number.NaN, Infinity, '2', null]) {
      assert.throws(() => calculateStatistics(closedFromDurations([1]), { lastN: bad as never }), InvalidStatisticsInputError, String(bad));
    }
  });
});

describe('MAD bruto (sem fator 1,4826)', () => {
  test('50, 55, 60, 65, 100: MAD exatamente 5 (nao 7,413)', () => {
    const s = data(calculateStatistics(closedFromDurations([50, 55, 60, 65, 100])));
    assert.equal(s.median, 60);
    assert.equal(s.mad, 5);
    assert.notEqual(s.mad, 5 * 1.4826);
  });
  test('quantidade par: mediana meio-inteira e MAD exatos', () => {
    // 10, 20, 30, 40: mediana 25; desvios 15, 5, 5, 15; mediana dos desvios = 10
    const s = data(calculateStatistics(closedFromDurations([10, 20, 30, 40])));
    assert.equal(s.median, 25);
    assert.equal(s.mad, 10);
    assert.equal(s.relativeMad, 10 / 25);
  });
  test('quantidade impar e um unico valor', () => {
    const odd = data(calculateStatistics(closedFromDurations([7, 9, 30])));
    assert.equal(odd.median, 9);
    assert.equal(odd.mad, 2); // desvios 2, 0, 21 -> mediana 2
    const one = data(calculateStatistics(closedFromDurations([42])));
    assert.equal(one.count, 1);
    assert.equal(one.median, 42);
    assert.equal(one.mad, 0);
    assert.equal(one.relativeMad, 0);
  });
});

describe('relativeMad = MAD / mediana, sem arredondar', () => {
  test('igual ao quociente IEEE de mad por median, bit a bit', () => {
    for (const d of [[60, 63, 58], [61, 59, 71, 57], [1, 2, 2, 9], [100, 101, 103, 1000, 7]]) {
      const s = data(calculateStatistics(closedFromDurations(d)));
      assert.equal(s.relativeMad, s.mad / s.median);
    }
  });
  test('nao e arredondado: 1/3 permanece 1/3', () => {
    // 29, 30, 31 mediana 30; desvios 1, 0, 1 -> MAD 1; 1/30 e dizima
    const s = data(calculateStatistics(closedFromDurations([29, 30, 31])));
    assert.equal(s.relativeMad, 1 / 30);
    assert.notEqual(s.relativeMad, 0.0333);
  });
  test('mediana zero: null; nunca NaN nem Infinity', () => {
    for (const d of [[0], [0, 0, 0], [0, 0, 5], [0, 0, 0, 9]]) {
      const s = data(calculateStatistics(closedFromDurations(d, { gap: 1 })));
      assert.equal(s.median, 0, JSON.stringify(d));
      assert.equal(s.relativeMad, null, JSON.stringify(d));
    }
  });
  test('sem dados: nenhum campo numerico existe (nada de NaN)', () => {
    const s = calculateStatistics([]);
    assert.deepEqual(Object.keys(s).sort(), ['count', 'hasData']);
  });
});

describe('precisao numerica: nenhum arredondamento prematuro', () => {
  test('media e o quociente unico totalDays / count', () => {
    for (const d of [[1, 2, 2], [60, 63, 58], [7, 7, 8, 8, 9, 100]]) {
      const s = data(calculateStatistics(closedFromDurations(d)));
      assert.equal(s.mean, s.totalDays / s.count);
    }
    assert.equal(data(calculateStatistics(closedFromDurations([1, 2, 2]))).mean, 5 / 3);
  });
  test('duracoes grandes (anos) sao exatas', () => {
    const s = data(calculateStatistics(closedFromDurations([3650, 3651, 7300])));
    assert.equal(s.totalDays, 14601);
    assert.equal(s.median, 3651);
    assert.equal(s.mad, 1);
  });
});

describe('inclusao: so ciclos fechados (historico valido sob PD-001)', () => {
  test('ciclo aberto valido no fim do historico nao altera nada', () => {
    const durations = [30, 31, 29, 45];
    const without = calculateStatistics(validHistory(durations, false));
    const withOpen = calculateStatistics(validHistory(durations, true));
    assert.deepEqual(withOpen, without);
    assert.equal(data(withOpen).count, 4);
  });
  test('janela dos ultimos N num historico valido com aberto', () => {
    const h = validHistory([10, 20, 30, 40], true);
    const s = data(calculateStatistics(h, { lastN: 2 }));
    assert.deepEqual([s.count, s.totalDays, s.median, s.min, s.max], [2, 70, 35, 30, 40]);
    assert.deepEqual(closedCycles(h).map((c) => c.id), ['c001', 'c002', 'c003', 'c004']);
  });
  test('ciclo de zero dia em historico valido participa', () => {
    const h = validHistory([10, 0, 20], false);
    const s = data(calculateStatistics(h));
    assert.deepEqual([s.count, s.min, s.max, s.median], [3, 0, 20, 10]);
  });
});

describe('propriedades com semente fixa (sem Math.random nem relogio)', () => {
  const orderStat = (xs: number[], k: number) => [...xs].sort((a, b) => a - b)[k] as number;

  test('600 historicos aleatorios: invariantes das metricas, finitude e independencia de ordem', () => {
    for (let seed = 1; seed <= 600; seed++) {
      const rnd = prng(seed);
      const n = randInt(rnd, 1, 14);
      const durations = Array.from({ length: n }, () => randInt(rnd, 0, 400));
      const cycles = closedFromDurations(durations, { gap: 1 });
      const s = data(calculateStatistics(cycles));
      assert.equal(s.count, n);
      assert.ok(s.min <= s.median && s.median <= s.max, `ordem min/mediana/max (seed ${seed})`);
      assert.equal(s.range, s.max - s.min);
      assert.ok(s.mad >= 0 && s.mad <= s.range, `MAD em [0, amplitude] (seed ${seed})`);
      assert.equal(s.totalDays, durations.reduce((a, b) => a + b, 0));
      assert.equal(s.distribution.reduce((a, e) => a + e.count, 0), n);
      for (const v of [s.totalDays, s.mean, s.median, s.min, s.max, s.range, s.mad]) assert.ok(Number.isFinite(v));
      assert.ok(s.relativeMad === null ? s.median === 0 : Number.isFinite(s.relativeMad));
      // mediana conferida por estatistica de ordem, independente da implementacao
      const expectedMedian = n % 2 === 1 ? orderStat(durations, (n - 1) / 2) : (orderStat(durations, n / 2 - 1) + orderStat(durations, n / 2)) / 2;
      assert.equal(s.median, expectedMedian);
      // ordem de insercao irrelevante
      assert.deepEqual(calculateStatistics(shuffled(cycles, rnd)), s);
    }
  });

  test('janela lastN confere com recalculo independente da cauda cronologica', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rnd = prng(seed * 7919);
      const n = randInt(rnd, 1, 12);
      const durations = Array.from({ length: n }, () => randInt(rnd, 0, 200));
      const cycles = shuffled(closedFromDurations(durations, { gap: 1 }), rnd);
      const k = randInt(rnd, 0, n + 3);
      const tail = durations.slice(Math.max(0, n - k)); // k = 0 -> slice(n) vazio
      const got = calculateStatistics(cycles, { lastN: k });
      if (tail.length === 0) assert.deepEqual(got, { hasData: false, count: 0 });
      else assert.deepEqual(got, calculateStatistics(closedFromDurations(tail, { gap: 1, start: '2031-01-01' })));
    }
  });
});

describe('contrato de entrada e imutabilidade', () => {
  test('a entrada nao e alterada e o resultado e congelado', () => {
    const cycles = closedFromDurations([5, 6, 7]);
    const before = JSON.stringify(cycles);
    const s = calculateStatistics(cycles, { lastN: 2 });
    assert.equal(JSON.stringify(cycles), before);
    assert.ok(Object.isFrozen(s));
  });
  test('ciclo recriado a partir de createCycle/closeCycle tem o mesmo resultado', () => {
    const c = closeCycle(createCycle({ id: 'x', startDate: '2026-10-05' }), '2027-01-15');
    assert.equal(data(calculateStatistics([c])).median, 102);
  });
});
