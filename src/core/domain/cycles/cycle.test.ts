import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDuration, InvalidDateError, InvalidDateRangeError } from '../dates/index.ts';
import {
  createCycle, closeCycle, editCycle, cycleDuration, isOpen, isClosed, cycleStatus,
  InvalidCycleError, CycleStateError, MissingReferenceDateError,
} from './index.ts';
import type { Cycle } from './index.ts';
import { makeClosed, makeOpen } from './test-support.ts';

describe('criacao', () => {
  test('criacao valida: ciclo aberto, sem data de fim', () => {
    const c = createCycle({ id: 'c1', startDate: '2026-10-05' });
    assert.deepEqual(c, { id: 'c1', startDate: '2026-10-05', endDate: null });
    assert.equal(c.endDate, null);
  });

  test('ciclo recem-criado esta aberto', () => {
    const c = createCycle({ id: 'c1', startDate: '2026-10-05' });
    assert.equal(isOpen(c), true);
    assert.equal(isClosed(c), false);
    assert.equal(cycleStatus(c), 'open');
  });

  test('o objeto e pequeno: so id, startDate e endDate', () => {
    assert.deepEqual(Object.keys(createCycle({ id: 'c1', startDate: '2026-10-05' })).sort(), ['endDate', 'id', 'startDate']);
  });

  test('datas invalidas sao rejeitadas', () => {
    for (const startDate of ['2026-02-30', '2026-13-01', '2026-1-1', '', '05/10/2026', '2026-10-05T00:00:00']) {
      assert.throws(() => createCycle({ id: 'c1', startDate }), InvalidDateError, startDate);
    }
    assert.throws(() => createCycle({ id: 'c1', startDate: null as unknown as string }), InvalidDateError);
    assert.throws(() => createCycle({ id: 'c1', startDate: 20261005 as unknown as string }), InvalidDateError);
  });

  test('ids invalidos sao rejeitados', () => {
    for (const id of ['', ' ', 'a b', ' a', 'a ', 'ã', 'a/b', 'x'.repeat(65), null, undefined, 1, {}]) {
      assert.throws(() => createCycle({ id: id as unknown as string, startDate: '2026-10-05' }), InvalidCycleError, String(id));
    }
  });

  test('ids validos: UUID, curtos, com - e _, 64 caracteres', () => {
    for (const id of ['c1', 'a', '123e4567-e89b-12d3-a456-426614174000', 'ciclo_1', 'A-B_c', 'x'.repeat(64)]) {
      assert.equal(createCycle({ id, startDate: '2026-10-05' }).id, id);
    }
  });

  test('ids distintos produzem ciclos distintos', () => {
    const a = createCycle({ id: 'a', startDate: '2026-10-05' });
    const b = createCycle({ id: 'b', startDate: '2026-10-05' });
    assert.notEqual(a.id, b.id);
    assert.notDeepEqual(a, b);
  });

  test('o ciclo e imutavel (congelado)', () => {
    const c = createCycle({ id: 'c1', startDate: '2026-10-05' });
    assert.equal(Object.isFrozen(c), true);
    assert.throws(() => { (c as { endDate: string | null }).endDate = '2026-11-01'; }, TypeError);
    assert.throws(() => { (c as { startDate: string }).startDate = '2026-01-01'; }, TypeError);
  });
});

