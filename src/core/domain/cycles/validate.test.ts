import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { InvalidDateError, InvalidDateRangeError } from '../dates/index.ts';
import { parseCycle, isValidCycleId, InvalidCycleError, isOpen } from './index.ts';

describe('parseCycle (registros vindos de fora)', () => {
  test('ciclo aberto valido', () => {
    const c = parseCycle({ id: 'c1', startDate: '2026-10-05', endDate: null });
    assert.deepEqual(c, { id: 'c1', startDate: '2026-10-05', endDate: null });
    assert.equal(isOpen(c), true);
    assert.equal(Object.isFrozen(c), true);
  });

  test('ciclo fechado valido, inclusive 0 dias', () => {
    assert.deepEqual(parseCycle({ id: 'c1', startDate: '2026-10-05', endDate: '2027-01-15' }), { id: 'c1', startDate: '2026-10-05', endDate: '2027-01-15' });
    assert.deepEqual(parseCycle({ id: 'c1', startDate: '2026-10-05', endDate: '2026-10-05' }).endDate, '2026-10-05');
  });

  test('devolve um novo objeto, sem alterar o recebido', () => {
    const raw = { id: 'c1', startDate: '2026-10-05', endDate: null };
    const parsed = parseCycle(raw);
    assert.notEqual(parsed, raw);
    assert.equal(Object.isFrozen(raw), false);
  });

  test('nao e objeto simples', () => {
    class Fake { id = 'c1'; startDate = '2026-10-05'; endDate = null; }
    for (const v of [null, undefined, 'c1', 1, true, [], [1], new Date(0), new Fake()]) {
      assert.throws(() => parseCycle(v), InvalidCycleError, String(v));
    }
  });

  test('campos faltando ou sobrando (inclusive status, preco, marca)', () => {
    const bad: unknown[] = [
      {}, { id: 'c1' }, { id: 'c1', startDate: '2026-10-05' },
      { startDate: '2026-10-05', endDate: null }, { id: 'c1', endDate: null },
      { id: 'c1', startDate: '2026-10-05', endDate: null, status: 'open' },
      { id: 'c1', startDate: '2026-10-05', endDate: null, price: 100 },
      { id: 'c1', startDate: '2026-10-05', endDate: null, brand: 'x' },
    ];
    for (const v of bad) assert.throws(() => parseCycle(v), InvalidCycleError, JSON.stringify(v));
  });

  test('ciclo sem data de inicio ou com inicio invalido', () => {
    for (const startDate of [undefined, null, '', '2026-02-30', 20261005, '2026-1-1']) {
      assert.throws(() => parseCycle({ id: 'c1', startDate, endDate: null }), InvalidDateError, String(startDate));
    }
  });

  test('ciclo fechado precisa de fim valido: undefined, vazio e invalido nao viram ciclo', () => {
    for (const endDate of [undefined, '', '2026-02-30', 20270115, '2027-1-15', false]) {
      assert.throws(() => parseCycle({ id: 'c1', startDate: '2026-10-05', endDate }), InvalidDateError, String(endDate));
    }
  });

  test('fim anterior ao inicio', () => {
    assert.throws(() => parseCycle({ id: 'c1', startDate: '2027-01-15', endDate: '2027-01-05' }), InvalidDateRangeError);
  });

  test('id invalido', () => {
    for (const id of [undefined, null, '', 'a b', 5, 'x'.repeat(65)]) {
      assert.throws(() => parseCycle({ id, startDate: '2026-10-05', endDate: null }), InvalidCycleError, String(id));
    }
  });
});

describe('isValidCycleId', () => {
  test('aceita e rejeita', () => {
    for (const ok of ['a', 'Z9', 'a-b_c', '123e4567-e89b-12d3-a456-426614174000', 'x'.repeat(64)]) assert.equal(isValidCycleId(ok), true, ok);
    for (const bad of ['', ' ', 'a b', 'a.b', 'a/b', 'a\n', 'ç', 'x'.repeat(65), null, undefined, 1, {}]) assert.equal(isValidCycleId(bad), false, String(bad));
  });
});
