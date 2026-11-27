// Complementa o @capacitor/assets no projeto android/ (gerado por `cap add android`):
// splash do Android 12+ (fundo vinho + botijao) e cores por tema. Falha alto se o modelo do Capacitor mudar.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const res = join(process.cwd(), 'android/app/src/main/res');
const fail = (msg) => { console.error(`ERRO: ${msg}`); process.exit(1); };
if (!existsSync(res)) fail(`${res} nao existe (rode "npx cap add android" antes)`);

const put = (rel, text) => { const f = join(res, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text); };
const colors = (hex) => `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="gastrack_splash_background">${hex}</color>\n</resources>\n`;

mkdirSync(join(res, 'drawable-nodpi'), { recursive: true });
copyFileSync('assets/native/splash-icon.png', join(res, 'drawable-nodpi/gastrack_splash_icon.png'));
put('values/gastrack_splash.xml', colors('#490038'));        // vinho da identidade (tema claro)
put('values-night/gastrack_splash.xml', colors('#1A1020'));  // ameixa escuro (tema escuro)

const styles = join(res, 'values/styles.xml');
if (!existsSync(styles)) fail('values/styles.xml ausente');
let xml = readFileSync(styles, 'utf8');
const m = xml.match(/<style\s+name="AppTheme\.NoActionBarLaunch"\s+parent="([^"]+)"\s*>[\s\S]*?<\/style>/);
if (!m) fail('estilo AppTheme.NoActionBarLaunch nao encontrado em styles.xml');
if (!/SplashScreen/.test(m[1])) fail(`o tema de abertura usa o pai "${m[1]}", nao o tema de splash do AndroidX`);
if (!m[0].includes('windowSplashScreenAnimatedIcon')) {
  const items = '<item name="windowSplashScreenBackground">@color/gastrack_splash_background</item>\n'
    + '        <item name="windowSplashScreenAnimatedIcon">@drawable/gastrack_splash_icon</item>\n    ';
  xml = xml.replace(m[0], m[0].replace(/<\/style>$/, `${items}</style>`));
  writeFileSync(styles, xml);
}
console.log('Splash Android 12+ configurada:\n' + readFileSync(styles, 'utf8').match(/<style\s+name="AppTheme\.NoActionBarLaunch"[\s\S]*?<\/style>/)[0]);
