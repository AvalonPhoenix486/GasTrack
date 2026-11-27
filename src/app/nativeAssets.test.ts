import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p: string) => readFileSync(`${root}${p}`, 'utf8');
const png = (p: string) => { const b = readFileSync(`${root}${p}`); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), sig: b.subarray(1, 4).toString() }; };

test('mestres nativos: PNGs nos tamanhos exigidos pelo @capacitor/assets (icones 1024, splash 2732)', () => {
  const expected: Record<string, number> = { 'icon-only': 1024, 'icon-foreground': 1024, 'icon-background': 1024, splash: 2732, 'splash-dark': 2732, 'splash-icon': 1152 };
  for (const [name, side] of Object.entries(expected)) {
    const p = png(`assets/native/${name}.png`);
    assert.deepEqual([p.sig, p.w, p.h], ['PNG', side, side], name);
    assert.ok(existsSync(`${root}assets/brand/native-src/${name}.svg`), `fonte SVG de ${name}`);
  }
});

test('o botijao nativo tem a mesma geometria do botijao da interface (cylinder.svg x cylinderArt)', () => {
  const shapes = (s: string) => [...s.matchAll(/<(?:path|rect)\b[^>]*>/g)].map((m) => m[0]).map((t) => (t.match(/\b(?:d|x|y|width|height|rx)="[^"]+"/g) ?? []).join(' ')).filter((t) => t !== '').sort();
  const ui = read('src/app/view/brand.ts');
  const art = ui.slice(ui.indexOf('export function cylinderArt'), ui.indexOf('export function diamondRule'));
  assert.deepEqual(shapes(read('assets/brand/cylinder.svg')), shapes(art));
});

test('a splash usa a frase institucional do app (pt-BR) e o nome GasTrack', () => {
  const tagline = /tagline: '([^']+)'/.exec(read('src/app/i18n/pt-BR.ts'))?.[1];
  assert.equal(tagline, 'Sempre um passo à frente.');
  const script = read('scripts/build-native-assets.py');
  assert.match(script, /tagline: '/);          // a frase e lida do pt-BR.ts, nao copiada
  assert.match(script, /\('Gas', .*\('Track', /);
});

test('workflow e package.json: etapas apontam para arquivos existentes e rodam antes do Gradle', () => {
  const wf = read('.github/workflows/android-apk.yml');
  for (const f of new Set(wf.match(/scripts\/[\w.-]+/g))) assert.ok(existsSync(`${root}${f}`), f);
  const order = ['npx cap add android', 'npm run assets:android', 'verify-android-resources', 'npx cap sync android', './gradlew assembleDebug', 'verify-apk-icons', 'report-apk-size'].map((s) => wf.indexOf(s));
  assert.ok(order.every((i, k) => i > (order[k - 1] ?? -1)), `ordem das etapas: ${order}`);
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string>; devDependencies: Record<string, string> };
  assert.ok(pkg.devDependencies['@capacitor/assets']);
  assert.match(pkg.scripts['assets:android'] ?? '', /--assetPath assets\/native/);
  assert.match(pkg.scripts['assets:android'] ?? '', /android-native-resources\.mjs && python3 scripts\/optimize-android-pngs\.py$/); // otimiza depois de gerar tudo
  assert.match(wf, /pillow==/);
  for (const f of new Set((pkg.scripts['assets:android'] ?? '').match(/scripts\/[\w.-]+/g))) assert.ok(existsSync(`${root}${f}`), f);
});