describe('fechamento', () => {
  test('fechamento valido', () => {
    const closed = closeCycle(makeOpen('c1', '2026-10-05'), '2027-01-15');
    assert.deepEqual(closed, { id: 'c1', startDate: '2026-10-05', endDate: '2027-01-15' });
    assert.equal(isClosed(closed), true);
    assert.equal(cycleStatus(closed), 'closed');
  });

  test('fechamento no mesmo dia e permitido (0 dias)', () => {
    const closed = closeCycle(makeOpen('c1', '2026-10-05'), '2026-10-05');
    assert.equal(closed.endDate, '2026-10-05');
    assert.equal(cycleDuration(closed).totalDays, 0);
  });

  test('fechamento antes do inicio e rejeitado', () => {
    assert.throws(() => closeCycle(makeOpen('c1', '2027-01-15'), '2027-01-05'), InvalidDateRangeError);
    assert.throws(() => closeCycle(makeOpen('c1', '2026-10-05'), '2026-10-04'), InvalidDateRangeError);
  });

  test('data de fim invalida e rejeitada', () => {
    for (const end of ['2026-02-30', '', '2026-1-1', 'ontem']) {
      assert.throws(() => closeCycle(makeOpen('c1', '2026-01-01'), end), InvalidDateError, end);
    }
    assert.throws(() => closeCycle(makeOpen('c1', '2026-01-01'), undefined as unknown as string), InvalidDateError);
    assert.throws(() => closeCycle(makeOpen('c1', '2026-01-01'), null as unknown as string), InvalidDateError);
  });

  test('fechar um ciclo ja fechado e rejeitado', () => {
    const closed = makeClosed('c1', '2026-10-05', '2027-01-15');
    assert.throws(() => closeCycle(closed as never, '2027-02-01'), CycleStateError);
  });

  test('fechamento preserva a identidade e o inicio', () => {
    const open = makeOpen('meu-id', '2026-10-05');
    const closed = closeCycle(open, '2026-12-01');
    assert.equal(closed.id, 'meu-id');
    assert.equal(closed.startDate, '2026-10-05');
  });

  test('fechamento remove o estado aberto e nao altera o ciclo original', () => {
    const open = makeOpen('c1', '2026-10-05');
    const closed = closeCycle(open, '2026-12-01');
    assert.equal(isOpen(closed), false);
    assert.equal(closed.endDate, '2026-12-01');
    assert.equal(open.endDate, null);
    assert.equal(isOpen(open), true);
    assert.notEqual(open, closed);
  });

  test('fechar devolve UM ciclo: nao cria o proximo automaticamente', () => {
    const result: unknown = closeCycle(makeOpen('c1', '2026-10-05'), '2026-12-01');
    assert.equal(Array.isArray(result), false);
    assert.equal((result as Cycle).id, 'c1');
  });
});

type Expected = { totalDays: number; months: number; days: number; representation: 'months-days' | 'days-only' };
const MD = 'months-days' as const;
const DO = 'days-only' as const;

describe('duracao de ciclo fechado', () => {
  const table: ReadonlyArray<readonly [string, string, string, Expected]> = [
    ['0 dias', '2026-05-10', '2026-05-10', { totalDays: 0, months: 0, days: 0, representation: DO }],
    ['1 dia', '2026-05-10', '2026-05-11', { totalDays: 1, months: 0, days: 1, representation: DO }],
    ['varios dias', '2026-05-10', '2026-05-25', { totalDays: 15, months: 0, days: 15, representation: DO }],
    ['virada de mes (1 dia)', '2026-03-31', '2026-04-01', { totalDays: 1, months: 0, days: 1, representation: DO }],
    ['virada de mes (1 mes)', '2026-03-15', '2026-04-15', { totalDays: 31, months: 1, days: 0, representation: MD }],
    ['virada de ano (1 dia)', '2026-12-31', '2027-01-01', { totalDays: 1, months: 0, days: 1, representation: DO }],
    ['virada de ano (1 mes)', '2026-12-15', '2027-01-15', { totalDays: 31, months: 1, days: 0, representation: MD }],
    ['bissexto 28/02 -> 01/03', '2024-02-28', '2024-03-01', { totalDays: 2, months: 0, days: 2, representation: DO }],
    ['nao bissexto 28/02 -> 01/03', '2023-02-28', '2023-03-01', { totalDays: 1, months: 0, days: 1, representation: DO }],
    ['bissexto 29/02 -> 01/03', '2024-02-29', '2024-03-01', { totalDays: 1, months: 0, days: 1, representation: DO }],
    ['bissexto 28/02 -> 29/02', '2024-02-28', '2024-02-29', { totalDays: 1, months: 0, days: 1, representation: DO }],
    ['exemplo oficial', '2026-10-05', '2027-01-15', { totalDays: 102, months: 3, days: 10, representation: MD }],
    ['borda 31/01 -> 01/02', '2026-01-31', '2026-02-01', { totalDays: 1, months: 0, days: 1, representation: DO }],
    ['borda 31/01 -> 01/03 (nunca "1 mes e 1 dia")', '2026-01-31', '2026-03-01', { totalDays: 29, months: 0, days: 29, representation: DO }],
    ['borda 31/12 -> 01/01', '2026-12-31', '2027-01-01', { totalDays: 1, months: 0, days: 1, representation: DO }],
  ];

  for (const [name, start, end, expected] of table) {
    test(name, () => {
      const duration = cycleDuration(makeClosed('c1', start, end));
      assert.deepEqual({ ...duration }, expected);
      // Invariante 7: exatamente o resultado do dominio de datas.
      assert.deepEqual(duration, calendarDuration(start, end));
    });
  }

  test('duracao de ciclo fechado nunca e negativa', () => {
    for (const [, start, end] of table) assert.ok(cycleDuration(makeClosed('c', start, end)).totalDays >= 0);
  });

  test('ciclo fechado ignora a data de referencia', () => {
    const closed = makeClosed('c1', '2026-10-05', '2027-01-15');
    assert.deepEqual(cycleDuration(closed, '2030-01-01'), cycleDuration(closed));
    assert.deepEqual(cycleDuration(closed, '2000-01-01'), cycleDuration(closed));
  });
});

