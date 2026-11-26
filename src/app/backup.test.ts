// TESTES NOVOS: exportacao/importacao. O que entra passa pela validacao do dominio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyFromCycles, listCycles } from '../core/domain/cycles/index.ts';
import { BackupError, exportBackup, parseBackup } from './backup.ts';

const CYCLES = listCycles(historyFromCycles([
  { id: 'a', startDate: '2026-01-01', endDate: '2026-01-30' },
  { id: 'b', startDate: '2026-02-01', endDate: '2026-03-02' },
  { id: 'o', startDate: '2026-03-05', endDate: null },
]));
const kind = (text: string): string | null => {
  try { parseBackup(text); return null; } catch (e) { return e instanceof BackupError ? e.kind : 'other'; }
};

test('ida e volta: exportar e importar devolve os mesmos ciclos', () => {
  const text = exportBackup(CYCLES, '2026-11-25');
  assert.deepEqual(parseBackup(text).map((c) => ({ ...c })), CYCLES.map((c) => ({ ...c })));
});

test('exportacao identifica o app, a versao e a data informada (sem relogio)', () => {
  const data = JSON.parse(exportBackup(CYCLES, '2026-11-25')) as Record<string, unknown>;
  assert.equal(data['app'], 'gastrack');
  assert.equal(data['version'], 1);
  assert.equal(data['exportedAt'], '2026-11-25');
});

test('historico vazio exporta e importa', () => {
  assert.deepEqual(parseBackup(exportBackup([], '2026-11-25')), []);
});

test('aceita o formato interno {version:1,cycles}', () => {
  assert.equal(parseBackup(JSON.stringify({ version: 1, cycles: [{ id: 'a', startDate: '2026-01-01', endDate: null }] })).length, 1);
});

test('recusa: nao e JSON, formato errado, outro app, versao desconhecida', () => {
  assert.equal(kind('{oops'), 'not-json');
  assert.equal(kind(''), 'not-json');
  assert.equal(kind('[]'), 'format');
  assert.equal(kind('"x"'), 'format');
  assert.equal(kind('null'), 'format');
  assert.equal(kind('{"version":1}'), 'format');
  assert.equal(kind('{"app":"outro","version":1,"cycles":[]}'), 'format');
  assert.equal(kind('{"version":2,"cycles":[]}'), 'version');
});

test('recusa ciclos invalidos: data impossivel, fim antes do inicio, ids repetidos, sobreposicao, dois abertos', () => {
  const wrap = (cycles: object[]) => JSON.stringify({ version: 1, cycles });
  assert.equal(kind(wrap([{ id: 'a', startDate: '2026-02-30', endDate: null }])), 'invalid');
  assert.equal(kind(wrap([{ id: 'a', startDate: '2026-02-10', endDate: '2026-02-01' }])), 'invalid');
  assert.equal(kind(wrap([{ id: 'a', startDate: '2026-01-01', endDate: '2026-01-10' }, { id: 'a', startDate: '2026-02-01', endDate: '2026-02-10' }])), 'invalid');
  assert.equal(kind(wrap([{ id: 'a', startDate: '2026-01-01', endDate: '2026-01-20' }, { id: 'b', startDate: '2026-01-10', endDate: '2026-01-30' }])), 'invalid');
  assert.equal(kind(wrap([{ id: 'a', startDate: '2026-01-01', endDate: null }, { id: 'b', startDate: '2026-02-01', endDate: null }])), 'invalid');
  assert.equal(kind(wrap([{ id: 'a' }])), 'invalid');
  assert.equal(kind(wrap([null])), 'invalid');
});
