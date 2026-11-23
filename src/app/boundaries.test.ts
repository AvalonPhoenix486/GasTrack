import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('.', import.meta.url));
const root = join(dir, '..');
const strip = (c: string) => c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const appSources = readdirSync(dir).filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

test('nenhum codigo da app usa toISOString para data civil', () => {
  for (const f of appSources) assert.doesNotMatch(strip(readFileSync(join(dir, f), 'utf8')), /toISOString|toUTC|getUTC|Date\.UTC/, f);
});

test('so main.ts toca localStorage/crypto/window; so render.ts toca document', () => {
  for (const f of appSources) {
    const code = strip(readFileSync(join(dir, f), 'utf8'));
    if (f !== 'main.ts') assert.doesNotMatch(code, /\bwindow\s*\.|crypto\.randomUUID/, f);
    if (f !== 'render.ts') assert.doesNotMatch(code, /\bdocument\b/, f);
    if (f !== 'main.ts' && f !== 'localStorageRepository.ts') assert.doesNotMatch(code, /\blocalStorage\b/, f);
  }
});

test('a app nao calcula previsao nem estatistica', () => {
  for (const f of appSources) {
    assert.doesNotMatch(strip(readFileSync(join(dir, f), 'utf8')), /core\/domain\/(forecast|statistics)|calculateStatistics|forecastNextChange|median|addDays|daysBetween/i, f);
  }
});

test('dominio e ui/forecast nao importam a camada app', () => {
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.ts') ? [join(d, e.name)] : []));
  for (const f of [...walk(join(root, 'core')), ...walk(join(root, 'ui'))]) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /from\s*['"][^'"]*\/app\//, f);
  }
});