describe('duracao de ciclo aberto (data de referencia fornecida pelo chamador)', () => {
  test('inicio 05/10/2026, referencia 20/11/2026 = 46 dias (1 mes e 15 dias)', () => {
    const d = cycleDuration(makeOpen('c1', '2026-10-05'), '2026-11-20');
    assert.deepEqual({ ...d }, { totalDays: 46, months: 1, days: 15, representation: MD });
  });

  test('ciclo iniciado "hoje" (referencia = inicio) dura 0 dias', () => {
    const d = cycleDuration(makeOpen('c1', '2026-10-05'), '2026-10-05');
    assert.deepEqual({ ...d }, { totalDays: 0, months: 0, days: 0, representation: DO });
  });

  test('o resultado e o do dominio de datas', () => {
    const d = cycleDuration(makeOpen('c1', '2026-10-05'), '2027-01-15');
    assert.deepEqual(d, calendarDuration('2026-10-05', '2027-01-15'));
    assert.equal(d.totalDays, 102);
  });

  test('bordas com ciclo aberto', () => {
    assert.equal(cycleDuration(makeOpen('c', '2026-01-31'), '2026-03-01').totalDays, 29);
    assert.equal(cycleDuration(makeOpen('c', '2026-01-31'), '2026-03-01').representation, 'days-only');
    assert.equal(cycleDuration(makeOpen('c', '2024-02-29'), '2024-03-01').totalDays, 1);
    assert.equal(cycleDuration(makeOpen('c', '2026-12-31'), '2027-01-01').totalDays, 1);
  });

  test('sem data de referencia: erro (o dominio nao consulta o relogio)', () => {
    assert.throws(() => cycleDuration(makeOpen('c1', '2026-10-05')), MissingReferenceDateError);
    assert.throws(() => cycleDuration(makeOpen('c1', '2026-10-05'), undefined), MissingReferenceDateError);
  });

  test('referencia anterior ao inicio e rejeitada (invariante 4)', () => {
    assert.throws(() => cycleDuration(makeOpen('c1', '2026-10-05'), '2026-10-04'), InvalidDateRangeError);
    assert.throws(() => cycleDuration(makeOpen('c1', '2026-10-05'), '2020-01-01'), InvalidDateRangeError);
  });

  test('referencia invalida e rejeitada', () => {
    for (const ref of ['2026-02-30', '', 'hoje', null]) {
      assert.throws(() => cycleDuration(makeOpen('c1', '2026-10-05'), ref as unknown as string), InvalidDateError, String(ref));
    }
  });
});

