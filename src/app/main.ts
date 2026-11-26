/** Ponto de entrada no navegador: liga repositorio, controlador, preferencias e tela. */
import { listCycles } from '../core/domain/cycles/index.ts';
import type { CycleChanges, Cycle } from '../core/domain/cycles/index.ts';
import { APP_VERSION } from './appInfo.ts';
import { exportBackup, parseBackup } from './backup.ts';
import { GasTrackController } from './controller.ts';
import { messagesFor, resolveLocale } from './i18n/index.ts';
import { LocalStorageCycleRepository } from './localStorageRepository.ts';
import { localCivilDate } from './localDate.ts';
import { describeError } from './messages.ts';
import { ThemeStore, nextTheme } from './preferences.ts';
import {
  applyAppearance, bind, copyText, downloadText, focusView, onBecameVisible, render, runSplash, setBusy, showError, showNotice, showToast,
} from './render.ts';
import type { Extras, Sheet, UiState } from './render.ts';
import { buildScreen } from './screen.ts';
import { SettingsStore, animationsEnabled } from './settings.ts';
import type { Settings } from './settings.ts';

const controller = new GasTrackController(
  new LocalStorageCycleRepository(() => window.localStorage),
  () => crypto.randomUUID(),
);
const themeStore = new ThemeStore(() => window.localStorage);
const settingsStore = new SettingsStore(() => window.localStorage);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function currentLocale(settings: Settings) {
  return resolveLocale(settings.language, navigator.language);
}

const initialSettings = settingsStore.load();
let ui: UiState = {
  tab: 'home', settingsPage: null, sheet: null, sort: 'recent', yearFilter: 'all', expandedId: null,
  theme: themeStore.load(), settings: initialSettings, locale: currentLocale(initialSettings), importDraft: '', importError: null,
};
let busy = false;
let pendingImport: readonly Cycle[] = [];
let depth = 0; // entradas de historico empurradas (tela secundaria e painel) para o botao Voltar
let ignorePop = 0;

const messages = () => messagesFor(ui.locale);

function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

/** Botao Voltar do aparelho: cada sub-tela e cada painel ocupa uma entrada do historico. */
function requiredDepth(): number {
  return (ui.tab === 'settings' && ui.settingsPage !== null ? 1 : 0) + (ui.sheet !== null ? 1 : 0);
}

function syncHistory(): void {
  const need = requiredDepth();
  while (depth < need) {
    depth += 1;
    window.history.pushState({ gastrack: depth }, '');
  }
  if (depth > need) {
    const diff = depth - need;
    depth = need;
    ignorePop += 1;
    window.history.go(-diff);
  }
}

function extras(today: string): Extras {
  const cycles = listCycles(controller.history);
  return {
    exportText: exportBackup(cycles, today),
    canDownload: !isNativeApp(),
    pendingImportCount: pendingImport.length,
    storedCount: cycles.length,
    version: APP_VERSION,
  };
}

function refresh(): void {
  syncHistory();
  const today = localCivilDate();
  applyAppearance({ theme: ui.theme, animations: animationsEnabled(ui.settings.motion, reducedMotion.matches), locale: ui.locale });
  const screen = buildScreen(controller.history, today, { locale: ui.locale, reminderEnabled: ui.settings.reminderEnabled, noticeDays: ui.settings.noticeDays });
  render(screen, ui, extras(today));
  if (screen.forecast.kind === 'unavailable') console.error('Falha na previsão:', screen.forecast.cause);
}

/** Erro conhecido -> mensagem; desconhecido -> mensagem generica E registro no console (nunca silencioso). */
function fail(error: unknown): void {
  const message = describeError(error, ui.locale);
  if (message === null) {
    console.error(error);
    showError(messages().common.unexpected);
  } else {
    showError(message);
  }
}

/**
 * Executa uma acao que muda dados. Sucesso: fecha o painel e mostra um aviso curto.
 * Falha: o painel continua aberto, com o erro e o que o usuario digitou.
 */
async function act(run: () => Promise<unknown>, success: string): Promise<void> {
  if (busy) return;
  busy = true;
  showError(null);
  setBusy(true);
  let done = false;
  try {
    await run();
    ui = { ...ui, sheet: null };
    done = true;
  } catch (error) {
    fail(error);
  } finally {
    busy = false;
    refresh();
    setBusy(false);
  }
  if (done) showToast(success);
}

function openSheet(sheet: Exclude<Sheet, null>): void {
  if (busy) return;
  ui = { ...ui, sheet };
  refresh();
}

/** Guarda uma preferencia nova, aplica na hora e avisa se nao foi possivel grava-la. */
function updateSettings(patch: Partial<Settings>): void {
  const settings: Settings = { ...ui.settings, ...patch };
  ui = { ...ui, settings, locale: currentLocale(settings) };
  refresh();
  if (!settingsStore.save(settings)) showToast(messages().notices.settingsSaveFailed, 'error');
}

