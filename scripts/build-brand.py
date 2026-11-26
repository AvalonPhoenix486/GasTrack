"""Gera as versoes do cristal a partir do arquivo ORIGINAL (assets/brand/crystal-original.png).
Nada e redesenhado: so recorte, mascara pela silhueta do proprio cristal e redimensionamento (LANCZOS).
Uso: python3 scripts/build-brand.py"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/brand/crystal-original.png'
OUT = ROOT / 'www/brand'
THRESHOLD = 110         # brilho minimo (canal maximo) para considerar pixel do cristal; o fundo e o brilho externo ficam abaixo
PAD = 6                 # margem do recorte, em px do original
FEATHER = 1.2           # suavizacao da borda da mascara, em px do original

def hull(points):
    pts = sorted(set(map(tuple, points)))
    def half(seq):
        h = []
        for p in seq:
            while len(h) >= 2 and (h[-1][0]-h[-2][0])*(p[1]-h[-2][1]) - (h[-1][1]-h[-2][1])*(p[0]-h[-2][0]) <= 0:
                h.pop()
            h.append(p)
        return h
    lo, up = half(pts), half(reversed(pts))
    return lo[:-1] + up[:-1]

def main():
    img = Image.open(SRC).convert('RGB')
    arr = np.asarray(img)
    ys, xs = np.where(arr.max(axis=2) > THRESHOLD)
    # silhueta = fecho convexo dos pixels do cristal (o cristal e um losango convexo)
    edge = np.stack([xs, ys], 1)
    poly = hull(edge[:: max(1, len(edge)//20000)].tolist() + [[xs.min(), ys[xs.argmin()]], [xs.max(), ys[xs.argmax()]], [xs[ys.argmin()], ys.min()], [xs[ys.argmax()], ys.max()]])
    mask = Image.new('L', img.size, 0)
    from PIL import ImageDraw
    ImageDraw.Draw(mask).polygon([tuple(p) for p in poly], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(FEATHER))
    rgba = img.copy(); rgba.putalpha(mask)
    box = (int(xs.min()) - PAD, int(ys.min()) - PAD, int(xs.max()) + PAD + 1, int(ys.max()) + PAD + 1)
    base = rgba.crop(box)
    OUT.mkdir(parents=True, exist_ok=True)
    # largura final em px: grande (splash e Sobre) e pequena (barra superior)
    for name, width in (('crystal-l', base.width), ('crystal-s', 120)):
        h = round(base.height * width / base.width)
        out = base if width == base.width else base.resize((width, h), Image.LANCZOS)
        out.save(OUT / f'{name}.png', optimize=True)
        print(name, out.size)
    # favicon: o mesmo recorte, centrado em quadrado transparente
    side = 128
    fav = base.resize((round(base.width * side / base.height), side), Image.LANCZOS)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(fav, ((side - fav.width) // 2, 0))
    sq.save(OUT / 'favicon.png', optimize=True)

main()
