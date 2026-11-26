/**
 * Camada DOM: so exibe o modelo da tela e repassa os eventos. Sem regra de negocio.
 * As telas ficam em ./view/*; aqui ficam a estrutura fixa (topo, abas, avisos, paineis) e a abertura.
 */
import { messagesFor } from './i18n/index.ts';
import type { Locale, Messages } from './i18n/index.ts';
import type { Screen } from './screen.ts';
import { crystalOrnate, crystalSmall } from './view/brand.ts';
import type { ViewContext } from './view/context.ts';
import { el, h, icon } from './view/dom.ts';
import type { IconName } from './view/dom.ts';
import { forecastView } from './view/forecastTab.ts';
import { historyView } from './view/history.ts';
import { homeView } from './view/home.ts';
import { sheetContent } from './view/sheets.ts';
import { settingsView } from './view/settingsView.ts';
import { statsView } from './view/stats.ts';
import type { Extras, Handlers, Sheet, Tab, UiState } from './view/types.ts';

export type { Extras, Handlers, SettingsPage, Sheet, Tab, UiState } from './view/types.ts';

const TABS: readonly { readonly id: Tab; readonly icon: IconName }[] = [
  { id: 'home', icon: 'home' },
  { id: 'history', icon: 'history' },
  { id: 'stats', icon: 'stats' },
  { id: 'forecast', icon: 'forecast' },
  { id: 'settings', icon: 'settings' },
];

const THEME_ICON = { system: 'auto', light: 'sun', dark: 'moon' } as const;

let handlers: Handlers | null = null;
let renderedSheetKey: string | null = null;
let sheetOpener: HTMLElement | null = null;
let toastTimer: number | undefined;
let lastViewKey: string | null = null;
let brandDrawn = false;

// ---------- ligacao e feedback ----------
export function bind(h2: Handlers): void {
  handlers = h2;
  el('theme-button').addEventListener('click', () => h2.onQuickTheme());
}

function setBox(id: string, message: string | null): void {
  const box = el(id);
  box.textContent = message ?? '';
  box.hidden = message === null;
}

export function showNotice(message: string | null): void {
  setBox('notice', message);
}

/** Erro de uma acao: aparece DENTRO do painel aberto, junto do formulario. */
export function showError(message: string | null): void {
  const box = document.getElementById('sheet-error');
  if (box === null) {
    // Sem painel aberto: nao pode ficar silencioso.
    if (message !== null) showToast(message, 'error');
    return;
  }
  box.textContent = message ?? '';
  box.hidden = message === null;
  if (message !== null && typeof box.scrollIntoView === 'function') box.scrollIntoView({ block: 'nearest' });
}

export function showToast(message: string, kind: 'success' | 'error' = 'success'): void {
  const toast = el('toast');
  toast.replaceChildren(icon(kind === 'error' ? 'alert' : 'checkCircle', 20), h('span', null, message));
  toast.dataset['kind'] = kind;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4000);
}

/** Enquanto uma acao roda: desabilita os botoes e sinaliza aria-busy. */
export function setBusy(busy: boolean): void {
  el('app').setAttribute('aria-busy', String(busy));
  for (const b of document.querySelectorAll<HTMLButtonElement>('#app button, #sheet-root button')) {
    if (busy) {
      b.dataset['wasDisabled'] = b.disabled ? '1' : '0';
      b.disabled = true;
    } else if (b.dataset['wasDisabled'] !== undefined) {
      b.disabled = b.dataset['wasDisabled'] === '1';
      delete b.dataset['wasDisabled'];
    }
  }
}

// ---------- plataforma: aparencia, area de transferencia, arquivo, abertura ----------
export interface Appearance {
  readonly theme: UiState['theme'];
  readonly animations: boolean;
  readonly locale: Locale;
}

export function applyAppearance(a: Appearance): void {
  const root = document.documentElement;
  if (a.theme === 'system') delete root.dataset['theme']; else root.dataset['theme'] = a.theme;
  root.dataset['motion'] = a.animations ? 'on' : 'off';
  root.lang = a.locale;
}

/** Tenta copiar para a area de transferencia; em falha, tenta o metodo antigo. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // cai no metodo alternativo
  }
  const box = document.getElementById('export-text');
  if (box instanceof HTMLTextAreaElement) {
    box.focus({ preventScroll: true });
    box.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
  return false;
}

/** Baixa um arquivo de texto (navegador). No app Android depende de plugin: ver `canDownload`. */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Abertura: cristal ornamental com a marca. Sem animacao, some de imediato. Resolve quando termina. */
export function runSplash(m: Messages, animate: boolean): Promise<void> {
  const splash = document.getElementById('splash');
  if (splash === null) return Promise.resolve();
  if (!animate) { splash.remove(); return Promise.resolve(); }
  splash.replaceChildren(
    crystalOrnate('crystal crystal-o splash-crystal'),
    h('p', { class: 'wordmark splash-wordmark' }, 'Gas', h('em', null, 'Track')),
    h('p', { class: 'tagline' }, m.app.tagline));
  splash.hidden = false;
  return new Promise((resolve) => {
    window.setTimeout(() => {
      splash.classList.add('leaving');
      window.setTimeout(() => { splash.remove(); resolve(); }, 380);
    }, 1100);
  });
}

