// TESTES NOVOS: registrar troca (atomico), substituir tudo (importacao) e apagar tudo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getClosedCycles, getOpenCycle, CycleStateError, CycleOverlapError } from '../core/domain/cycles/index.ts';
import { InvalidDateError, InvalidDateRangeError } from '../core/domain/dates/index.ts';
import { GasTrackController } from './controller.ts';
import { APP_VERSION } from './appInfo.ts';
import { BackupError } from './backup.ts';
import { describeError } from './messages.ts';
import { MemoryCycleRepository, RepositoryError } from './repository.ts';

function ids() { let n = 0; return () => `id-${++n}`; }
function make() { const repo = new MemoryCycleRepository(); return { repo, app: new GasTrackController(repo, ids()) }; }

test('registrar troca: encerra o ciclo atual e abre o proximo na mesma data, numa so gravacao', async () => {
  const { repo, app } = make();
  await app.startCycle('2026-10-01');
  const saves: number[] = [];
  const original = repo.save.bind(repo);
  repo.save = (c) => { saves.push(c.length); return original(c); };
  const h = await app.registerChange('2026-11-05');
  assert.deepEqual(getClosedCycles(h).map((c) => ({ ...c })), [{ id: 'id-1', startDate: '2026-10-01', endDate: '2026-11-05' }]);
  assert.deepEqual({ ...getOpenCycle(h) }, { id: 'id-2', startDate: '2026-11-05', endDate: null });
  assert.deepEqual(saves, [2]);
  assert.equal((await repo.load()).cycles.length, 2);
});

test('registrar troca sem ciclo aberto: erro e nada muda', async () => {
  const { repo, app } = make();
  await assert.rejects(() => app.registerChange('2026-11-05'), CycleStateError);
  assert.equal((await repo.load()).cycles.length, 0);
});

test('registrar troca com data anterior ao inicio: erro e nada muda', async () => {
  const { repo, app } = make();
  await app.startCycle('2026-10-10');
  await assert.rejects(() => app.registerChange('2026-10-01'), InvalidDateRangeError);
  assert.equal(getOpenCycle(app.history)?.id, 'id-1');
  assert.equal((await repo.load()).cycles.length, 1);
});

test('registrar troca: falha ao gravar nao altera a memoria nem cria o ciclo novo', async () => {
  const { repo, app } = make();
  await app.startCycle('2026-10-01');
  repo.failSave = true;
  await assert.rejects(() => app.registerChange('2026-11-05'), RepositoryError);
  assert.equal(getOpenCycle(app.history)?.id, 'id-1');
  assert.equal(getClosedCycles(app.history).length, 0);
});

test('registrar troca na mesma data do inicio: ciclo de 0 dia e novo ciclo aberto (sem excecao)', async () => {
  const { app } = make();
  await app.startCycle('2026-10-01');
  const h = await app.registerChange('2026-10-01');
  assert.equal(getClosedCycles(h).length, 1);
  assert.equal(getOpenCycle(h)?.startDate, '2026-10-01');
});

test('duas trocas seguidas na mesma data: o dominio recusa (D021), sem alterar nada', async () => {
  const { app } = make();
  await app.startCycle('2026-10-01');
  await app.registerChange('2026-10-01');
  await assert.rejects(() => app.registerChange('2026-10-01'), CycleOverlapError);
  assert.equal(getClosedCycles(app.history).length, 1);
});

test('substituir tudo: valida pelo dominio, grava e troca o historico', async () => {
  const { repo, app } = make();
  await app.startCycle('2026-10-01');
  const h = await app.replaceAll([
    { id: 'x', startDate: '2026-01-01', endDate: '2026-01-30' },
    { id: 'y', startDate: '2026-02-01', endDate: null },
  ]);
  assert.equal(h.cycles.length, 2);
  assert.deepEqual((await repo.load()).cycles.map((c) => c.id), ['x', 'y']);
});

test('substituir tudo com dados invalidos: erro e o historico atual permanece', async () => {
  const { repo, app } = make();
  await app.startCycle('2026-10-01');
  await assert.rejects(() => app.replaceAll([{ id: 'x', startDate: '2026-13-01', endDate: null }]), InvalidDateError);
  assert.equal(app.history.cycles.length, 1);
  assert.equal((await repo.load()).cycles.length, 1);
});

test('substituir tudo: falha ao gravar mantem o historico atual', async () => {
  const { repo, app } = make();
  await app.startCycle('2026-10-01');
  repo.failSave = true;
  await assert.rejects(() => app.replaceAll([]), RepositoryError);
  assert.equal(app.history.cycles.length, 1);
});

test('apagar tudo: grava vazio; falha ao gravar mantem os dados', async () => {
  const { repo, app } = make();
  await app.startCycle('2026-10-01');
  repo.failSave = true;
  await assert.rejects(() => app.clearAll(), RepositoryError);
  assert.equal(app.history.cycles.length, 1);
  repo.failSave = false;
  await app.clearAll();
  assert.equal(app.history.cycles.length, 0);
  assert.equal((await repo.load()).cycles.length, 0);
});

test('describeError: nos dois idiomas, inclusive importacao', () => {
  assert.match(describeError(new BackupError('not-json')) ?? '', /JSON/);
  assert.match(describeError(new BackupError('version'), 'en') ?? '', /not supported/);
  assert.match(describeError(new RepositoryError('x'), 'en') ?? '', /Could not save/);
  assert.equal(describeError(new Error('x'), 'en'), null);
  assert.match(describeError(new CycleStateError('x')) ?? '', /Não há ciclo/);
});

test('versao do app confere com o package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
  assert.equal(APP_VERSION, pkg.version);
});
