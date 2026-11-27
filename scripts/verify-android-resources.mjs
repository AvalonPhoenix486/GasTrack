// Confere o projeto android/ ANTES do Gradle: recursos gerados presentes e nenhuma referencia a recurso inexistente.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const base = join(process.cwd(), 'android/app/src/main');
const res = join(base, 'res');
const errors = [];
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(res);
const rel = (f) => f.slice(res.length + 1);

// 1. recursos que o @capacitor/assets e o script de splash devem ter gerado
const need = (label, ok) => { if (!ok) errors.push(`faltando: ${label}`); };
const inDirs = (dirRe, name) => files.filter((f) => dirRe.test(rel(f).split('/')[0]) && rel(f).split('/').pop() === name);
for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  for (const n of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) need(`mipmap-${d}/${n}`, inDirs(new RegExp(`^mipmap-${d}(-v\\d+)?$`), n).length > 0);
}
need('mipmap-anydpi-v26/ic_launcher.xml', files.some((f) => /^mipmap-anydpi/.test(rel(f)) && f.endsWith('ic_launcher.xml')));
need('splash.png em drawable-*', files.some((f) => /^drawable.*\/splash\.png$/.test(rel(f))));
need('splash.png de tema escuro (night)', files.some((f) => /^drawable.*night.*\/splash\.png$/.test(rel(f))));
need('drawable-nodpi/gastrack_splash_icon.png', existsSync(join(res, 'drawable-nodpi/gastrack_splash_icon.png')));
need('values/gastrack_splash.xml e values-night/gastrack_splash.xml', existsSync(join(res, 'values/gastrack_splash.xml')) && existsSync(join(res, 'values-night/gastrack_splash.xml')));
need('estilo de abertura com windowSplashScreenAnimatedIcon', /windowSplashScreenAnimatedIcon/.test(readFileSync(join(res, 'values/styles.xml'), 'utf8')));

// 2. toda referencia @tipo/nome (manifesto e XMLs de res) precisa existir
const FILE_TYPES = new Set(['drawable', 'mipmap', 'xml', 'layout']);
const VALUE_TYPES = new Set(['color', 'string', 'style', 'dimen', 'bool', 'integer']);
const stems = new Map();   // tipo -> nomes de arquivo
for (const f of files) { const [dir, ...rest] = rel(f).split('/'); const t = dir.split('-')[0]; if (rest.length) (stems.get(t) ?? stems.set(t, new Set()).get(t)).add(rest.join('/').replace(/\.[^.]+$/, '')); }
const values = new Set();  // "tipo/nome"
for (const f of files.filter((f) => /^values/.test(rel(f)) && f.endsWith('.xml'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/<(color|string|style|dimen|bool|integer)\b[^>]*\bname="([^"]+)"/g)) values.add(`${m[1]}/${m[2]}`);
}
const sources = [join(base, 'AndroidManifest.xml'), ...files.filter((f) => f.endsWith('.xml'))];
for (const f of sources) {
  for (const m of readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '').matchAll(/@(?!android:)(\w+)\/([\w.]+)/g)) {
    const [, type, name] = m;
    const ok = FILE_TYPES.has(type) ? (stems.get(type)?.has(name) ?? false) : VALUE_TYPES.has(type) ? values.has(`${type}/${name}`) : true;
    if (!ok) errors.push(`referencia sem recurso: @${type}/${name} em ${f.startsWith(res) ? rel(f) : 'AndroidManifest.xml'}`);
  }
}

console.log(`${files.length} arquivos em res/; recursos de icone/splash:`);
for (const f of files.filter((f) => /ic_launcher|splash/.test(rel(f)))) console.log('  ' + rel(f));
if (errors.length) { console.error('\nERROS:\n' + errors.map((e) => '  - ' + e).join('\n')); process.exit(1); }
console.log('\nOK: recursos nativos presentes e referencias resolvidas.');
