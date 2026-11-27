"""Confere o APK gerado: o icone e a splash do GasTrack estao DENTRO do APK (nao os padroes do Capacitor).
Uso: python3 scripts/verify-apk-icons.py <apk> <aapt2>   (requer pillow)"""
import io, re, subprocess, sys, zipfile
from PIL import Image

apk, aapt2 = sys.argv[1], sys.argv[2]
dump = subprocess.run([aapt2, 'dump', 'resources', apk], capture_output=True, text=True, check=True).stdout
errors = []

def files_of(resource):
    """Arquivos (res/...) de um recurso, lidos de `aapt2 dump resources`."""
    out, current = [], False
    for line in dump.splitlines():
        m = re.match(r'\s*resource 0x[0-9a-f]+ (\S+)', line)
        if m: current = m.group(1) == resource
        elif current:
            f = re.search(r'\(file\) (\S+)', line)
            if f: out.append(f.group(1))
    return out

z = zipfile.ZipFile(apk)
def image(path): return Image.open(io.BytesIO(z.read(path))).convert('RGB')
def near(px, rgb, tol): return all(abs(a - b) <= tol for a, b in zip(px, rgb))
WINE, PLUM = (0x49, 0x00, 0x38), (0x1A, 0x10, 0x20)

# icone legado: quadrado de fundo vinho (a lateral esquerda, a 8% da borda, fica fora do botijao)
legacy = [f for f in files_of('mipmap/ic_launcher') if f.endswith('.png')]
print('mipmap/ic_launcher:', legacy)
if len(legacy) < 5: errors.append('mipmap/ic_launcher deveria ter PNGs em 5 densidades')
for f in legacy:
    im = image(f); px = im.getpixel((round(im.width * .08), im.height // 2))
    if not near(px, (0x45, 0x05, 0x37), 60): errors.append(f'{f}: pixel {px} nao e o vinho do GasTrack (icone padrao do Capacitor?)')
# fundo adaptavel
bgs = files_of('mipmap/ic_launcher_background') or files_of('color/ic_launcher_background')
print('fundo adaptavel:', bgs)
if not files_of('mipmap/ic_launcher_foreground'): errors.append('sem mipmap/ic_launcher_foreground (icone adaptavel)')
if not [f for f in files_of('mipmap/ic_launcher') if f.endswith('.xml')]: errors.append('sem mipmap-anydpi-v26/ic_launcher.xml (icone adaptavel)')
# splash (Android <= 11): imagem retrato; variante clara vinho, escura ameixa
splash = [f for f in files_of('drawable/splash') if f.endswith('.png')]
print('drawable/splash:', splash)
if not splash: errors.append('sem drawable/splash')
for f in splash:
    im = image(f); px = im.getpixel((round(im.width * .04), round(im.height * .96)))
    ok = near(px, WINE, 40) if 'night' not in f else near(px, PLUM, 30)
    if im.height <= im.width and 'land' not in f and 'port' in f: errors.append(f'{f}: nao e retrato')
    if not (near(px, (0x2D, 0, 0x23), 45) or near(px, (0x12, 0x0D, 0x17), 30) or ok): errors.append(f'{f}: canto {px} nao e do fundo do GasTrack')
# splash do Android 12+
print('gastrack_splash_icon:', files_of('drawable/gastrack_splash_icon'))
if not files_of('drawable/gastrack_splash_icon'): errors.append('sem drawable/gastrack_splash_icon')
if not files_of('color/gastrack_splash_background'): errors.append('sem color/gastrack_splash_background')
# manifesto: icone aponta para os recursos
badging = subprocess.run([aapt2, 'dump', 'badging', apk], capture_output=True, text=True, check=True).stdout
print('\n'.join(l for l in badging.splitlines() if l.startswith(('application-label', 'application-icon-640', 'launchable'))))
if 'ic_launcher' not in badging: errors.append('manifesto nao aponta para ic_launcher')
if errors:
    print('\nERROS:\n' + '\n'.join('  - ' + e for e in errors)); sys.exit(1)
print('\nOK: o APK contem o icone (legado + adaptavel) e a splash do GasTrack.')
