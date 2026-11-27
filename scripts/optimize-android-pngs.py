"""Otimiza os PNGs de splash gerados em android/app/src/main/res e imprime o relatorio de tamanho.

Splash (drawable*/splash.png):
  1. lado maior limitado a MAX_SIDE (o Android estica a imagem na tela; acima disso so engorda o APK);
  2. paleta de 256 cores em duas partes: 160 para o fundo liso (degrade vinho/ameixa, sem faixas) e 96 para o
     conteudo (texto, botijao, filete), escolhidas para NAO perder as cores do texto; mapeamento exato (sem dither);
  3. recompressao Deflate (zopfli quando instalado; senao zlib nivel 9).
Icones (mipmap*): so recompressao sem perda.
Determinista: mesmas entradas + mesmas versoes de Pillow/numpy = mesmos bytes.
Uso: python3 scripts/optimize-android-pngs.py [res_dir]"""
import io, struct, sys, zlib
from pathlib import Path
import numpy as np
from PIL import Image

MAX_SIDE = 1600   # px; o xxhdpi do Capacitor ja e 1600x960
BG_COLORS, CONTENT_COLORS = 160, 96
BG_MAX_GREEN = 48  # fundo = pixels com G <= 48 (vinho #490038 e ameixa #1a1020 tem G <= 31); o resto e conteudo
MAX_MAE = 1.0      # erro medio maximo (0-255) aceito; acima disso mantem a imagem sem paleta

try:
    import zopfli.zlib
    ENGINE = 'zopfli'
except ImportError:
    ENGINE = 'zlib'

def png_bytes(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True, compress_level=9)
    return b.getvalue() if ENGINE == 'zlib' else rezopfli(b.getvalue())

def rezopfli(data):
    """Refaz o IDAT com zopfli (mesmos pixels, menos bytes)."""
    pos, idat, others = 8, b'', []
    while pos < len(data):
        n, kind = struct.unpack('>I4s', data[pos:pos + 8]); body = data[pos + 8:pos + 8 + n]; pos += 12 + n
        if kind == b'IDAT': idat += body
        else: others.append((kind, body))
    new = zopfli.zlib.compress(zlib.decompress(idat), numiterations=15)
    out, placed = [data[:8]], False
    for kind, body in others:
        if kind == b'IEND' and not placed: out.append(chunk(b'IDAT', new)); placed = True
        out.append(chunk(kind, body))
    return b''.join(out)

def chunk(kind, body):
    return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body))

def palette_of(pixels, n, power):
    """Paleta de n cores por mediana de corte; cada cor distinta pesa count**power (power<1 protege cores raras)."""
    u, c = np.unique(pixels, axis=0, return_counts=True)
    sample = np.repeat(u, np.maximum(1, np.ceil(c ** power)).astype(int), axis=0).astype('uint8')
    side = int(np.ceil(np.sqrt(len(sample))))
    pad = np.zeros((side * side, 3), 'uint8'); pad[:len(sample)] = sample; pad[len(sample):] = sample[-1]
    q = Image.fromarray(pad.reshape(side, side, 3)).quantize(n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return np.array(q.getpalette()[:3 * n]).reshape(-1, 3)

def to_palette(rgb):
    a = np.asarray(rgb).reshape(-1, 3)
    bg = a[:, 1] <= BG_MAX_GREEN
    pal = np.vstack([palette_of(a[bg], BG_COLORS, 1.0), palette_of(a[~bg], CONTENT_COLORS, 0.5)]).astype(int)
    packed = (a[:, 0].astype(np.int64) << 16) | (a[:, 1].astype(np.int64) << 8) | a[:, 2]
    u, inv = np.unique(packed, return_inverse=True)
    uc = np.stack([u >> 16, (u >> 8) & 255, u & 255], axis=1)
    idx = np.empty(len(u), 'uint8')
    for i in range(0, len(u), 2048):   # vizinho mais proximo exato, em blocos
        idx[i:i + 2048] = ((uc[i:i + 2048, None, :] - pal[None, :, :]) ** 2).sum(2).argmin(1)
    q = Image.fromarray(idx[inv.reshape(-1)].reshape(rgb.height, rgb.width), 'P')
    q.putpalette(pal.astype('uint8').flatten().tolist())
    return q

res = Path(sys.argv[1] if len(sys.argv) > 1 else 'android/app/src/main/res')
if not res.is_dir(): sys.exit(f'ERRO: {res} nao existe (rode "npx cap add android" antes)')

rows = []   # (caminho, largura, altura, antes, depois, erro medio)
for f in sorted(res.rglob('*.png')):
    if not f.parent.name.startswith(('drawable', 'mipmap')): continue
    before = f.read_bytes()
    im = Image.open(io.BytesIO(before)); im.load()
    best, mae = png_bytes(im), 0.0
    if f.name == 'splash.png' and f.parent.name.startswith('drawable'):
        rgb = im.convert('RGB')
        if max(rgb.size) > MAX_SIDE:
            k = MAX_SIDE / max(rgb.size)
            rgb = rgb.resize((round(rgb.width * k), round(rgb.height * k)), Image.LANCZOS)
        q = to_palette(rgb)
        mae = float(np.abs(np.asarray(rgb).astype(int) - np.asarray(q.convert('RGB')).astype(int)).mean())
        cand = png_bytes(q) if mae <= MAX_MAE else png_bytes(rgb)
        if len(cand) < len(best): best, im = cand, rgb
        else: mae = 0.0
    if len(best) < len(before): f.write_bytes(best)
    rows.append((str(f.relative_to(res)), im.width, im.height, len(before), min(len(best), len(before)), mae))

splash = [r for r in rows if r[0].endswith('/splash.png')]
print(f'motor de compressao: {ENGINE}; PNGs processados: {len(rows)}; splash: {len(splash)}')
print(f'splash: {sum(r[3] for r in splash) / 1024:.0f} KiB -> {sum(r[4] for r in splash) / 1024:.0f} KiB')
print(f'todos os PNGs: {sum(r[3] for r in rows) / 1024:.0f} KiB -> {sum(r[4] for r in rows) / 1024:.0f} KiB')
print('maiores depois da otimizacao (dimensao final):')
for r in sorted(rows, key=lambda r: -r[4])[:8]:
    print(f'  {r[0]:48s} {r[1]}x{r[2]:<5} {r[3] / 1024:7.0f} -> {r[4] / 1024:6.0f} KiB  erro medio {r[5]:.2f}')
