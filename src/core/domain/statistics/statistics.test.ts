import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { closeCycle, createCycle } from '../cycles/index.ts';
import type { Cycle } from '../cycles/index.ts';
import {
  calculateStatistics, closedCycles, lastClosedCycles, InvalidStatisticsInputError,
} from './index.ts';
import type { DurationStatistics, DurationStatisticsWithData } from './index.ts';
import { closedFromDurations, makeOpen, shuffled, prng } from './test-support.ts';

function data(s: DurationStatistics): DurationStatisticsWithData {
  if (!s.hasData) throw new Error('esperava dados, veio "sem dados"');
  return s;
}
const NO_DATA = { hasData: false, count: 0 };
const ids = (cycles: readonly Cycle[]) => cycles.map((c) => c.id);

describe('casos basicos', () => {
  test('nenhum ciclo: resultado explicito de "sem dados", sem metricas inventadas', () => {
    const s = calculateStatistics([]);
    assert.deepEqual(s, NO_DATA);
    assert.equal(s.hasData, false);
    assert.equal(s.count, 0);
    assert.deepEqual(Object.keys(s).sort(), ['count', 'hasData']);
    for (const field of ['mean', 'median', 'min', 'max', 'range', 'mad', 'relativeMad', 'totalDays', 'distribution']) {
      assert.equal(field in s, false, `"${field}" nao deveria existir sem dados`);
    }
  });

  test('so ciclo aberto: tambem e "sem dados"', () => {
    assert.deepEqual(calculateStatistics([makeOpen('o', '2026-10-05')]), NO_DATA);
  });

  test('um ciclo fechado (45 dias)', () => {
    const s = data(calculateStatistics(closedFromDurations([45])));
    assert.deepEqual({ ...s, distribution: [...s.distribution] }, {
      hasData: true, count: 1, totalDays: 45, mean: 45, median: 45, min: 45, max: 45, range: 0, mad: 0,
      relativeMad: 0, distribution: [{ durationDays: 45, count: 1 }],
    });
  });

  test('dois ciclos (10 e 20)', () => {
    const s = data(calculateStatistics(closedFromDurations([10, 20])));
    assert.equal(s.count, 2);
    assert.equal(s.totalDays, 30);
    assert.equal(s.mean, 15);
    assert.equal(s.median, 15);
    assert.equal(s.min, 10);
    assert.equal(s.max, 20);
    assert.equal(s.range, 10);
    assert.equal(s.mad, 5);
    assert.equal(s.relativeMad, 5 / 15);
  });

  test('varios ciclos (60, 63, 58): 5 ciclos concluidos, soma, media sem arredondar', () => {
    const s = data(calculateStatistics(closedFromDurations([60, 63, 58])));
    assert.equal(s.count, 3);
    assert.equal(s.totalDays, 181);
    assert.equal(s.mean, 181 / 3);
    assert.ok(Math.abs(s.mean - 60.33) < 0.005);
    assert.notEqual(s.mean, Math.round(s.mean));
    assert.equal(s.median, 60);
    assert.equal(s.min, 58);
    assert.equal(s.max, 63);
    assert.equal(s.range, 5);
    assert.equal(s.mad, 2);
    assert.equal(s.relativeMad, 2 / 60);
  });

  test('contagem: 5 ciclos concluidos', () => {
    assert.equal(data(calculateStatistics(closedFromDurations([60, 63, 58, 61, 59]))).count, 5);
  });
});

describe('media', () => {
  for (const [values, expected] of [[[10], 10], [[10, 20], 15], [[10, 20, 30], 20], [[10, 20, 30, 40], 25]] as const) {
    test(`${values.join(', ')} -> ${expected}`, () => {
      assert.equal(data(calculateStatistics(closedFromDurations(values))).mean, expected);
    });
  }
});