describe('edicao', () => {
  const closed = () => makeClosed('c1', '2026-10-05', '2027-01-15');

  test('editar o inicio (05/10 -> 06/10)', () => {
    const edited = editCycle(closed(), { startDate: '2026-10-06' });
    assert.deepEqual(edited, { id: 'c1', startDate: '2026-10-06', endDate: '2027-01-15' });
    assert.equal(cycleDuration(edited as never).totalDays, 101);
  });

  test('editar o fim', () => {
    const edited = editCycle(closed(), { endDate: '2027-01-20' });
    assert.deepEqual(edited, { id: 'c1', startDate: '2026-10-05', endDate: '2027-01-20' });
    assert.equal(cycleDuration(edited as never).totalDays, 107);
  });

  test('editar inicio e fim juntos', () => {
    const edited = editCycle(closed(), { startDate: '2026-11-01', endDate: '2026-12-01' });
    assert.deepEqual(edited, { id: 'c1', startDate: '2026-11-01', endDate: '2026-12-01' });
    assert.equal(cycleDuration(edited as never).totalDays, 30);
  });

  test('inicio e fim podem ficar iguais (0 dias)', () => {
    const edited = editCycle(closed(), { startDate: '2027-01-15' });
    assert.equal(cycleDuration(edited as never).totalDays, 0);
  });

  test('editar o inicio de um ciclo aberto o mantem aberto', () => {
    const edited = editCycle(makeOpen('c1', '2026-10-05'), { startDate: '2026-10-01' });
    assert.deepEqual(edited, { id: 'c1', startDate: '2026-10-01', endDate: null });
    assert.equal(isOpen(edited), true);
  });

  test('dar endDate a um ciclo aberto o transforma em fechado', () => {
    const edited = editCycle(makeOpen('c1', '2026-10-05'), { endDate: '2027-01-15' });
    assert.deepEqual(edited, { id: 'c1', startDate: '2026-10-05', endDate: '2027-01-15' });
    assert.equal(isClosed(edited), true);
    assert.deepEqual(cycleDuration(edited as never), calendarDuration('2026-10-05', '2027-01-15'));
  });

  test('sem alteracoes: copia igual; campos undefined nao mudam nada', () => {
    assert.deepEqual(editCycle(closed(), {}), closed());
    assert.deepEqual(editCycle(closed(), { startDate: undefined, endDate: undefined }), closed());
  });

  test('datas invalidas sao rejeitadas', () => {
    for (const bad of ['2026-02-30', '', '2026-1-1', 'x']) {
      assert.throws(() => editCycle(closed(), { startDate: bad }), InvalidDateError, bad);
      assert.throws(() => editCycle(closed(), { endDate: bad }), InvalidDateError, bad);
    }
    assert.throws(() => editCycle(closed(), { startDate: 20261005 as unknown as string }), InvalidDateError);
  });

  test('fim anterior ao inicio e rejeitado (20/01 -> 15/01)', () => {
    assert.throws(() => editCycle(closed(), { startDate: '2027-01-20' }), InvalidDateRangeError);
    assert.throws(() => editCycle(closed(), { endDate: '2026-10-04' }), InvalidDateRangeError);
    assert.throws(() => editCycle(closed(), { startDate: '2027-02-01', endDate: '2027-01-31' }), InvalidDateRangeError);
    assert.throws(() => editCycle(makeOpen('c1', '2026-10-05'), { endDate: '2026-10-04' }), InvalidDateRangeError);
  });

  test('preserva a identidade', () => {
    assert.equal(editCycle(closed(), { startDate: '2026-10-06' }).id, 'c1');
    assert.equal(editCycle(makeOpen('zzz', '2026-10-05'), { endDate: '2026-10-06' }).id, 'zzz');
  });

  test('o id e outros campos nao sao editaveis', () => {
    for (const changes of [{ id: 'outro' }, { status: 'closed' }, { price: 10 }, { startDate: '2026-10-06', brand: 'x' }]) {
      assert.throws(() => editCycle(closed(), changes as never), InvalidCycleError, JSON.stringify(changes));
    }
    assert.throws(() => editCycle(closed(), null as never), InvalidCycleError);
    assert.throws(() => editCycle(closed(), [] as never), InvalidCycleError);
  });

  test('reabrir (endDate: null) nao e suportado: decisao pendente PD-002', () => {
    assert.throws(() => editCycle(closed(), { endDate: null } as never), CycleStateError);
    assert.throws(() => editCycle(makeOpen('c1', '2026-10-05'), { endDate: null } as never), CycleStateError);
  });

  test('edicao e atomica e nao altera o ciclo original', () => {
    const original = closed();
    assert.throws(() => editCycle(original, { startDate: '2026-11-01', endDate: '2026-02-30' }), InvalidDateError);
    assert.throws(() => editCycle(original, { startDate: '2027-02-01' }), InvalidDateRangeError);
    assert.deepEqual(original, { id: 'c1', startDate: '2026-10-05', endDate: '2027-01-15' });
    editCycle(original, { startDate: '2026-10-06' });
    assert.deepEqual(original, { id: 'c1', startDate: '2026-10-05', endDate: '2027-01-15' });
  });
});
