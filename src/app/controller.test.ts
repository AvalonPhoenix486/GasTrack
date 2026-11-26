import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCycle, closeCycle, getOpenCycle, getClosedCycles,
  OpenCycleConflictError, CycleOverlapError, CycleStateError,
} from '../core/domain/cycles/index.ts';
import { InvalidDateError, InvalidDateRangeError } from '../core/domain/dates/index.ts';
import { GasTrackController } from './controller.ts';
import { MemoryCycleRepository, RepositoryError } from './repository.ts';
import { LocalStorageCycleRepository } from './localStorageRepository.ts';
import type { StorageLike } from './localStorageRepository.ts';
import { buildScreen } from './screen.ts';
import { describeError } from './messages.ts';

function ids() { let n = 0; return () => `cycle-${++n}`; }
function make(repo = new MemoryCycleRepository()) { return { repo, app: new GasTrackController(repo, ids()) }; }

test('iniciar ciclo: abre, usa o id gerado e persiste', async () => {
  const { repo, app } = make();
  const h = await app.startCycle('2026-11-01');
  const open = getOpenCycle(h);
  assert.deepEqual(open, { id: 'cycle-1', startDate: '2026-11-01', endDate: null });
  assert.deepEqual((await repo.load()).cycles, [open]);
});

test('encerrar ciclo: fecha o mesmo id, persiste e limpa o aberto', async () => {
  const { repo, app } = make();
  await app.startCycle('2026-11-01');
  const h = await app.finishCycle('2026-11-30');
  assert.equal(getOpenCycle(h), undefined);
  assert.deepEqual(getClosedCycles(h), [{ id: 'cycle-1', startDate: '2026-11-01', endDate: '2026-11-30' }]);
  assert.deepEqual((await repo.load()).cycles, [...getClosedCycles(h)]);
});

test('impede segundo ciclo aberto (e nada muda)', async () => {
  const { repo, app } = make();
  await app.startCycle('2026-11-01');
  await assert.rejects(() => app.startCycle('2026-11-05'), OpenCycleConflictError);
  assert.equal((await repo.load()).cycles.length, 1);
});

test('impede sobreposicao ao iniciar dentro de ciclo fechado', async () => {
  const { app } = make();
  await app.startCycle('2026-01-01');
  await app.finishCycle('2026-01-30');
  await assert.rejects(() => app.startCycle('2026-01-15'), CycleOverlapError);
  assert.equal(getOpenCycle(app.history), undefined);
});

test('encerrar antes do inicio, data invalida e sem ciclo aberto', async () => {
  const { app } = make();
  await assert.rejects(() => app.finishCycle('2026-01-01'), CycleStateError);
  await app.startCycle('2026-02-10');
  await assert.rejects(() => app.finishCycle('2026-02-01'), InvalidDateRangeError);
  await assert.rejects(() => app.finishCycle(''), InvalidDateError);
  await assert.rejects(() => app.startCycle('2026-02-30'), InvalidDateError);
  assert.ok(getOpenCycle(app.history), 'o ciclo continua aberto apos os erros');
});

test('falha ao gravar: lanca RepositoryError e o estado em memoria nao muda', async () => {
  const { repo, app } = make();
  repo.failSave = true;
  await assert.rejects(() => app.startCycle('2026-01-01'), RepositoryError);
  assert.equal(app.history.cycles.length, 0);
  repo.failSave = false;
  await app.startCycle('2026-01-01');
  repo.failSave = true;
  await assert.rejects(() => app.finishCycle('2026-01-10'), RepositoryError);
  assert.ok(getOpenCycle(app.history));
});

