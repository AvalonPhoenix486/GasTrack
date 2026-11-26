/**
 * Identidade grafica do GasTrack: o cristal (losango verde, losango central, quatro facetas e
 * moldura dourada) em tres niveis de detalhe, mais a ilustracao do botijao.
 *  - crystalSmall:  icone pequeno (barra superior, favicon): so a silhueta e o losango central.
 *  - crystalMedium: elementos de identidade: facetas, divisoes e moldura.
 *  - crystalOrnate: splash e "Sobre": filigranas nos vertices, veios e brilho.
 * Marcacao estatica; cores do cristal fixas (a gema e a mesma nos dois temas).
 */
import { svgFromMarkup } from './dom.ts';

const OUTER = 'M50 2L98 80L50 162L2 80Z';
const INNER = 'M50 48L70 79L50 110L30 79Z';

const GRADIENTS = `
  <linearGradient id="gt-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8dff6e"/><stop offset="1" stop-color="#1bd200"/></linearGradient>
  <linearGradient id="gt-b" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fe215"/><stop offset="1" stop-color="#0a7a00"/></linearGradient>
  <linearGradient id="gt-c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#17b900"/><stop offset="1" stop-color="#065c00"/></linearGradient>
  <linearGradient id="gt-d" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#119800"/><stop offset="1" stop-color="#074d00"/></linearGradient>
  <linearGradient id="gt-core" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0c6d00"/><stop offset="1" stop-color="#033b00"/></linearGradient>
  <linearGradient id="gt-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d77a"/><stop offset="1" stop-color="#b8901f"/></linearGradient>`;

/** Facetas externas: cima-esq., cima-dir., baixo-esq., baixo-dir. */
const FACETS = `
  <path d="M50 2L2 80L30 79L50 48Z" fill="url(#gt-a)"/>
  <path d="M50 2L98 80L70 79L50 48Z" fill="url(#gt-b)"/>
  <path d="M2 80L50 162L50 110L30 79Z" fill="url(#gt-c)"/>
  <path d="M98 80L50 162L50 110L70 79Z" fill="url(#gt-d)"/>
  <path d="${INNER}" fill="url(#gt-core)"/>`;

const DIVISIONS = `<path d="M50 2V48M2 80H30M70 79H98M50 110V162" fill="none" stroke="url(#gt-gold)" stroke-width="1.6" stroke-linecap="round"/>`;

const FRAME = `<path d="${OUTER}" fill="none" stroke="url(#gt-gold)" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="${INNER}" fill="none" stroke="url(#gt-gold)" stroke-width="2" stroke-linejoin="round"/>`;

/** Curva de filigrana (volta em espiral) junto de um vertice; replicada com transformacoes. */
const CURL = 'M0 0c-4.5-1.5-8 1.5-7 5.2 1 3.3 5.6 3.5 6.4.4.5-2-1.6-3.1-2.6-2';

function svg(viewBox: string, cls: string, body: string, label?: string): SVGSVGElement {
  const aria = label === undefined ? 'aria-hidden="true" focusable="false"' : `role="img" aria-label="${label}"`;
  return svgFromMarkup(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" class="${cls}" ${aria}><defs>${GRADIENTS}</defs>${body}</svg>`);
}

/** Icone pequeno: silhueta + losango central. */
export function crystalSmall(cls = 'crystal crystal-s'): SVGSVGElement {
  return svg('0 0 100 164', cls, `
    <path d="${OUTER}" fill="url(#gt-a)" stroke="url(#gt-gold)" stroke-width="5" stroke-linejoin="round"/>
    <path d="${INNER}" fill="url(#gt-core)"/>`);
}

/** Versao intermediaria: facetas, divisoes douradas e moldura. */
export function crystalMedium(cls = 'crystal crystal-m', label?: string): SVGSVGElement {
  return svg('0 0 100 164', cls, `${FACETS}${DIVISIONS}${FRAME}
    <path d="M44 22L16 74" stroke="#d6ffc9" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>`, label);
}

/** Versao ornamental: filigranas nos vertices, veios de marmore e brilho de fundo. */
export function crystalOrnate(cls = 'crystal crystal-o', label?: string): SVGSVGElement {
  return svg('-30 -14 160 192', cls, `
    <defs>
      <radialGradient id="gt-aura" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#16e000" stop-opacity=".38"/><stop offset="1" stop-color="#16e000" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="50" cy="82" rx="78" ry="92" fill="url(#gt-aura)"/>
    <path d="M-18 120C-6 70 30 150 52 96S96 40 118 60" fill="none" stroke="#490038" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>
    <path d="M-14 30C10 6 36 40 60 20" fill="none" stroke="#7a1f63" stroke-opacity=".35" stroke-width="2.2" stroke-linecap="round"/>
    ${FACETS}
    <g fill="none" stroke="#d6ffc9" stroke-opacity=".32" stroke-width="1.2" stroke-linecap="round">
      <path d="M44 20C34 38 24 56 14 74"/><path d="M62 28C74 44 82 60 90 76"/><path d="M38 96C42 110 46 124 48 142"/><path d="M60 100C66 114 62 128 56 146"/>
    </g>
    ${DIVISIONS}${FRAME}
    <g fill="none" stroke="url(#gt-gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="${CURL}" transform="translate(44 17)"/><path d="${CURL}" transform="translate(56 17) scale(-1 1)"/>
      <path d="${CURL}" transform="translate(11 73)"/><path d="${CURL}" transform="translate(89 73) scale(-1 1)"/>
      <path d="${CURL}" transform="translate(11 87) scale(1 -1)"/><path d="${CURL}" transform="translate(89 87) scale(-1 -1)"/>
      <path d="${CURL}" transform="translate(44 147) scale(1 -1)"/><path d="${CURL}" transform="translate(56 147) scale(-1 -1)"/>
    </g>`, label);
}

/** Botijao estilizado (metal neutro) com brilho verde discreto; decorativo. */
export function cylinderArt(cls = 'cylinder-art'): SVGSVGElement {
  return svgFromMarkup(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 112" class="${cls}" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="cy-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--cyl-1)"/><stop offset=".45" stop-color="var(--cyl-2)"/><stop offset="1" stop-color="var(--cyl-3)"/></linearGradient>
      <radialGradient id="cy-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#16e000" stop-opacity="var(--cyl-glow)"/><stop offset="1" stop-color="#16e000" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="42" cy="70" rx="40" ry="42" fill="url(#cy-glow)"/>
    <path d="M26 16h28a5 5 0 0 1 0 10H26a5 5 0 0 1 0-10z" fill="var(--cyl-3)"/>
    <rect x="34" y="24" width="12" height="12" rx="3" fill="var(--cyl-2)"/>
    <rect x="14" y="34" width="52" height="72" rx="24" fill="url(#cy-body)"/>
    <path d="M14 56h52M14 84h52" stroke="var(--cyl-line)" stroke-width="1.6" fill="none"/>
    <path d="M24 46c-3 14-3 36 0 52" stroke="#fff" stroke-opacity=".38" stroke-width="3" stroke-linecap="round" fill="none"/>
  </svg>`);
}

/** Losango pequeno usado como divisor discreto. */
export function diamondRule(): HTMLElement {
  const span = document.createElement('span');
  span.className = 'diamond-rule';
  span.setAttribute('aria-hidden', 'true');
  return span;
}
