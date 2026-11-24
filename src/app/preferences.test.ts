import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ThemeStore, nextTheme, THEME_KEY } from './preferences.ts';
import type { StorageLike } from './localStorageRepository.ts';

function fake(): StorageLike & { data: Map<string, string>; fail: boolean } {
  const data = new Map<string, string>();
  const s = {
    data, fail: false,
    getItem: (k: string) => data.get(k) ?? null,
    setItem(k: string, v: string) { if (s.fail) throw new Error('quota'); data.set(k, v); },
  };
  return s;
}

test('tema: padrao automatico, salva e recupera', () => {
  const s = fake();
  const store = new ThemeStore(() => s);
  assert.equal(store.load(), 'system');
  assert.equal(store.save('dark'), true);
  assert.equal(new ThemeStore(() => s).load(), 'dark');
});

test('tema: valor invalido ou armazenamento quebrado -> automatico, sem lancar', () => {
  const s = fake();
  s.data.set(THEME_KEY, 'roxo');
  assert.equal(new ThemeStore(() => s).load(), 'system');
  assert.equal(new ThemeStore(() => { throw new Error('SecurityError'); }).load(), 'system');
  s.fail = true;
  assert.equal(new ThemeStore(() => s).save('light'), false);
  assert.equal(new ThemeStore(() => { throw new Error('x'); }).save('light'), false);
});

test('tema: alterna automatico -> claro -> escuro -> automatico', () => {
  assert.equal(nextTheme('system'), 'light');
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'system');
});
