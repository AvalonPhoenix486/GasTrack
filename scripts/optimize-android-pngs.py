"""Otimiza os PNGs de splash gerados em android/app/src/main/res e imprime o relatorio de tamanho.
Splash: paleta de 256 cores (mediana de corte, sem alpha) quando o erro medio fica abaixo do limite; senao so recompressao sem perda.
Demais PNGs (icones): so recompressao sem perda. Determinista: mesmas entradas + Pillow fixo = mesmos bytes.
Uso: python3 scripts/optimize-android-pngs.py [res_dir]"""
import io, sys
from pathlib import Path
import numpy as np
from PIL import Image

MAX_MAE = 1.0   # erro medio maximo (0-255) aceito na paleta; o fundo e liso, so o texto tem borda suave
res = Path(sys.argv[1] if len(sys.argv) > 1 else 'android/app/src/main/res')
if not res.is_dir(): sys.exit(f'ERRO: {res} nao existe (rode "npx cap add android" antes)')

def encode(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True, compress_level=9); return b.getvalue()

rows = []   # (caminho, largura, altura, antes, depois, erro)
for f in sorted(res.rglob('*.png')):
    if not (f.parent.name.startswith(('drawable', 'mipmap'))): continue
    before = f.read_bytes()
    im = Image.open(io.BytesIO(before)); im.load()
    best, mae = encode(im), 0.0
    if f.name == 'splash.png' and f.parent.name.startswith('drawable'):
        rgb = im.convert('RGB')
        q = rgb.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        mae = float(np.abs(np.asarray(rgb).astype(int) - np.asarray(q.convert('RGB')).astype(int)).mean())
        if mae <= MAX_MAE and len(encode(q)) < len(best): best = encode(q)
        else: mae = 0.0
    if len(best) < len(before): f.write_bytes(best)
    rows.append((str(f.relative_to(res)), im.width, im.height, len(before), min(len(best), len(before)), mae))

def total(sel): return sum(r[4] for r in sel)
splash = [r for r in rows if r[0].endswith('/splash.png')]
print(f'PNGs processados: {len(rows)}; splash: {len(splash)}')
print(f'splash: {sum(r[3] for r in splash)/1024:.0f} KiB -> {total(splash)/1024:.0f} KiB')
print(f'todos os PNGs: {sum(r[3] for r in rows)/1024:.0f} KiB -> {total(rows)/1024:.0f} KiB')
print('maiores depois da otimizacao:')
for r in sorted(rows, key=lambda r: -r[4])[:8]:
    print(f'  {r[0]:48s} {r[1]}x{r[2]:<5} {r[3]/1024:7.0f} -> {r[4]/1024:6.0f} KiB  erro medio {r[5]:.2f}')
