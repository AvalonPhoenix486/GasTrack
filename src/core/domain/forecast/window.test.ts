// TESTES NOVOS (previsao): janela em dias, funcoes puras sobre numeros.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { halfWidth, toDayWindow, FLOOR_DAYS, InvalidForecastInputError } from './index.ts';
import { prng, randInt } from '../cycles/test-support.ts';
import { median, mad } from '../statistics/math.ts';

describe('halfWidth: h = max(1, MAD)', () => {
  test('piso de 1 dia quando MAD < 1', () => {
    assert.equal(FLOOR_DAYS, 1);
    assert.equal(halfWidth(0), 1);
    assert.equal(halfWidth(0.5), 1);
    assert.equal(halfWidth(1), 1);
  });
  test('MAD >= 1 prevalece e preserva fracao', () => {
    assert.equal(halfWidth(1.5), 1.5);
    assert.equal(halfWidth(7), 7);
    assert.equal(halfWidth(10), 10);
  });
  test('entrada invalida', () => {
    for (const v of [-1, -0.5, NaN, Infinity, '1', null, undefined] as unknown[]) {
      assert.throws(() => halfWidth(v as number), InvalidForecastInputError, String(v));
    }
  });
});

describe('toDayWindow: ceil(m - h), floor(m + h), floor(m)', () => {
  const cases: Array<[string, number, number, [number, number, number]]> = [
    ['mediana inteira, MAD 0', 28, 1, [27, 28, 29]],
    ['mediana x,5, h = 1', 28.5, 1, [28, 28, 29]],
    ['mediana inteira, MAD inteiro grande', 25, 10, [15, 25, 35]],
    ['mediana x,5, MAD inteiro (ceil e floor)', 31.5, 7, [25, 31, 38]],
    ['mediana inteira, MAD x,5 (h = 1,5)', 28, 1.5, [27, 28, 29]],
    ['mediana x,5, MAD x,5 (h = 2,5)', 28.5, 2.5, [26, 28, 31]],
    ['mediana 0', 0, 1, [0, 0, 1]],
    ['mediana 0,5: ceil(-0,5) seria -0', 0.5, 1, [0, 0, 1]],
    ['limite inferior truncado em 0', 2, 5, [0, 2, 7]],
    ['limite inferior exatamente 0', 3, 3, [0, 3, 6]],
  ];
  for (const [name, m, h, [lo, c, up]] of cases) {
    test(name, () => {
      const w = toDayWindow(m, h);
      assert.deepStrictEqual({ ...w }, { lowerDays: lo, centralDays: c, upperDays: up });
    });
  }

  test('ceil(m - h): borda x,5 sobe, borda inteira fica', () => {
    assert.equal(toDayWindow(31.5, 7).lowerDays, 25);   // 24,5 -> 25 (nao 24)
    assert.equal(toDayWindow(28, 3).lowerDays, 25);     // 25 exato
    assert.equal(toDayWindow(28.5, 2).lowerDays, 27);   // 26,5 -> 27
  });

  test('floor(m + h): borda x,5 desce, borda inteira fica', () => {
    assert.equal(toDayWindow(31.5, 7).upperDays, 38);   // 38,5 -> 38 (nao 39)
    assert.equal(toDayWindow(28, 3).upperDays, 31);
    assert.equal(toDayWindow(28.5, 2).upperDays, 30);   // 30,5 -> 30
  });

  test('dia central = floor(mediana): x,5 usa o dia anterior', () => {
    assert.equal(toDayWindow(28.5, 1).centralDays, 28);
    assert.equal(toDayWindow(0.5, 1).centralDays, 0);
    assert.equal(toDayWindow(28, 1).centralDays, 28);
  });

  test('nunca devolve -0, NaN ou Infinity', () => {
    for (const [m, h] of [[0, 1], [0.5, 1], [0, 5], [1, 1], [0.5, 2.5]] as const) {
      const w = toDayWindow(m, h);
      for (const v of [w.lowerDays, w.centralDays, w.upperDays]) {
        assert.equal(Number.isFinite(v), true);
        assert.equal(Object.is(v, -0), false, `${m},${h}`);
      }
    }
  });

  test('entrada invalida (inclusive h abaixo do piso)', () => {
    for (const [m, h] of [[-1, 1], [NaN, 1], [1, NaN], [1, Infinity], [Infinity, 1], [1, 0.5], [1, 0], [1, -1]] as const) {
      assert.throws(() => toDayWindow(m, h), InvalidForecastInputError, `${m},${h}`);
    }
    assert.throws(() => toDayWindow('1' as unknown as number, 1), InvalidForecastInputError);
  });

  test('propriedades sobre historicos aleatorios (n de 4 a 12)', () => {
    const rnd = prng(99);
    for (let it = 0; it < 3000; it++) {
      const n = randInt(rnd, 4, 12);
      const d = Array.from({ length: n }, () => randInt(rnd, 0, 45));
      const m = median(d);
      const h = halfWidth(mad(d));
      const w = toDayWindow(m, h);
      assert.ok(w.lowerDays <= w.centralDays && w.centralDays <= w.upperDays, JSON.stringify(d));
      assert.ok(w.lowerDays >= 0);
      assert.ok(w.upperDays - w.lowerDays >= 1);
      // a faixa e exatamente o conjunto dos inteiros d >= 0 com |d - m| <= h
      const brute: number[] = [];
      for (let x = 0; x <= 200; x++) if (Math.abs(x - m) <= h) brute.push(x);
      assert.deepEqual(brute, Array.from({ length: w.upperDays - w.lowerDays + 1 }, (_, i) => w.lowerDays + i), JSON.stringify(d));
      // contem ao menos metade dos ciclos observados
      const inside = d.filter((x) => x >= w.lowerDays && x <= w.upperDays).length;
      assert.ok(inside >= Math.ceil(n / 2), `${JSON.stringify(d)} ${inside}/${n}`);
      // n impar: tudo inteiro
      if (n % 2 === 1) assert.ok(Number.isInteger(m) && Number.isInteger(mad(d)));
    }
  });
});
