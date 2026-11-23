import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  sum, mean, median, medianOfSorted, mad, sortedAscending, distributionOfSorted,
} from './math.ts';
import { InvalidStatisticsInputError } from './errors.ts';
import { prng, randInt, shuffled } from './test-support.ts';

describe('mediana', () => {
  test('quantidade impar', () => {
    assert.equal(median([50, 60, 70]), 60);
    assert.equal(median([7]), 7);
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([10, 10, 10, 10, 99]), 10);
  });

  test('quantidade par: media dos dois centrais, sem arredondar', () => {
    assert.equal(median([50, 60, 70, 80]), 65);
    assert.equal(median([10, 20]), 15);
    assert.equal(median([10, 21]), 15.5);
    assert.equal(median([1, 2, 4, 9]), 3);
    assert.equal(median([0, 1]), 0.5);
  });

  test('independe da ordem de entrada e nao altera a entrada', () => {
    const input = [80, 50, 70, 60];
    const copy = [...input];
    assert.equal(median(input), 65);
    assert.deepEqual(input, copy);
  });

  test('medianOfSorted usa a lista ja ordenada', () => {
    assert.equal(medianOfSorted([1, 2, 3, 100]), 2.5);
  });

  test('lista vazia e erro', () => {
    assert.throws(() => median([]), InvalidStatisticsInputError);
    assert.throws(() => mean([]), InvalidStatisticsInputError);
    assert.throws(() => mad([]), InvalidStatisticsInputError);
  });
});

describe('media e soma', () => {
  test('exemplos do enunciado', () => {
    assert.equal(mean([10]), 10);
    assert.equal(mean([10, 20]), 15);
    assert.equal(mean([10, 20, 30]), 20);
    assert.equal(mean([10, 20, 30, 40]), 25);
  });

  test('60, 63, 58: soma 181 e media 181/3 sem arredondar', () => {
    assert.equal(sum([60, 63, 58]), 181);
    assert.equal(mean([60, 63, 58]), 181 / 3);
    assert.notEqual(mean([60, 63, 58]), 60.33);
    assert.ok(Math.abs(mean([60, 63, 58]) - 60.33) < 0.005);
  });

  test('media nao e arredondada para inteiro', () => {
    assert.equal(mean([1, 2]), 1.5);
    assert.equal(mean([0, 0, 1]), 1 / 3);
  });
});

describe('MAD (desvio absoluto mediano, bruto)', () => {
  test('exemplo do enunciado: 50, 55, 60, 65, 100 -> mediana 60, desvios 10,5,0,5,40, MAD 5', () => {
    assert.equal(median([50, 55, 60, 65, 100]), 60);
    assert.equal(mad([50, 55, 60, 65, 100]), 5);
  });

  test('conjuntos simples', () => {
    assert.equal(mad([10, 10, 10]), 0);
    assert.equal(mad([5]), 0);
    assert.equal(mad([60, 63, 58]), 2);        // desvios de 60: 0, 3, 2 -> mediana 2
    assert.equal(mad([1, 2, 3, 4]), 1);        // mediana 2,5; desvios 1,5 0,5 0,5 1,5 -> 1
    assert.equal(mad([0, 10, 20]), 10);
  });

  test('mediana meio-inteira produz MAD exato em multiplos de 0,25', () => {
    assert.equal(mad([1, 2]), 0.5);
    assert.equal(mad([1, 2, 4]), 1);           // mediana 2; desvios 1,0,2 -> 1
    assert.equal(mad([0, 1, 1, 5]), 0.5 );      // mediana 1; desvios 1,0,0,4 -> 0,5
  });

  test('robusta a outlier: um valor extremo nao muda o MAD', () => {
    assert.equal(mad([50, 55, 60, 65, 100]), mad([50, 55, 60, 65, 1000]));
  });

  test('nao altera a entrada', () => {
    const input = [100, 50, 65, 55, 60];
    const copy = [...input];
    mad(input);
    assert.deepEqual(input, copy);
  });
});

describe('distribuicao', () => {
  test('agrupa, conta e ordena', () => {
    assert.deepEqual(distributionOfSorted(sortedAscending([60, 45, 60, 52, 60, 52])), [
      { durationDays: 45, count: 1 },
      { durationDays: 52, count: 2 },
      { durationDays: 60, count: 3 },
    ]);
    assert.deepEqual(distributionOfSorted([]), []);
    assert.deepEqual(distributionOfSorted([0, 0]), [{ durationDays: 0, count: 2 }]);
  });
});

/** Implementacoes independentes (outra tecnica) para conferir a oficial. */
function bruteMedian(values: number[]): number {
  const n = values.length;
  const kth = (k: number) => [...values].sort((a, b) => a - b)[k] as number;
  return n % 2 === 1 ? kth((n - 1) / 2) : (kth(n / 2 - 1) + kth(n / 2)) / 2;
}
function bruteMad(values: number[]): number {
  const m = bruteMedian(values);
  return bruteMedian(values.map((v) => (v > m ? v - m : m - v)));
}

describe('conferencia com implementacao independente e propriedades (semente fixa)', () => {
  test('1000 listas aleatorias: mediana, MAD e media exatas', () => {
    const rnd = prng(2024);
    for (let t = 0; t < 1000; t++) {
      const n = randInt(rnd, 1, 25);
      const values = Array.from({ length: n }, () => randInt(rnd, 0, 400));
      assert.equal(median(values), bruteMedian(values), `mediana ${values}`);
      assert.equal(mad(values), bruteMad(values), `MAD ${values}`);
      // media: quociente unico da soma exata (conferida com BigInt)
      const exactSum = values.reduce((acc, v) => acc + BigInt(v), 0n);
      assert.equal(sum(values), Number(exactSum));
      assert.equal(mean(values), Number(exactSum) / n);
    }
  });

  test('propriedades da mediana e do MAD', () => {
    const rnd = prng(77);
    for (let t = 0; t < 500; t++) {
      const n = randInt(rnd, 1, 20);
      const values = Array.from({ length: n }, () => randInt(rnd, 0, 300));
      const k = randInt(rnd, 1, 50);
      const c = randInt(rnd, 1, 7);
      // invariancia por permutacao
      assert.equal(median(shuffled(values, rnd)), median(values));
      assert.equal(mad(shuffled(values, rnd)), mad(values));
      // invariancia por translacao
      assert.equal(median(values.map((v) => v + k)), median(values) + k);
      assert.equal(mad(values.map((v) => v + k)), mad(values));
      // equivariancia por escala
      assert.equal(median(values.map((v) => v * c)), median(values) * c);
      assert.equal(mad(values.map((v) => v * c)), mad(values) * c);
      // limites
      const lo = Math.min(...values), hi = Math.max(...values);
      assert.ok(median(values) >= lo && median(values) <= hi);
      assert.ok(mad(values) >= 0 && mad(values) <= hi - lo);
    }
  });
});
