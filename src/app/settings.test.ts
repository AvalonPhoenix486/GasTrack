// TESTES NOVOS: preferencias de idioma, animacoes e lembretes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StorageLike } from './localStorageRepository.ts';
import {
  DEFAULT_SETTINGS, NOTICE_DAY_OPTIONS, SETTINGS_KEY, SettingsStore, animationsEnabled, parseSettings, sanitizeNoticeDays,
} from './settings.ts';

function memory(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}

test('sem nada salvo: padroes', () => {
  assert.deepEqual({ ...new SettingsStore(() => memory()).load() }, { ...DEFAULT_SETTINGS });
  assert.equal(DEFAULT_SETTINGS.language, 'system');
  assert.equal(DEFAULT_SETTINGS.reminderEnabled, true);
});

test('salvar e carregar preserva todos os campos', () => {
  const storage = memory();
  const store = new SettingsStore(() => storage);
  const wanted = { language: 'en', motion: 'off', reminderEnabled: false, noticeDays: 5 } as const;
  assert.equal(store.save(wanted), true);
  assert.deepEqual({ ...new SettingsStore(() => storage).load() }, wanted);
});

test('campo ruim volta ao padrao sem perder os outros', () => {
  const raw = { version: 1, language: 'klingon', motion: 'off', reminderEnabled: 'sim', noticeDays: 4 };
  const s = parseSettings(raw);
  assert.equal(s.language, 'system');
  assert.equal(s.motion, 'off');
  assert.equal(s.reminderEnabled, true);
  assert.equal(s.noticeDays, DEFAULT_SETTINGS.noticeDays);
});

test('JSON ilegivel, versao desconhecida e formato errado -> padroes', () => {
  assert.deepEqual({ ...new SettingsStore(() => memory({ [SETTINGS_KEY]: '{oops' })).load() }, { ...DEFAULT_SETTINGS });
  assert.deepEqual({ ...parseSettings({ version: 99, language: 'en' }) }, { ...DEFAULT_SETTINGS });
  for (const bad of [null, [], 'x', 7]) assert.deepEqual({ ...parseSettings(bad) }, { ...DEFAULT_SETTINGS });
});

test('armazenamento indisponivel nao lanca', () => {
  const broken: StorageLike = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
  const store = new SettingsStore(() => broken);
  assert.deepEqual({ ...store.load() }, { ...DEFAULT_SETTINGS });
  assert.equal(store.save(DEFAULT_SETTINGS), false);
  assert.deepEqual({ ...new SettingsStore(() => { throw new Error('x'); }).load() }, { ...DEFAULT_SETTINGS });
});

test('antecedencia: so os valores oferecidos', () => {
  for (const n of NOTICE_DAY_OPTIONS) assert.equal(sanitizeNoticeDays(n), n);
  for (const bad of [0, 4, -1, 2.5, '3', null, NaN]) assert.equal(sanitizeNoticeDays(bad), DEFAULT_SETTINGS.noticeDays);
});

test('animacoes: preferencia explicita vence; automatico obedece o sistema', () => {
  assert.equal(animationsEnabled('on', true), true);
  assert.equal(animationsEnabled('off', false), false);
  assert.equal(animationsEnabled('system', true), false);
  assert.equal(animationsEnabled('system', false), true);
});