describe('mediana (impar e par; nao vira inteiro)', () => {
  test('impar', () => {
    assert.equal(data(calculateStatistics(closedFromDurations([50, 60, 70]))).median, 60);
    assert.equal(data(calculateStatistics(closedFromDurations([70, 50, 60]))).median, 60);
  });
  test('par', () => {
    assert.equal(data(calculateStatistics(closedFromDurations([50, 60, 70, 80]))).median, 65);
    assert.equal(data(calculateStatistics(closedFromDurations([80, 50, 70, 60]))).median, 65);
  });
  test('par com resultado fracionario e preservado (meio dia)', () => {
    assert.equal(data(calculateStatistics(closedFromDurations([60, 61]))).median, 60.5);
    assert.equal(Number.isInteger(data(calculateStatistics(closedFromDurations([60, 61]))).median), false);
  });
});

describe('minimo, maximo e amplitude', () => {
  test('valores repetidos', () => {
    const s = data(calculateStatistics(closedFromDurations([30, 30, 30])));
    assert.equal(s.min, 30);
    assert.equal(s.max, 30);
  });
  test('valores diferentes e repetidos', () => {
    const s = data(calculateStatistics(closedFromDurations([30, 10, 30, 20, 10])));
    assert.equal(s.min, 10);
    assert.equal(s.max, 30);
    assert.equal(s.range, 20);
  });
  test('amplitude de 10, 10, 10 e 0', () => {
    const s = data(calculateStatistics(closedFromDurations([10, 10, 10])));
    assert.equal(s.range, 0);
    assert.equal(s.mad, 0);
    assert.equal(s.relativeMad, 0);
  });
});

describe('MAD e dispersao relativa', () => {
  test('50, 55, 60, 65, 100: mediana 60, desvios 10,5,0,5,40, MAD 5', () => {
    const s = data(calculateStatistics(closedFromDurations([50, 55, 60, 65, 100])));
    assert.equal(s.median, 60);
    assert.equal(s.mad, 5);
    assert.equal(s.relativeMad, 5 / 60);
  });

  test('um outlier muda a amplitude mas nao o MAD', () => {
    const a = data(calculateStatistics(closedFromDurations([50, 55, 60, 65, 100])));
    const b = data(calculateStatistics(closedFromDurations([50, 55, 60, 65, 1000])));
    assert.equal(a.mad, b.mad);
    assert.notEqual(a.range, b.range);
  });

  test('sem outlier', () => {
    const s = data(calculateStatistics(closedFromDurations([58, 60, 62])));
    assert.equal(s.mad, 2);
  });

  test('mediana 0: dispersao relativa nao definida (null), nunca 0 ou NaN', () => {
    const s = data(calculateStatistics(closedFromDurations([0, 0, 5])));
    assert.equal(s.median, 0);
    assert.equal(s.mad, 0);
    assert.equal(s.relativeMad, null);
  });
});

describe('duracao zero e dado real, nao ausencia de dado', () => {
  test('0, 10, 20 participa normalmente', () => {
    const s = data(calculateStatistics(closedFromDurations([0, 10, 20])));
    assert.equal(s.count, 3);
    assert.equal(s.totalDays, 30);
    assert.equal(s.mean, 10);
    assert.equal(s.median, 10);
    assert.equal(s.min, 0);
    assert.equal(s.max, 20);
    assert.equal(s.range, 20);
    assert.equal(s.mad, 10);
    assert.equal(s.relativeMad, 1);
    assert.deepEqual([...s.distribution], [
      { durationDays: 0, count: 1 }, { durationDays: 10, count: 1 }, { durationDays: 20, count: 1 },
    ]);
  });

  test('um unico ciclo de 0 dias: TEM dados (media 0, minimo 0), diferente de "sem dados"', () => {
    const zero = closeCycle(createCycle({ id: 'z', startDate: '2026-10-05' }), '2026-10-05');
    const s = calculateStatistics([zero]);
    assert.equal(s.hasData, true);
    const d = data(s);
    assert.equal(d.count, 1);
    assert.equal(d.totalDays, 0);
    assert.equal(d.mean, 0);
    assert.equal(d.median, 0);
    assert.equal(d.min, 0);
    assert.equal(d.max, 0);
    assert.equal(d.mad, 0);
    assert.equal(d.relativeMad, null);
    assert.notDeepEqual(s, calculateStatistics([]));
  });

  test('os dois casos sao distinguiveis pelo contrato', () => {
    const none = calculateStatistics([]);
    const zero = calculateStatistics(closedFromDurations([0]));
    assert.equal(none.hasData, false);
    assert.equal(zero.hasData, true);
    assert.equal('mean' in none, false);
    assert.equal('mean' in zero, true);
  });
});

