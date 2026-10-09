import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('.', import.meta.url));
const sources = readdirSync(dir).filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'test-support.ts');

const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('arquivos do modulo de ciclos', () => {
  assert.deepEqual([...sources].sort(), ['cycle.ts', 'errors.ts', 'factory.ts', 'history.ts', 'index.ts', 'order.ts', 'types.ts', 'validate.ts']);
});

test('nao usa relogio, Date, Intl, ambiente, aleatoriedade, rede, DOM, armazenamento nem node:*', () => {
  const banned = [
    /\bDate\b/, /\bIntl\b/, /\bprocess\b/, /\brequire\s*\(/, /\bperformance\b/, /Math\.random/, /\bcrypto\b/,
    /\bsetTimeout\b/, /\bsetInterval\b/, /\bfetch\b/, /\bXMLHttpRequest\b/, /\blocalStorage\b/, /\bsessionStorage\b/,
    /\bindexedDB\b/, /\bdocument\b/, /\bwindow\b/, /\bnavigator\b/, /\bglobalThis\b/, /node:/,
    /sqlite/i, /capacitor/i, /react/i, /vite/i, /android/i,
  ];
  for (const f of sources) {
    const code = strip(readFileSync(join(dir, f), 'utf8'));
    for (const b of banned) assert.doesNotMatch(code, b, `${f} contem ${b}`);
  }
});

test('imports: so arquivos do proprio modulo ou a API publica do dominio de datas', () => {
  for (const f of sources) {
    const code = readFileSync(join(dir, f), 'utf8');
    const specs = [...code.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g)].map((m) => m[1] as string);
    for (const s of specs) {
      assert.match(s, /^(\.\/[a-z-]+\.ts|\.\.\/dates\/index\.ts)$/, `${f} importa ${s}`);
    }
  }
});

test('nao reimplementa calculo de dias (usa o dominio de datas)', () => {
  for (const f of sources) {
    const code = strip(readFileSync(join(dir, f), 'utf8'));
    assert.doesNotMatch(code, /86400|86_400|toEpochDay|daysInMonth|isLeapYear/, f);
  }
});