function setTheme(theme: UiState['theme'], announce: boolean): void {
  ui = { ...ui, theme };
  refresh();
  const m = messages();
  if (!themeStore.save(theme)) showToast(m.theme.saveFailed, 'error');
  else if (announce) showToast(m.theme.changed(m.theme[theme]));
}

async function start(): Promise<void> {
  bind({
    onTab: (tab) => { if (busy) return; ui = { ...ui, tab, settingsPage: null, sheet: null }; refresh(); focusView(); },
    onSettingsPage: (page) => { if (busy) return; ui = { ...ui, settingsPage: page, importError: null }; refresh(); focusView(); },
    onOpenSheet: openSheet,
    onCloseSheet: () => { if (busy) return; ui = { ...ui, sheet: null }; refresh(); },
    onStart: (date) => void act(() => controller.startCycle(date), messages().sheets.started),
    onFinish: (date) => void act(() => controller.finishCycle(date), messages().sheets.finished),
    onChange: (date) => void act(() => controller.registerChange(date), messages().sheets.changed),
    onSaveEdit: (id, startDate, endDate) => {
      const changes: CycleChanges = endDate === undefined ? { startDate } : { startDate, endDate };
      void act(() => controller.updateCycle(id, changes), messages().sheets.updated);
    },
    onConfirmDelete: (id) => void act(() => controller.deleteCycle(id), messages().sheets.deleted),
    onSort: (sort) => { ui = { ...ui, sort }; refresh(); },
    onYear: (yearFilter) => { ui = { ...ui, yearFilter }; refresh(); },
    onToggleExpand: (id) => { ui = { ...ui, expandedId: ui.expandedId === id ? null : id }; refresh(); },
    onQuickTheme: () => setTheme(nextTheme(ui.theme), true),
    onSetTheme: (theme) => setTheme(theme, false),
    onSetLanguage: (language) => updateSettings({ language }),
    onSetMotion: (motion) => updateSettings({ motion }),
    onSetReminder: (reminderEnabled) => updateSettings({ reminderEnabled }),
    onSetNotice: (noticeDays) => updateSettings({ noticeDays }),
    onCopyExport: () => {
      const m = messages();
      void copyText(extras(localCivilDate()).exportText).then((ok) => showToast(ok ? m.settings.dataCopied : m.settings.dataCopyFailed, ok ? 'success' : 'error'));
    },
    onDownloadExport: () => {
      const today = localCivilDate();
      downloadText(`gastrack-${today}.json`, extras(today).exportText);
    },
    // Digitando: so guarda o texto (redesenhar tiraria o foco do campo).
    onImportDraft: (text) => { ui = { ...ui, importDraft: text }; },
    onImportFileText: (text) => { ui = { ...ui, importDraft: text, importError: null }; refresh(); },
    onImportFileFailed: () => { ui = { ...ui, importError: messages().settings.dataFileReadFailed }; refresh(); },
    onImportCheck: () => {
      if (busy) return;
      if (ui.importDraft.trim() === '') { ui = { ...ui, importError: messages().settings.dataImportEmpty }; refresh(); return; }
      try {
        pendingImport = parseBackup(ui.importDraft);
        ui = { ...ui, importError: null, sheet: { kind: 'import' } };
      } catch (error) {
        console.warn('Importação recusada', error);
        ui = { ...ui, importError: describeError(error, ui.locale) ?? messages().common.unexpected };
      }
      refresh();
    },
    onConfirmImport: () => {
      const toImport = pendingImport;
      void act(async () => {
        await controller.replaceAll(toImport);
        pendingImport = [];
        ui = { ...ui, importDraft: '', importError: null, expandedId: null, yearFilter: 'all' };
      }, messages().sheets.imported(toImport.length));
    },
    onConfirmClear: () => void act(async () => {
      await controller.clearAll();
      ui = { ...ui, expandedId: null, yearFilter: 'all' };
    }, messages().sheets.cleared),
  });

  window.addEventListener('popstate', () => {
    if (ignorePop > 0) { ignorePop -= 1; return; }
    if (depth === 0) return;
    depth -= 1;
    if (busy) return;
    if (ui.sheet !== null) ui = { ...ui, sheet: null };
    else if (ui.settingsPage !== null) ui = { ...ui, settingsPage: null };
    refresh();
  });
  // Ao voltar ao app (ex.: WebView retomado no dia seguinte), recalcula "hoje" e os dias.
  onBecameVisible(() => { if (!busy) refresh(); });
  // Mudou o pedido do sistema por menos movimento: reaplica (so importa no modo automatico).
  reducedMotion.addEventListener('change', () => refresh());

  void runSplash(messages(), animationsEnabled(ui.settings.motion, reducedMotion.matches));
  try {
    const problem = await controller.load();
    const n = messages().notices;
    if (problem?.kind === 'corrupt') showNotice(problem.backedUp ? n.corruptBackedUp : n.corrupt);
    else if (problem?.kind === 'unavailable') showNotice(n.unavailable);
  } catch (error) {
    console.error(error);
    showNotice(messages().notices.loadFailed);
  }
  refresh();
}

void start();
