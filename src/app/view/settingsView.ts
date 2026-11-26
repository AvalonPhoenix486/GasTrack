/** Área Configurações: lista de categorias e sub-telas. Cada controle chama uma acao real. */
import { FORECAST_PARAMETERS } from '../../ui/timeline/index.ts';
import { LANGUAGE_ORDER } from '../i18n/index.ts';
import type { LanguagePreference } from '../i18n/index.ts';
import { MOTION_ORDER, NOTICE_DAY_OPTIONS } from '../settings.ts';
import type { MotionPreference } from '../settings.ts';
import { THEME_ORDER } from '../preferences.ts';
import type { ThemePreference } from '../preferences.ts';
import { crystalOrnate, diamondRule } from './brand.ts';
import type { ViewContext } from './context.ts';
import { button, h, icon } from './dom.ts';
import type { IconName } from './dom.ts';
import { choiceGroup, infoRow, pageHeader, switchRow } from './parts.ts';
import type { Extras, SettingsPage, UiState } from './types.ts';

const THEME_ICONS: Record<ThemePreference, IconName> = { system: 'auto', light: 'sun', dark: 'moon' };

function menuRow(name: IconName, title: string, subtitle: string, onClick: () => void, id: string): HTMLElement {
  const b = h('button', { type: 'button', class: 'menu-row', 'data-page': id },
    h('span', { class: 'menu-icon' }, icon(name, 22)),
    h('span', { class: 'menu-text' }, h('strong', null, title), h('span', { class: 'muted' }, subtitle)),
    icon('chevronRight', 20));
  b.addEventListener('click', onClick);
  return b;
}

function section(title: string, hint: string | null, ...body: (HTMLElement | null)[]): HTMLElement {
  return h('section', { class: 'card settings-section' }, h('h3', { class: 'section-title' }, title), hint === null ? null : h('p', { class: 'muted' }, hint), ...body);
}

function languageLabel(ctx: ViewContext, pref: LanguagePreference): string {
  return pref === 'system' ? ctx.m.settings.languageSystem : ctx.m.settings.languageNames[pref];
}

function menu(ctx: ViewContext, ui: UiState, extras: Extras): HTMLElement {
  const { m, handlers } = ctx;
  const s = m.settings;
  const go = (page: SettingsPage) => () => handlers.onSettingsPage(page);
  const remindersSub = ui.settings.reminderEnabled ? `${m.common.on} · ${s.remindersNoticeOption(ui.settings.noticeDays)}` : m.common.off;
  const language = ui.settings.language === 'system' ? `${s.languageSystem}: ${s.languageNames[ctx.locale]}` : s.languageNames[ui.settings.language];
  return h('div', { class: 'menu-list' },
    menuRow('palette', s.appearance.title, `${m.theme[ui.theme]} · ${s.motionSubtitle[ui.settings.motion]}`, go('appearance'), 'appearance'),
    menuRow('globe', s.language.title, language, go('language'), 'language'),
    menuRow('calendar', s.cycle.title, s.cycle.subtitle, go('cycle'), 'cycle'),
    menuRow('bell', s.reminders.title, remindersSub, go('reminders'), 'reminders'),
    menuRow('database', s.data.title, s.dataCount(extras.storedCount), go('data'), 'data'),
    menuRow('shield', s.privacy.title, s.privacy.subtitle, go('privacy'), 'privacy'),
    menuRow('info', s.about.title, s.about.subtitle(extras.version), go('about'), 'about'));
}

function appearancePage(ctx: ViewContext, ui: UiState): HTMLElement[] {
  const { m, handlers } = ctx;
  const s = m.settings;
  return [
    section(s.themeSection, s.themeHint,
      choiceGroup(s.themeSection, THEME_ORDER.map((t) => ({ value: t, label: m.theme[t], icon: THEME_ICONS[t] })), ui.theme, (t) => handlers.onSetTheme(t))),
    section(s.motionSection, s.motionHint,
      choiceGroup(s.motionSection, MOTION_ORDER.map((v) => ({ value: v, label: s.motion[v] })), ui.settings.motion, (v: MotionPreference) => handlers.onSetMotion(v))),
  ];
}

