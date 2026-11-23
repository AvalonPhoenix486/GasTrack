// TESTE NOVO (apresentacao da previsao): a camada so formata; nao calcula estatistica, janela nem data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('.', import.meta.url));
const sources = readdirSync(dir).filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('arquivos da apresentacao', () => {
  assert.deepEqual([...sources].sort(), ['format.ts', 'index.ts', 'present.ts', 'types.ts']);
});

test('nao usa Date, Intl, relogio, ambiente, aleatoriedade, rede, DOM, armazenamento nem node:*', () => {
  const banned = [
    /\bDate\b/, /\bIntl\b/, /\bprocess\b/, /\brequire\s*\(/, /\bperformance\b/, /Math\.random/, /\bcrypto\b/,
    /\bsetTimeout\b/, /\bsetInterval\b/, /\bfetch\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bindexedDB\b/,
    /\bdocument\b/, /\bnavigator\b/, /\bglobalThis\b/, /node:/, /toLocale/,
    /sqlite/i, /capacitor/i, /react/i, /vite/i, /android/i,
  ];
  for (const f of sources) {
    const code = strip(readFileSync(join(dir, f), 'utf8'));
    for (const b of banned) assert.doesNotMatch(code, b, `${f} contem ${b}`);
  }
});

test('imports: so a propria camada e as APIs publicas de forecast, cycles e dates', () => {
  for (const f of sources) {
    const code = readFileSync(join(dir, f), 'utf8');
    const specs = [...code.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g)].map((m) => m[1] as string);
    for (const s of specs) assert.match(s, /^(\.\/[a-z-]+\.ts|\.\.\/\.\.\/core\/domain\/(forecast|cycles|dates)\/index\.ts)$/, `${f} importa ${s}`);
  }
});

test('nao recalcula estatistica, janela nem data e nao arredonda para ceil/floor', () => {
  for (const f of sources) {
    const code = strip(readFileSync(join(dir, f), 'utf8'));
    assert.doesNotMatch(code, /addDays|daysBetween|toEpochDay|fromEpochDay|daysInMonth|isLeapYear|86400|86_400/, `${f} mexe em calendario`);
    assert.doesNotMatch(code, /calculateStatistics|statistics\/|sortedAscending|medianOfSorted|\.sort\s*\(/, `${f} mexe em estatistica`);
    assert.doesNotMatch(code, /\b(?:halfWidth|toDayWindow)\s*\(|MIN_CLOSED_CYCLES|FLOOR_DAYS\s*[-+*\/]|[-+*\/]\s*FLOOR_DAYS/, `${f} recalcula a janela`);
    assert.doesNotMatch(code, /Math\.(floor|ceil|trunc|max|min)/, `${f} arredonda ou calcula`);
  }
});

test('Math.round so em format.ts (porcentagem de exibicao)', () => {
  for (const f of sources) {
    const code = strip(readFileSync(join(dir, f), 'utf8'));
    if (f === 'format.ts') continue;
    assert.doesNotMatch(code, /Math\.round/, f);
  }
});

test('textos fixos nao usam linguagem de confianca, probabilidade, peso ou ultimos N', () => {
  for (const f of sources) {
    const code = strip(readFileSync(join(dir, f), 'utf8'));
    assert.doesNotMatch(code, /confian|probabilidad|chance|certeza|garantia|garantid|vai acontecer|intervalo de|margem de|lastN|weight|peso/i, f);
  }
});
