import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getOpenCycle, getClosedCycles, CycleOverlapError, CycleNotFoundError } from '../core/domain/cycles/index.ts';
import { InvalidDateError, InvalidDateRangeError } from '../core/domain/dates/index.ts';
import { GasTrackController } from './controller.ts';
import { MemoryCycleRepository, RepositoryError } from './repository.ts';
import { LocalStorageCycleRepository } from './localStorageRepository.ts';
import type { StorageLike } from './localStorageRepository.ts';
import { buildScreen } from './screen.ts';
import { describeError } from './messages.ts';

function ids() { let n = 0; return () => `c${++n}`; }
const SPANS: [string, string][] = [['2026-01-01', '2026-01-30'], ['2026-02-01', '2026-03-02'], ['2026-03-05', '2026-04-04'], ['2026-04-07', '2026-05-08']];

/** 4 ciclos fechados (c1..c4) + 1 aberto (c5, 2026-05-10). */
async function seeded(repo = new MemoryCycleRepository()) {
  const app = new GasTrackController(repo, ids());
  for (const [s, e] of SPANS) { await app.startCycle(s); await app.finishCycle(e); }
  await app.startCycle('2026-05-10');
  return { repo, app };
}
const forecastOf = (app: GasTrackController) => buildScreen(app.history, '2026-05-10').forecast;

test('editar ciclo aberto: muda o inicio, preserva id e continua aberto', async () => {
  const { repo, app } = await seeded();
  await app.updateCycle('c5', { startDate: '2026-05-12' });
  assert.deepEqual(getOpenCycle(app.history), { id: 'c5', startDate: '2026-05-12', endDate: null });
  assert.deepEqual((await repo.load()).cycles, [...app.history.cycles]);
  assert.equal(buildScreen(app.history, '2026-05-12').currentText, 'Em andamento desde 12 de maio de 2026');
});

test('editar ciclo encerrado: muda fim e inicio, preserva id, atualiza duracao no historico', async () => {
  const { app } = await seeded();
  await app.updateCycle('c4', { endDate: '2026-05-09' });
  let row = buildScreen(app.history, '2026-05-10').historyRows[0];
  assert.deepEqual([row?.id, row?.endDate, row?.durationText], ['c4', '2026-05-09', '32 dias']);
  await app.updateCycle('c4', { startDate: '2026-04-08', endDate: '2026-05-08' });
  row = buildScreen(app.history, '2026-05-10').historyRows[0];
  assert.deepEqual([row?.startDate, row?.durationText], ['2026-04-08', '30 dias']);
  assert.equal(getClosedCycles(app.history).length, 4);
});

test('editar com data invalida ou fim antes do inicio: erro do dominio e nada muda', async () => {
  const { repo, app } = await seeded();
  const before = app.history;
  await assert.rejects(() => app.updateCycle('c4', { startDate: '2026-02-30' }), InvalidDateError);
  await assert.rejects(() => app.updateCycle('c4', { endDate: '' }), InvalidDateError);
  await assert.rejects(() => app.updateCycle('c4', { endDate: '2026-04-01' }), InvalidDateRangeError);
  await assert.rejects(() => app.updateCycle('c4', { startDate: '2026-05-09' }), InvalidDateRangeError);
  assert.equal(app.history, before);
  assert.deepEqual((await repo.load()).cycles, [...before.cycles]);
  assert.match(describeError(new InvalidDateRangeError('2026-05-09', '2026-05-08')) ?? '', /anterior/);
});

test('editar causando sobreposicao: CycleOverlapError e nada muda', async () => {
  const { app } = await seeded();
  const before = app.history;
  await assert.rejects(() => app.updateCycle('c2', { startDate: '2026-01-20' }), CycleOverlapError);
  await assert.rejects(() => app.updateCycle('c1', { endDate: '2026-02-15' }), CycleOverlapError);
  await assert.rejects(() => app.updateCycle('c5', { startDate: '2026-05-01' }), CycleOverlapError);
  assert.equal(app.history, before);
  // adjacente (mesmo dia) e permitido pelo dominio
  await app.updateCycle('c2', { startDate: '2026-01-30' });
});

