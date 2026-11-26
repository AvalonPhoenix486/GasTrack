/** Tipos compartilhados da camada de exibicao (estado da interface, dados extras e eventos). */
import type { HistorySort } from '../screen.ts';
import type { ThemePreference } from '../preferences.ts';
import type { LanguagePreference, Locale } from '../i18n/index.ts';
import type { MotionPreference, Settings } from '../settings.ts';

export type Tab = 'home' | 'history' | 'stats' | 'forecast' | 'settings';
export type SettingsPage = 'appearance' | 'language' | 'cycle' | 'reminders' | 'data' | 'privacy' | 'about';

export type Sheet =
  | { readonly kind: 'start' }
  | { readonly kind: 'finish' }
  | { readonly kind: 'change' }
  | { readonly kind: 'edit'; readonly id: string }
  | { readonly kind: 'delete'; readonly id: string }
  | { readonly kind: 'clear' }
  | { readonly kind: 'import' }
  | null;

export interface UiState {
  readonly tab: Tab;
  readonly settingsPage: SettingsPage | null;
  readonly sheet: Sheet;
  readonly sort: HistorySort;
  /** 'all' ou um ano ("2026"). */
  readonly yearFilter: string;
  readonly expandedId: string | null;
  readonly theme: ThemePreference;
  readonly settings: Settings;
  readonly locale: Locale;
  /** Texto colado/lido para importar (mantido entre redesenhos). */
  readonly importDraft: string;
  readonly importError: string | null;
}

/** Dados que a tela precisa alem do modelo da tela (calculados em main.ts). */
export interface Extras {
  readonly exportText: string;
  readonly canDownload: boolean;
  readonly pendingImportCount: number;
  readonly storedCount: number;
  readonly version: string;
}

export interface Handlers {
  onTab(tab: Tab): void;
  onSettingsPage(page: SettingsPage | null): void;
  onOpenSheet(sheet: Exclude<Sheet, null>): void;
  onCloseSheet(): void;
  onStart(startDate: string): void;
  onFinish(endDate: string): void;
  onChange(date: string): void;
  /** `endDate` so e informado ao editar ciclo encerrado. */
  onSaveEdit(id: string, startDate: string, endDate: string | undefined): void;
  onConfirmDelete(id: string): void;
  onSort(sort: HistorySort): void;
  onYear(year: string): void;
  onToggleExpand(id: string): void;
  onQuickTheme(): void;
  onSetTheme(theme: ThemePreference): void;
  onSetLanguage(language: LanguagePreference): void;
  onSetMotion(motion: MotionPreference): void;
  onSetReminder(enabled: boolean): void;
  onSetNotice(days: number): void;
  onCopyExport(): void;
  onDownloadExport(): void;
  onImportDraft(text: string): void;
  onImportFileText(text: string): void;
  onImportFileFailed(): void;
  onImportCheck(): void;
  onConfirmImport(): void;
  onConfirmClear(): void;
}