// ---------- estrutura fixa ----------
function renderBrand(m: Messages): void {
  const brand = el('brand');
  if (!brandDrawn) {
    brandDrawn = true;
    brand.replaceChildren(crystalSmall('crystal crystal-s brand-crystal'), h('span', { class: 'wordmark' }, 'Gas', h('em', null, 'Track')));
  }
  brand.setAttribute('aria-label', m.app.name);
}

function renderTabs(ui: UiState, m: Messages): void {
  const nav = el('tabs');
  nav.setAttribute('aria-label', m.nav.label);
  nav.replaceChildren();
  for (const t of TABS) {
    const active = t.id === ui.tab;
    const b = h('button', { type: 'button', class: active ? 'tab active' : 'tab', 'data-tab': t.id, 'aria-current': active ? 'page' : undefined },
      icon(t.icon, 22), h('span', null, m.nav[t.id]));
    b.addEventListener('click', () => handlers?.onTab(t.id));
    nav.append(b);
  }
}

function renderThemeButton(ui: UiState, m: Messages): void {
  const label = m.theme[ui.theme];
  const b = el('theme-button');
  b.setAttribute('aria-label', m.theme.toggle(label));
  b.setAttribute('title', m.theme.changed(label));
  b.replaceChildren(icon(THEME_ICON[ui.theme], 22));
}

// ---------- paineis (bottom sheets) ----------
function sheetKey(sheet: Sheet): string | null {
  return sheet === null ? null : JSON.stringify(sheet);
}

function trapFocus(root: HTMLElement, e: KeyboardEvent): void {
  if (e.key === 'Escape') { e.preventDefault(); handlers?.onCloseSheet(); return; }
  if (e.key !== 'Tab') return;
  const items = [...root.querySelectorAll<HTMLElement>('button, input, select, textarea, [href]')].filter((n) => !n.hasAttribute('disabled'));
  const first = items[0];
  const last = items[items.length - 1];
  if (first === undefined || last === undefined) return;
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function renderSheet(ctx: ViewContext, ui: UiState, screen: Screen, extras: Extras): void {
  const root = el('sheet-root');
  const key = sheetKey(ui.sheet);
  if (key === renderedSheetKey) return; // mantem o painel (e o que o usuario digitou) como esta
  const hadSheet = renderedSheetKey !== null;
  renderedSheetKey = key;
  root.replaceChildren();
  const inert = ['topbar', 'view', 'tabs'];
  const content = ui.sheet === null ? null : sheetContent(ctx, ui.sheet, screen, extras);
  document.body.classList.toggle('sheet-open', content !== null);
  for (const id of inert) {
    const n = el(id);
    if (content !== null) n.setAttribute('aria-hidden', 'true'); else n.removeAttribute('aria-hidden');
  }
  if (content === null) {
    if (hadSheet) {
      // devolve o foco a quem abriu, ou ao conteudo principal
      if (sheetOpener !== null && document.contains(sheetOpener)) sheetOpener.focus({ preventScroll: true }); else el('view').focus({ preventScroll: true });
      sheetOpener = null;
    }
    return;
  }
  if (!hadSheet && document.activeElement instanceof HTMLElement) sheetOpener = document.activeElement;
  const dialog = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' },
    h('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    h('h2', { id: 'sheet-title' }, content.title),
    h('p', { id: 'sheet-error', class: 'banner banner-error', role: 'alert', hidden: true }),
    content.body);
  const backdrop = h('div', { class: 'sheet-backdrop' }, dialog);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) handlers?.onCloseSheet(); });
  dialog.addEventListener('keydown', (e) => trapFocus(dialog, e));
  root.append(backdrop);
  content.focus();
}

// ---------- entrada principal ----------
export function render(screen: Screen, ui: UiState, extras: Extras): void {
  if (handlers === null) throw new Error('render antes de bind');
  const m = messagesFor(ui.locale);
  const ctx: ViewContext = { m, locale: ui.locale, handlers };
  renderBrand(m);
  renderThemeButton(ui, m);
  renderTabs(ui, m);

  const view = el('view');
  const scrollTop = window.scrollY;
  let content: HTMLElement;
  switch (ui.tab) {
    case 'home': content = homeView(ctx, screen); break;
    case 'history': content = historyView(ctx, screen, ui); break;
    case 'stats': content = statsView(ctx, screen); break;
    case 'forecast': content = forecastView(ctx, screen); break;
    case 'settings': content = settingsView(ctx, ui, extras); break;
  }
  const viewKey = `${ui.tab}:${ui.settingsPage ?? ''}`;
  if (viewKey !== lastViewKey) content.classList.add('enter');
  lastViewKey = viewKey;
  view.replaceChildren(content);
  window.scrollTo(0, scrollTop);
  renderSheet(ctx, ui, screen, extras);
}

/** Troca de aba ou sub-tela: volta ao topo e leva o foco ao conteudo. */
export function focusView(): void {
  window.scrollTo(0, 0);
  el('view').focus({ preventScroll: true });
}

/** Chama `callback` quando o app volta a ficar visivel (ex.: WebView retomado em outro dia). */
export function onBecameVisible(callback: () => void): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') callback();
  });
}