describe('ciclo aberto nao entra na estatistica historica', () => {
  const closed = () => closedFromDurations([60, 63, 58, 70]);

  test('nao altera quantidade, media, mediana, minimo, maximo nem MAD (resultado identico)', () => {
    const without = data(calculateStatistics(closed()));
    const withOpen = data(calculateStatistics([...closed(), makeOpen('aberto', '2030-01-01')]));
    for (const key of ['count', 'totalDays', 'mean', 'median', 'min', 'max', 'range', 'mad', 'relativeMad'] as const) {
      assert.equal(withOpen[key], without[key], key);
    }
    assert.deepEqual(withOpen, without);
  });

  test('ciclo aberto misturado em qualquer posicao da lista', () => {
    const base = closed();
    const open = makeOpen('aberto', '2019-01-01');
    for (const list of [[open, ...base], [base[0] as Cycle, open, ...base.slice(1)], [...base, open]]) {
      assert.deepEqual(calculateStatistics(list), calculateStatistics(base));
    }
  });

  test('ciclo aberto tambem nao conta nas janelas dos ultimos N', () => {
    const base = closed();
    const stats = calculateStatistics([...base, makeOpen('aberto', '2030-01-01')], { lastN: 2 });
    assert.deepEqual(stats, calculateStatistics(base.slice(-2)));
    assert.deepEqual(ids(lastClosedCycles([...base, makeOpen('aberto', '2030-01-01')], 2)), ['c003', 'c004']);
  });
});

