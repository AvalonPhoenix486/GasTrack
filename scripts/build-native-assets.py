"""Gera as fontes SVG e os PNGs mestres do icone e da splash nativos do Android.
Entrada:  assets/brand/cylinder.svg (o botijao da interface) e a frase de src/app/i18n/pt-BR.ts.
Saida:    assets/brand/native-src/*.svg (fontes vetoriais) e assets/native/*.png (mestres para o @capacitor/assets).
O texto vira contorno (fontTools + Gelasio, compativel com Georgia, a fonte do logotipo no app) para o SVG
nao depender de fontes instaladas. Requer: python3, pillow, fonttools, playwright (Chromium). Uso: python3 scripts/build-native-assets.py"""
import re
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import numpy as np
from PIL import Image, ImageFilter
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/brand/native-src'
OUT = ROOT / 'assets/native'
FONTS = Path('/usr/share/fonts/truetype/google-fonts/ofl/gelasio')

# cores do projeto (src/app/i18n e www/style.css)
WINE_CENTER, WINE, WINE_DEEP = '#6a0a55', '#490038', '#2d0023'
PLUM_CENTER, PLUM, PLUM_DEEP = '#2a1230', '#1a1020', '#120d17'
TEXT_LIGHT, TEXT_MUTED, GREEN_TEXT = '#f6e9f1', '#d9bfd0', '#6df25a'

def tagline():
    m = re.search(r"tagline: '([^']+)'", (ROOT / 'src/app/i18n/pt-BR.ts').read_text(encoding='utf-8'))
    assert m, 'frase institucional nao encontrada em pt-BR.ts'
    return m.group(1)

def cylinder_inner():
    svg = (ROOT / 'assets/brand/cylinder.svg').read_text(encoding='utf-8')
    return re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S).group(1)   # <defs> + formas

def cylinder(cx, cy, height):
    """Botijao centrado em (cx, cy) com a altura dada (area desenhada: x 8..72, y 4..115 do viewBox 80x120)."""
    s = height / 111
    return f'<g transform="translate({cx - 40 * s:.2f} {cy - 59.5 * s:.2f}) scale({s:.4f})">{cylinder_inner()}</g>'

def glow(cx, cy, r, alpha):
    return (f'<defs><radialGradient id="glow"><stop offset="0" stop-color="#16e000" stop-opacity="{alpha}"/>'
            f'<stop offset="1" stop-color="#16e000" stop-opacity="0"/></radialGradient></defs>'
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#glow)"/>')

def bg(size, c0, c1, c2, cy=0.4):
    return (f'<defs><radialGradient id="bg" cx="0.5" cy="{cy}" r="0.85"><stop offset="0" stop-color="{c0}"/>'
            f'<stop offset=".55" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></radialGradient></defs>'
            f'<rect width="{size}" height="{size}" fill="url(#bg)"/>')

def load_font(name, wght):
    return instancer.instantiateVariableFont(TTFont(FONTS / name), {'wght': wght}, inplace=False)

def run(font, text, size):
    gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font['head'].unitsPerEm
    k = size / upm
    names = [cmap[ord(c)] for c in text]
    return names, gs, k, sum(font['hmtx'][n][0] for n in names) * k

def path_of(font, text, size, x, base):
    names, gs, k, _ = run(font, text, size)
    pen = SVGPathPen(gs, ntos=lambda v: f'{v:.2f}')
    for n in names:
        gs[n].draw(TransformPen(pen, (k, 0, 0, -k, x, base)))
        x += font['hmtx'][n][0] * k
    return pen.getCommands()

def centered(font, parts, size, cx, base):
    """parts: [(texto, cor)] numa linha so, centralizada em cx."""
    widths = [run(font, t, size)[3] for t, _ in parts]
    x, out = cx - sum(widths) / 2, []
    for (t, color), w in zip(parts, widths):
        out.append(f'<path d="{path_of(font, t, size, x, base)}" fill="{color}"/>')
        x += w
    return ''.join(out)

def svg(size, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">{body}</svg>\n'

def splash(c0, c1, c2, glow_alpha):
    bold, italic = load_font('Gelasio[wght].ttf', 700), load_font('Gelasio-Italic[wght].ttf', 400)
    cx = 1366
    rule = (f'<path d="M{cx - 260} 1905H{cx - 36}M{cx + 36} 1905H{cx + 260}" stroke="{TEXT_MUTED}" stroke-opacity=".5" stroke-width="4"/>'
            f'<path d="M{cx} 1883l22 22-22 22-22-22z" fill="#f3d77a"/>')
    return svg(2732, bg(2732, c0, c1, c2) + glow(cx, 1000, 760, glow_alpha) + cylinder(cx, 1000, 760)
               + centered(bold, [('Gas', TEXT_LIGHT), ('Track', GREEN_TEXT)], 260, cx, 1700)
               + rule + centered(italic, [(tagline(), TEXT_MUTED)], 104, cx, 2085))

def denoise(im, radius=4, tol=3):
    """O Chromium aplica dither (+-1 nivel) nos degradês: ruido que o PNG nao comprime.
    Troca so os pixels de fundo (diferem <= tol da media local) pela media; texto e bordas ficam intactos."""
    a = np.asarray(im).astype(int)
    b = np.asarray(im.filter(ImageFilter.BoxBlur(radius))).astype(int)
    keep = (np.abs(a - b).max(axis=2) <= tol)[..., None]
    return Image.fromarray(np.where(keep, b, a).astype('uint8'))

def main():
    SRC.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
    files = {
        # icone adaptavel: fundo (vinho) e primeiro plano (botijao na zona segura central de 66/108)
        'icon-background': svg(1024, bg(1024, WINE_CENTER, WINE, WINE_DEEP)),
        'icon-foreground': svg(1024, glow(512, 512, 330, 0.18) + cylinder(512, 512, 556)),
        # icone legado (quadrado/redondo): fundo + botijao maior
        'icon-only': svg(1024, bg(1024, WINE_CENTER, WINE, WINE_DEEP) + glow(512, 512, 420, 0.2) + cylinder(512, 512, 680)),
        'splash': splash(WINE_CENTER, WINE, WINE_DEEP, 0.16),
        'splash-dark': splash(PLUM_CENTER, PLUM, PLUM_DEEP, 0.34),
        # icone da splash do Android 12+ (288dp; conteudo dentro do circulo de 192dp): so o botijao
        'splash-icon': svg(1152, cylinder(576, 576, 520)),
    }
    transparent = {'icon-foreground', 'splash-icon'}
    for name, markup in files.items():
        (SRC / f'{name}.svg').write_text(markup, encoding='utf-8')
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, markup in files.items():
            side = int(re.search(r'width="(\d+)"', markup).group(1))
            page = b.new_page(viewport={'width': side, 'height': side}, device_scale_factor=1)
            page.set_content(f'<html><body style="margin:0;background:transparent">{markup}</body></html>')
            page.screenshot(path=str(OUT / f'{name}.png'), omit_background=name in transparent)
            page.close()
            png = OUT / f'{name}.png'
            im = Image.open(png)
            if name not in transparent: im = denoise(im.convert('RGB'))
            im.save(png, optimize=True, compress_level=9)
            print(name, side)
        b.close()

main()
