// TESTE NOVO: a linha do tempo le o dominio; nao usa relogio, DOM nem armazenamento e nao recalcula estatistica.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('.', import.meta.url));
const sources = readdirSync(dir).filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('sem Date, Intl, relogio, DOM, armazenamento, rede nem estatistica propria', () => {
  const banned = [/\bDate\b/, /\bIntl\b/, /\bdocument\b/, /(?<![.\w-])window\s*\./, /localStorage/, /\bfetch\b/, /setTimeout/, /calculateStatistics/, /\.sort\s*\(/, /toLocale/];
  for (const f of sources) {
    const code = strip(readFileSync(join(dir, f), 'utf8'));
    for (const b of banned) assert.doesNotMatch(code, b, `${f} contem ${b}`);
  }
});

test('imports: so dominio (forecast, cycles, dates) e a propria camada', () => {
  for (const f of sources) {
    const code = readFileSync(join(dir, f), 'utf8');
    const specs = [...code.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g)].map((m) => m[1] as string);
    for (const s of specs) assert.match(s, /^(\.\/[a-z-]+\.ts|\.\.\/\.\.\/core\/domain\/(forecast|cycles|dates)\/index\.ts)$/, `${f} importa ${s}`);
  }
});