describe('ultimos N ciclos fechados', () => {
  const five = () => closedFromDurations([10, 20, 30, 40, 50]);   // c001..c005, em ordem cronologica

  test('N menor que a quantidade', () => {
    assert.deepEqual(ids(lastClosedCycles(five(), 3)), ['c003', 'c004', 'c005']);
    const s = data(calculateStatistics(five(), { lastN: 3 }));
    assert.equal(s.count, 3);
    assert.equal(s.mean, 40);
    assert.equal(s.median, 40);
    assert.equal(s.min, 30);
    assert.equal(s.max, 50);
    assert.equal(s.totalDays, 120);
  });

  test('N igual a quantidade', () => {
    assert.deepEqual(ids(lastClosedCycles(five(), 5)), ['c001', 'c002', 'c003', 'c004', 'c005']);
    assert.deepEqual(calculateStatistics(five(), { lastN: 5 }), calculateStatistics(five()));
  });

  test('N maior que a quantidade: devolve todos, nao e erro', () => {
    assert.deepEqual(ids(lastClosedCycles(five(), 99)), ['c001', 'c002', 'c003', 'c004', 'c005']);
    assert.deepEqual(calculateStatistics(five(), { lastN: 99 }), calculateStatistics(five()));
  });

  test('N = 0 seleciona NENHUM ciclo (lista vazia e resultado sem dados), nunca todos', () => {
    assert.deepEqual(lastClosedCycles(five(), 0), []);
    assert.deepEqual(calculateStatistics(five(), { lastN: 0 }), NO_DATA);
    assert.deepEqual(lastClosedCycles(five(), -0), []);
  });

  test('N = 1', () => {
    assert.deepEqual(ids(lastClosedCycles(five(), 1)), ['c005']);
    assert.equal(data(calculateStatistics(five(), { lastN: 1 })).mean, 50);
  });

  test('historico vazio', () => {
    assert.deepEqual(lastClosedCycles([], 3), []);
    assert.deepEqual(calculateStatistics([], { lastN: 3 }), NO_DATA);
    assert.deepEqual(calculateStatistics([], { lastN: 0 }), NO_DATA);
  });

  test('ciclos fora de ordem: vale a ordem cronologica, nao a de insercao', () => {
    const reversed = [...five()].reverse();
    assert.deepEqual(ids(lastClosedCycles(reversed, 3)), ['c003', 'c004', 'c005']);
    const rnd = prng(5);
    for (let i = 0; i < 20; i++) {
      assert.deepEqual(ids(lastClosedCycles(shuffled(five(), rnd), 2)), ['c004', 'c005']);
      assert.deepEqual(calculateStatistics(shuffled(five(), rnd), { lastN: 4 }), calculateStatistics(five(), { lastN: 4 }));
    }
  });

  test('closedCycles: so fechados, em ordem cronologica, sem alterar a entrada', () => {
    const input = [makeOpen('o', '2030-01-01'), ...[...five()].reverse()];
    const copy = [...input];
    assert.deepEqual(ids(closedCycles(input)), ['c001', 'c002', 'c003', 'c004', 'c005']);
    assert.deepEqual(input, copy);
  });

  test('janela recente vs. geral: comportamento recente diferente do historico', () => {
    const history = closedFromDurations([80, 78, 82, 60, 58, 59]);
    assert.equal(data(calculateStatistics(history)).median, 69);
    assert.equal(data(calculateStatistics(history, { lastN: 3 })).median, 59);
    assert.equal(data(calculateStatistics(history, { lastN: 3 })).mad, 1);
  });
});

describe('opcoes e entradas invalidas', () => {
  test('lastN invalido', () => {
    for (const bad of [-1, 1.5, NaN, Infinity, -Infinity, '3', null, {}, [], true]) {
      assert.throws(() => calculateStatistics(closedFromDurations([10]), { lastN: bad as never }), InvalidStatisticsInputError, String(bad));
      assert.throws(() => lastClosedCycles(closedFromDurations([10]), bad as never), InvalidStatisticsInputError, String(bad));
    }
  });
  test('lastN ausente ou undefined = todos', () => {
    assert.deepEqual(calculateStatistics(closedFromDurations([10, 20]), {}), calculateStatistics(closedFromDurations([10, 20]), { lastN: undefined }));
    assert.equal(data(calculateStatistics(closedFromDurations([10, 20]), {})).count, 2);
  });
  test('opcao desconhecida e opcoes que nao sao objeto', () => {
    assert.throws(() => calculateStatistics([], { days: 30 } as never), InvalidStatisticsInputError);
    assert.throws(() => calculateStatistics([], null as never), InvalidStatisticsInputError);
    assert.throws(() => calculateStatistics([], [] as never), InvalidStatisticsInputError);
    assert.throws(() => calculateStatistics([], 'x' as never), InvalidStatisticsInputError);
  });
  test('ciclos que nao sao lista', () => {
    for (const bad of [null, undefined, {}, 'x', 5]) {
      assert.throws(() => calculateStatistics(bad as never), InvalidStatisticsInputError, String(bad));
      assert.throws(() => closedCycles(bad as never), InvalidStatisticsInputError, String(bad));
    }
  });
  test('erro tem codigo', () => {
    try { calculateStatistics([], { lastN: -1 }); assert.fail('deveria lancar'); } catch (e) {
      if (!(e instanceof InvalidStatisticsInputError)) throw e;
      assert.equal(e.code, 'INVALID_STATISTICS_INPUT');
    }
  });
});

