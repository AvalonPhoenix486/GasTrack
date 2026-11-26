import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('o cristal exibido vem do arquivo original (nao e redesenhado): imagens referenciadas existem e o original esta versionado', () => {
  assert.ok(existsSync(`${root}assets/brand/crystal-original.png`));
  const code = readFileSync(`${root}src/app/view/brand.ts`, 'utf8');
  const html = readFileSync(`${root}www/index.html`, 'utf8');
  const refs = [...code.matchAll(/'(brand\/[\w.-]+\.png)'/g)].map((m) => m[1] as string);
  refs.push(...[...html.matchAll(/href="(brand\/[\w.-]+\.png)"/g)].map((m) => m[1] as string));
  assert.ok(refs.length >= 3, 'esperava crystal-s, crystal-l e favicon');
  for (const r of refs) assert.ok(existsSync(`${root}www/${r}`), r);
});
