import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('.', import.meta.url));
const sources = readdirSync(dir).filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'test-support.ts');

test('ha arquivos de codigo a verificar', () => {
  assert.deepEqual([...sources].sort(), ['calendar.ts', 'duration.ts', 'errors.ts', 'index.ts']);
});

test('codigo do modulo nao usa Date, Intl, relogio, process nem require', () => {
  for (const f of sources) {
    const code = readFileSync(join(dir, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')   // comentarios de bloco
      .replace(/\/\/.*$/gm, '');          // comentarios de linha
    for (const banned of [/\bDate\b/, /\bIntl\b/, /\bprocess\b/, /\brequire\s*\(/, /\bperformance\b/, /Math\.random/]) {
      assert.doesNotMatch(code, banned, `${f} contem ${banned}`);
    }
  }
});

test('imports do modulo sao apenas relativos (sem node:, sem pacotes, sem UI/Android/banco)', () => {
  for (const f of sources) {
    const code = readFileSync(join(dir, f), 'utf8');
    const specs = [...code.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g)].map((m) => m[1] as string);
    for (const s of specs) assert.match(s, /^\.\/[a-z-]+\.ts$/, `${f} importa ${s}`);
  }
});