function languagePage(ctx: ViewContext, ui: UiState): HTMLElement[] {
  const { m, handlers } = ctx;
  const s = m.settings;
  return [section(s.language.title, s.languageHint,
    choiceGroup(s.language.title, LANGUAGE_ORDER.map((l) => ({ value: l, label: languageLabel(ctx, l), icon: 'globe' as const })), ui.settings.language, (l) => handlers.onSetLanguage(l)))];
}

function cyclePage(ctx: ViewContext): HTMLElement[] {
  const { m } = ctx;
  const s = m.settings;
  return [
    section(s.cycle.title, s.cycleIntro,
      infoRow('check', s.cycleMin, String(FORECAST_PARAMETERS.minClosedCycles)),
      infoRow('hourglass', s.cycleFloor, `${FORECAST_PARAMETERS.floorDays} ${FORECAST_PARAMETERS.floorDays === 1 ? m.common.day : m.common.days}`),
      infoRow('stats', s.cycleMethod, s.cycleMethodValue)),
    h('p', { class: 'banner banner-info' }, s.cycleNote),
  ];
}

function remindersPage(ctx: ViewContext, ui: UiState): HTMLElement[] {
  const { m, handlers } = ctx;
  const s = m.settings;
  const enabled = ui.settings.reminderEnabled;
  return [
    section(s.reminders.title, s.remindersIntro,
      switchRow('reminder-switch', s.remindersToggle, s.remindersToggleHint, enabled, (next) => handlers.onSetReminder(next)),
      h('h4', { class: 'sub-title' }, s.remindersNotice),
      choiceGroup(s.remindersNotice, NOTICE_DAY_OPTIONS.map((n) => ({ value: String(n), label: s.remindersNoticeOption(n) })), String(ui.settings.noticeDays), (v) => handlers.onSetNotice(Number(v)), 'list', !enabled)),
    h('section', { class: 'card settings-section unavailable', 'aria-labelledby': 'sysnotif-title' },
      h('div', { class: 'unavailable-head' }, icon('bell', 20), h('h3', { class: 'section-title', id: 'sysnotif-title' }, s.systemNotifTitle), h('span', { class: 'badge muted-badge' }, s.systemNotifStatus)),
      h('p', { class: 'muted' }, s.systemNotifText)),
  ];
}

function dataPage(ctx: ViewContext, ui: UiState, extras: Extras): HTMLElement[] {
  const { m, handlers } = ctx;
  const s = m.settings;
  const exportBox = h('textarea', { id: 'export-text', class: 'code-box', readonly: true, rows: 6, 'aria-label': s.dataExportLabel, spellcheck: 'false' });
  exportBox.value = extras.exportText;
  const exportActions = h('div', { class: 'actions' }, button(s.dataCopy, 'secondary', () => handlers.onCopyExport()));
  if (extras.canDownload) exportActions.append(button(s.dataDownload, 'secondary', () => handlers.onDownloadExport()));

  const importBox = h('textarea', { id: 'import-text', class: 'code-box', rows: 5, 'aria-label': s.dataImportPaste, spellcheck: 'false', placeholder: s.dataImportEmpty });
  importBox.value = ui.importDraft;
  importBox.addEventListener('input', () => handlers.onImportDraft(importBox.value));
  const file = h('input', { id: 'import-file', type: 'file', accept: '.json,application/json,text/plain', class: 'visually-hidden', tabindex: -1 });
  file.addEventListener('change', () => {
    const picked = file.files?.[0];
    file.value = '';
    if (picked === undefined) return;
    picked.text().then((text) => handlers.onImportFileText(text), () => handlers.onImportFileFailed());
  });
  const chooseFile = button(s.dataImportFile, 'secondary', () => file.click());
  const importError = h('p', { id: 'import-error', class: 'banner banner-error', role: 'alert', hidden: ui.importError === null }, ui.importError ?? '');

  return [
    section(s.dataExport, s.dataExportHint, exportBox, exportActions,
      extras.canDownload ? null : h('p', { class: 'hint' }, s.dataDownloadUnavailable)),
    section(s.dataImport, s.dataImportHint, importBox, importError, file,
      h('div', { class: 'actions' }, chooseFile, button(s.dataImportCheck, 'primary', () => handlers.onImportCheck()))),
    section(s.dataClear, s.dataClearHint,
      h('p', { class: 'muted' }, s.dataCount(extras.storedCount)),
      h('div', { class: 'actions' }, button(s.dataClearButton, 'danger-outline', () => handlers.onOpenSheet({ kind: 'clear' })))),
  ];
}

