import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCycle, closeCycle } from '../core/domain/cycles/index.ts';
import { LocalStorageCycleRepository, STORAGE_KEY } from './localStorageRepository.ts';
import type { StorageLike } from './localStorageRepository.ts';
import { RepositoryError } from './repository.ts';

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  failSet = false;
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { if (this.failSet) throw new Error('quota'); this.data.set(k, v); }
}

const a = closeCycle(createCycle({ id: 'id-a', startDate: '2026-01-01' }), '2026-01-30');
const b = createCycle({ id: 'id-b', startDate: '2026-02-01' });

test('armazenamento vazio: sem ciclos e sem problema', async () => {
  const r = await new LocalStorageCycleRepository(() => new FakeStorage()).load();
  assert.deepEqual(r, { cycles: [], problem: null });
});

test('salva e recupera, preservando ids e estado aberto/fechado', async () => {
  const s = new FakeStorage();
  await new LocalStorageCycleRepository(() => s).save([a, b]);
  const r = await new LocalStorageCycleRepository(() => s).load();
  assert.equal(r.problem, null);
  assert.deepEqual(r.cycles, [a, b]);
  assert.deepEqual(r.cycles.map((c) => c.id), ['id-a', 'id-b']);
});

for (const [nome, raw] of [
  ['JSON invalido', '{nao e json'],
  ['nao e objeto', '[1,2]'],
  ['versao desconhecida', JSON.stringify({ version: 99, cycles: [] })],
  ['cycles nao e lista', JSON.stringify({ version: 1, cycles: 'x' })],
  ['ciclo com data invalida', JSON.stringify({ version: 1, cycles: [{ id: 'x', startDate: '2026-02-30', endDate: null }] })],
  ['dois ciclos abertos', JSON.stringify({ version: 1, cycles: [{ id: 'x', startDate: '2026-01-01', endDate: null }, { id: 'y', startDate: '2026-02-01', endDate: null }] })],
  ['ciclos sobrepostos', JSON.stringify({ version: 1, cycles: [{ id: 'x', startDate: '2026-01-01', endDate: '2026-01-10' }, { id: 'y', startDate: '2026-01-05', endDate: '2026-01-20' }] })],
  ['ids repetidos', JSON.stringify({ version: 1, cycles: [{ id: 'x', startDate: '2026-01-01', endDate: '2026-01-02' }, { id: 'x', startDate: '2026-02-01', endDate: '2026-02-02' }] })],
] as const) {
  test(`dados invalidos (${nome}): nao lanca, devolve vazio + corrupt e guarda copia`, async () => {
    const s = new FakeStorage();
    s.data.set(STORAGE_KEY, raw);
    const r = await new LocalStorageCycleRepository(() => s).load();
    assert.deepEqual(r.cycles, []);
    assert.deepEqual(r.problem, { kind: 'corrupt', backedUp: true });
    assert.equal(s.data.get(`${STORAGE_KEY}.corrupt`), raw);
    assert.equal(s.data.get(STORAGE_KEY), raw, 'load nao apaga o original');
  });
}

test('corrupto e copia falha: backedUp=false, ainda sem lancar', async () => {
  const s = new FakeStorage();
  s.data.set(STORAGE_KEY, 'lixo');
  s.failSet = true;
  const r = await new LocalStorageCycleRepository(() => s).load();
  assert.deepEqual(r.problem, { kind: 'corrupt', backedUp: false });
});

test('armazenamento inacessivel na leitura: unavailable, sem lancar', async () => {
  const r = await new LocalStorageCycleRepository(() => { throw new Error('SecurityError'); }).load();
  assert.deepEqual(r, { cycles: [], problem: { kind: 'unavailable' } });
});

test('falha de gravacao vira RepositoryError (e nada e gravado)', async () => {
  const s = new FakeStorage();
  s.failSet = true;
  await assert.rejects(() => new LocalStorageCycleRepository(() => s).save([a]), RepositoryError);
  assert.equal(s.data.size, 0);
  await assert.rejects(() => new LocalStorageCycleRepository(() => { throw new Error('x'); }).save([a]), RepositoryError);
});