describe('distribuicao', () => {
  test('ordenada, sem repeticoes, com contagem', () => {
    const s = data(calculateStatistics(closedFromDurations([60, 45, 60, 52, 60, 52])));
    assert.deepEqual([...s.distribution], [
      { durationDays: 45, count: 1 }, { durationDays: 52, count: 2 }, { durationDays: 60, count: 3 },
    ]);
  });
  test('acompanha a janela de ultimos N', () => {
    const s = data(calculateStatistics(closedFromDurations([45, 52, 52, 60, 60, 60]), { lastN: 3 }));
    assert.deepEqual([...s.distribution], [{ durationDays: 60, count: 3 }]);
  });
});

describe('determinismo, imutabilidade e valores conhecidos', () => {
  test('mesma entrada, mesmo resultado (inclusive a serializacao)', () => {
    const input = closedFromDurations([61, 59, 71, 57, 64]);
    const a = calculateStatistics(input, { lastN: 4 });
    const b = calculateStatistics(input, { lastN: 4 });
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  test('a entrada nao e alterada', () => {
    const input: Cycle[] = [makeOpen('o', '2030-01-01'), ...[...closedFromDurations([61, 59, 71])].reverse()];
    const before = JSON.stringify(input);
    calculateStatistics(input);
    calculateStatistics(input, { lastN: 2 });
    lastClosedCycles(input, 1);
    assert.equal(JSON.stringify(input), before);
  });

  test('resultados congelados', () => {
    const s = data(calculateStatistics(closedFromDurations([61, 59])));
    assert.equal(Object.isFrozen(s), true);
    assert.equal(Object.isFrozen(s.distribution), true);
    assert.equal(Object.isFrozen(s.distribution[0]), true);
    assert.equal(Object.isFrozen(calculateStatistics([])), true);
    assert.throws(() => { (s as { mean: number }).mean = 0; }, TypeError);
  });

  // Valores calculados a mao com datas reais (nao pelo gerador de testes):
  //  a 2025-01-10 -> 2025-03-12 = 61 dias; b 2025-03-12 -> 2025-05-10 = 59; c 2025-05-10 -> 2025-07-20 = 71;
  //  d 2025-07-20 -> 2025-09-15 = 57; e aberto desde 2025-09-15.
  const real = (): Cycle[] => [
    makeOpen('e', '2025-09-15'),
    closeCycle(createCycle({ id: 'c', startDate: '2025-05-10' }), '2025-07-20'),
    closeCycle(createCycle({ id: 'a', startDate: '2025-01-10' }), '2025-03-12'),
    closeCycle(createCycle({ id: 'd', startDate: '2025-07-20' }), '2025-09-15'),
    closeCycle(createCycle({ id: 'b', startDate: '2025-03-12' }), '2025-05-10'),
  ];

  test('historico com datas reais (fora de ordem, com ciclo aberto): todas as metricas', () => {
    const s = data(calculateStatistics(real()));
    assert.deepEqual({ ...s, distribution: [...s.distribution] }, {
      hasData: true, count: 4, totalDays: 248, mean: 62, median: 60, min: 57, max: 71, range: 14, mad: 2,
      relativeMad: 2 / 60,
      distribution: [
        { durationDays: 57, count: 1 }, { durationDays: 59, count: 1 },
        { durationDays: 61, count: 1 }, { durationDays: 71, count: 1 },
      ],
    });
  });

  test('mesmos historico e janelas: ultimos 3 e ultimos 2', () => {
    const last3 = data(calculateStatistics(real(), { lastN: 3 }));
    assert.equal(last3.count, 3);
    assert.equal(last3.totalDays, 187);
    assert.equal(last3.mean, 187 / 3);
    assert.equal(last3.median, 59);
    assert.equal(last3.mad, 2);
    const last2 = data(calculateStatistics(real(), { lastN: 2 }));
    assert.equal(last2.mean, 64);
    assert.equal(last2.median, 64);
    assert.equal(last2.mad, 7);
  });
});