function privacyPage(ctx: ViewContext): HTMLElement[] {
  const s = ctx.m.settings;
  const icons: IconName[] = ['database', 'wifiOff', 'file', 'lock'];
  return [h('section', { class: 'card settings-section' },
    ...s.privacyTitles.map((title, i) => h('div', { class: 'privacy-item' },
      h('span', { class: 'info-icon' }, icon(icons[i] ?? 'shield', 20)),
      h('div', null, h('strong', null, title), h('p', { class: 'muted' }, s.privacyTexts[i] ?? '')))))];
}

function aboutPage(ctx: ViewContext, extras: Extras): HTMLElement[] {
  const { m } = ctx;
  const a = m.app;
  return [h('section', { class: 'about' },
    crystalOrnate('crystal crystal-o about-crystal'),
    h('p', { class: 'wordmark about-wordmark' }, 'Gas', h('em', null, 'Track')),
    h('p', { class: 'tagline' }, a.tagline),
    h('p', { class: 'about-version' }, m.settings.aboutVersion(extras.version)),
    h('p', { class: 'about-text' }, a.description),
    diamondRule(),
    h('p', { class: 'muted' }, m.settings.aboutBuild),
    h('h3', { class: 'sub-title' }, m.settings.aboutCredits),
    h('p', { class: 'about-credit' }, a.credit),
    h('p', { class: 'tagline small' }, a.motto),
    h('p', { class: 'made-with' }, icon('heart', 18), a.madeWith))];
}

const PAGE_TITLES = (ctx: ViewContext): Record<SettingsPage, string> => ({
  appearance: ctx.m.settings.appearance.title,
  language: ctx.m.settings.language.title,
  cycle: ctx.m.settings.cycle.title,
  reminders: ctx.m.settings.reminders.title,
  data: ctx.m.settings.data.title,
  privacy: ctx.m.settings.privacy.title,
  about: ctx.m.settings.about.title,
});

export function settingsView(ctx: ViewContext, ui: UiState, extras: Extras): HTMLElement {
  const { m, handlers } = ctx;
  const page = ui.settingsPage;
  if (page === null) {
    return h('div', { class: 'view' }, pageHeader(m.settings.title, null, m.common.back), menu(ctx, ui, extras));
  }
  let body: HTMLElement[];
  switch (page) {
    case 'appearance': body = appearancePage(ctx, ui); break;
    case 'language': body = languagePage(ctx, ui); break;
    case 'cycle': body = cyclePage(ctx); break;
    case 'reminders': body = remindersPage(ctx, ui); break;
    case 'data': body = dataPage(ctx, ui, extras); break;
    case 'privacy': body = privacyPage(ctx); break;
    case 'about': body = aboutPage(ctx, extras); break;
  }
  return h('div', { class: `view settings-page page-${page}` }, pageHeader(PAGE_TITLES(ctx)[page], () => handlers.onSettingsPage(null), m.common.back), ...body);
}