test('falha ao persistir edicao: RepositoryError e estado em memoria preservado', async () => {
  const { repo, app } = await seeded();
  const before = app.history;
  repo.failSave = true;
  await assert.rejects(() => app.updateCycle('c4', { endDate: '2026-05-09' }), RepositoryError);
  assert.equal(app.history, before);
  assert.equal(getClosedCycles(app.history).at(-1)?.endDate, '2026-05-08');
});

test('editar id inexistente: CycleNotFoundError', async () => {
  const { app } = await seeded();
  await assert.rejects(() => app.updateCycle('nao-existe', { startDate: '2026-01-01' }), CycleNotFoundError);
});

test('excluir ciclo encerrado: some do historico e do repositorio', async () => {
  const { repo, app } = await seeded();
  await app.deleteCycle('c2');
  assert.deepEqual(app.history.cycles.map((c) => c.id), ['c1', 'c3', 'c4', 'c5']);
  assert.deepEqual((await repo.load()).cycles.map((c) => c.id), ['c1', 'c3', 'c4', 'c5']);
  assert.equal(buildScreen(app.history, '2026-05-10').historyRows.some((r) => r.id === 'c2'), false);
});

test('excluir o ciclo aberto: volta a "Nenhum ciclo em andamento" e permite iniciar outro', async () => {
  const { repo, app } = await seeded();
  await app.deleteCycle('c5');
  assert.equal(getOpenCycle(app.history), undefined);
  const screen = buildScreen(app.history, '2026-05-10');
  assert.equal(screen.currentText, 'Nenhum ciclo em andamento.');
  assert.equal(screen.openCycle, null);
  assert.equal((await repo.load()).cycles.some((c) => c.id === 'c5'), false);
  await app.startCycle('2026-05-11');
  assert.equal(getOpenCycle(app.history)?.startDate, '2026-05-11');
});

test('falha ao persistir exclusao: RepositoryError e nada some', async () => {
  const { repo, app } = await seeded();
  const before = app.history;
  repo.failSave = true;
  await assert.rejects(() => app.deleteCycle('c1'), RepositoryError);
  await assert.rejects(() => app.deleteCycle('c5'), RepositoryError);
  assert.equal(app.history, before);
  assert.equal((await repo.load()).cycles.length, 5);
});

test('excluir id inexistente: CycleNotFoundError', async () => {
  const { app } = await seeded();
  await assert.rejects(() => app.deleteCycle('x'), CycleNotFoundError);
});

test('previsao atualizada apos edicao', async () => {
  const { app } = await seeded();
  const f1 = forecastOf(app);
  assert.equal(f1.kind, 'ok');
  await app.updateCycle('c1', { startDate: '2025-11-01' }); // ciclo bem mais longo: muda a mediana
  const f2 = forecastOf(app);
  assert.equal(f2.kind, 'ok');
  assert.notDeepEqual(f2, f1);
});

test('previsao atualizada apos exclusao (fechado -> dados insuficientes; aberto -> sem ciclo em andamento)', async () => {
  const { app } = await seeded();
  await app.deleteCycle('c5');
  assert.equal(forecastOf(app).kind, 'no-open-cycle');
  await app.deleteCycle('c1');
  const f = forecastOf(app);
  assert.equal(f.kind, 'insufficient-data');
  if (f.kind === 'insufficient-data') assert.equal(f.historyLine, 'Histórico: 3 ciclos');
});

test('persistencia apos recarregar (edicao e exclusao), ids preservados', async () => {
  const store = new Map<string, string>();
  const storage: StorageLike = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) };
  const one = new GasTrackController(new LocalStorageCycleRepository(() => storage), ids());
  for (const [s, e] of SPANS) { await one.startCycle(s); await one.finishCycle(e); }
  await one.updateCycle('c4', { endDate: '2026-05-09' });
  await one.deleteCycle('c1');
  const two = new GasTrackController(new LocalStorageCycleRepository(() => storage), ids());
  assert.equal(await two.load(), null);
  assert.deepEqual(two.history.cycles, one.history.cycles);
  assert.deepEqual(two.history.cycles.map((c) => c.id), ['c2', 'c3', 'c4']);
  assert.equal(getClosedCycles(two.history).at(-1)?.endDate, '2026-05-09');
});