test('persistir e recuperar por um controlador novo, preservando ids', async () => {
  const store = new Map<string, string>();
  const storage: StorageLike = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) };
  const one = new GasTrackController(new LocalStorageCycleRepository(() => storage), ids());
  await one.startCycle('2026-01-01');
  await one.finishCycle('2026-01-30');
  await one.startCycle('2026-02-01');
  const two = new GasTrackController(new LocalStorageCycleRepository(() => storage), ids());
  assert.equal(await two.load(), null);
  assert.deepEqual(two.history.cycles, one.history.cycles);
  assert.deepEqual(two.history.cycles.map((c) => c.id), ['cycle-1', 'cycle-2']);
});

test('armazenamento invalido: load devolve problema e o app segue funcionando', async () => {
  const store = new Map<string, string>([['gastrack.cycles', '{quebrado']]);
  const storage: StorageLike = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) };
  const app = new GasTrackController(new LocalStorageCycleRepository(() => storage), ids());
  assert.deepEqual(await app.load(), { kind: 'corrupt', backedUp: true });
  assert.equal(app.history.cycles.length, 0);
  await app.startCycle('2026-03-01');
  assert.ok(getOpenCycle(app.history));
});

test('historico e previsao atualizam a cada passo (4 fechados + aberto)', async () => {
  const { app } = make();
  const spans: [string, string][] = [['2026-01-01', '2026-01-30'], ['2026-02-01', '2026-03-02'], ['2026-03-05', '2026-04-04'], ['2026-04-07', '2026-05-08']];
  let screen = buildScreen(app.history, '2026-05-09');
  assert.equal(screen.forecast.kind, 'insufficient-data');
  assert.equal(screen.historyRows.length, 0);
  for (const [i, [s, e]] of spans.entries()) {
    await app.startCycle(s);
    assert.match(buildScreen(app.history, e).currentText, /^Em andamento desde /);
    await app.finishCycle(e);
    screen = buildScreen(app.history, e);
    assert.equal(screen.currentText, 'Nenhum ciclo em andamento.');
    assert.equal(screen.historyRows.length, i + 1);
  }
  assert.equal(screen.forecast.kind, 'no-open-cycle');
  await app.startCycle('2026-05-10');
  screen = buildScreen(app.history, '2026-05-10');
  assert.equal(screen.currentText, 'Em andamento desde 10 de maio de 2026');
  assert.equal(screen.forecast.kind, 'ok');
  assert.deepEqual(screen.historyRows.map((r) => r.durationText), ['31 dias', '30 dias', '29 dias', '29 dias']);
  assert.deepEqual(screen.historyRows[0], { id: 'cycle-4', startDate: '2026-04-07', endDate: '2026-05-08', startText: '7 de abril de 2026', endText: '8 de maio de 2026', durationText: '31 dias', totalDays: 31, calendarText: '1 mês e 1 dia', year: '2026' });
});

test('texto do ciclo aberto usa "1º"', () => {
  const h = new GasTrackController(new MemoryCycleRepository(), ids()).history;
  assert.equal(buildScreen(h, '2026-11-01').currentText, 'Nenhum ciclo em andamento.');
  const open = createCycle({ id: 'x', startDate: '2026-11-01' });
  const withOpen = { cycles: [closeCycle(createCycle({ id: 'y', startDate: '2026-10-01' }), '2026-10-30'), open] };
  assert.equal(buildScreen(withOpen, '2026-11-01').currentText, 'Em andamento desde 1º de novembro de 2026');
});

test('mensagens: erros conhecidos viram texto; desconhecido -> null (nao engolido)', () => {
  assert.match(describeError(new OpenCycleConflictError('a', 'b')) ?? '', /Já existe um ciclo em andamento/);
  assert.match(describeError(new CycleOverlapError('a', 'b')) ?? '', /coincidem|sobreponham/);
  assert.match(describeError(new InvalidDateRangeError('2026-02-10', '2026-02-01')) ?? '', /anterior/);
  assert.match(describeError(new InvalidDateError('x', 'y')) ?? '', /inválida/);
  assert.match(describeError(new RepositoryError('x')) ?? '', /Não foi possível salvar/);
  assert.equal(describeError(new TypeError('bug')), null);
});
