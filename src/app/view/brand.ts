/**
 * Identidade grafica do GasTrack.
 *  - Cristal: e o ARQUIVO ORIGINAL (assets/brand/crystal-original.png), so recortado e redimensionado
 *    por scripts/build-brand.py. Nada e redesenhado. `www/brand/crystal-s.png` (barra superior) e
 *    `crystal-l.png` (abertura e Sobre) sao o mesmo desenho em tamanhos diferentes.
 *  - Botijao: ilustracao SVG de um botijao de GLP domestico (P13): colar de protecao, valvula, ombros,
 *    corpo cilindrico, anel de base e chama.
 */
import { svgFromMarkup } from './dom.ts';

function crystal(src: string, cls: string): HTMLImageElement {
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.className = cls;
  img.decoding = 'async';
  img.setAttribute('aria-hidden', 'true');
  return img;
}

/** Barra superior. */
export function crystalSmall(cls = 'crystal crystal-s'): HTMLImageElement {
  return crystal('brand/crystal-s.png', cls);
}

/** Abertura (splash) e tela Sobre. */
export function crystalOrnate(cls = 'crystal crystal-o'): HTMLImageElement {
  return crystal('brand/crystal-l.png', cls);
}

/** Botijao de GLP domestico (P13); cores do corpo vem de --cyl-*, a valvula e dourada e a chama laranja. */
export function cylinderArt(cls = 'cylinder-art'): SVGSVGElement {
  return svgFromMarkup(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 120" class="${cls}" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="cy-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--cyl-1)"/><stop offset=".42" stop-color="var(--cyl-2)"/><stop offset="1" stop-color="var(--cyl-3)"/></linearGradient>
      <linearGradient id="cy-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d77a"/><stop offset="1" stop-color="#b8901f"/></linearGradient>
      <radialGradient id="cy-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#16e000" stop-opacity="var(--cyl-glow)"/><stop offset="1" stop-color="#16e000" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="40" cy="70" rx="40" ry="48" fill="url(#cy-glow)"/>
    <path d="M14 104h52v9a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2z" fill="var(--cyl-3)"/>
    <path d="M8 50C8 37 20 32 27 31h26c7 1 19 6 19 19v49c0 6-4 8-9 8H17c-5 0-9-2-9-8z" fill="url(#cy-body)"/>
    <path d="M8 54c11 4 53 4 64 0M8 94c11 4 53 4 64 0" fill="none" stroke="var(--cyl-line)" stroke-width="1.6"/>
    <path d="M17 54c-3 12-3 32 0 44" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="3.5" stroke-linecap="round"/>
    <rect x="28" y="26" width="24" height="8" rx="2" fill="var(--cyl-3)"/>
    <rect x="16" y="9" width="48" height="23" rx="7" fill="var(--cyl-3)"/>
    <rect x="23" y="15" width="34" height="17" rx="3" fill="#000" fill-opacity=".55"/>
    <rect x="36" y="9" width="8" height="23" rx="2" fill="url(#cy-brass)"/>
    <rect x="32" y="4" width="16" height="7" rx="3.500" fill="url(#cy-brass)"/>
    <rect x="43" y="19" width="11" height="5" rx="1.500" fill="url(#cy-brass)"/>
    <path d="M40 62c4 5 10 9 10 16a10 10 0 0 1-20 0c0-4 2-7 5-9 0 3 1 4 3 5-1-4 0-8 2-12z" fill="#ff6a2b"/>
    <path d="M40 73c2.500 2 4.500 4 4.500 6.500a4.500 4.500 0 0 1-9 0c0-2 1.500-3.500 2.500-4.500.5 1 .8 1 1.500 1-.5-1.500 0-2 .5-3z" fill="#ffd27a"/>
  </svg>`);
}

/** Losango pequeno usado como divisor discreto. */
export function diamondRule(): HTMLElement {
  const span = document.createElement('span');
  span.className = 'diamond-rule';
  span.setAttribute('aria-hidden', 'true');
  return span;
}
