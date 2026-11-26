/**
 * Preferencias da aplicacao alem do tema (que fica em preferences.ts): idioma, animacoes e lembretes.
 * Guardadas localmente; cada campo e validado separadamente (um valor ruim volta ao padrao, sem
 * perder os demais). Falha de armazenamento nao e fatal.
 */
import { isLanguagePreference } from './i18n/index.ts';
import type { LanguagePreference } from './i18n/index.ts';
import type { StorageLike } from './localStorageRepository.ts';

export type MotionPreference = 'system' | 'on' | 'off';
export const MOTION_ORDER: readonly MotionPreference[] = ['system', 'on', 'off'];

/** Antecedencias oferecidas para o aviso de aproximacao, em dias. */
export const NOTICE_DAY_OPTIONS: readonly number[] = [1, 2, 3, 5, 7];

export interface Settings {
  readonly language: LanguagePreference;
  readonly motion: MotionPreference;
  /** Aviso dentro do app quando a troca se aproxima da janela estimada. */
  readonly reminderEnabled: boolean;
  readonly noticeDays: number;
}

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  language: 'system',
  motion: 'system',
  reminderEnabled: true,
  noticeDays: 2,
});

export const SETTINGS_KEY = 'gastrack.settings';
const FORMAT_VERSION = 1;

export function isMotionPreference(value: unknown): value is MotionPreference {
  return value === 'system' || value === 'on' || value === 'off';
}

/** Animacoes ligadas? 'system' obedece ao pedido do sistema de reduzir movimento. */
export function animationsEnabled(preference: MotionPreference, systemPrefersReduced: boolean): boolean {
  if (preference === 'on') return true;
  if (preference === 'off') return false;
  return !systemPrefersReduced;
}

/** Aceita so os valores oferecidos; qualquer outro cai no padrao. */
export function sanitizeNoticeDays(value: unknown): number {
  return typeof value === 'number' && NOTICE_DAY_OPTIONS.includes(value) ? value : DEFAULT_SETTINGS.noticeDays;
}

export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return DEFAULT_SETTINGS;
  const r = raw as Record<string, unknown>;
  if (r['version'] !== FORMAT_VERSION) return DEFAULT_SETTINGS;
  return Object.freeze({
    language: isLanguagePreference(r['language']) ? r['language'] : DEFAULT_SETTINGS.language,
    motion: isMotionPreference(r['motion']) ? r['motion'] : DEFAULT_SETTINGS.motion,
    reminderEnabled: typeof r['reminderEnabled'] === 'boolean' ? r['reminderEnabled'] : DEFAULT_SETTINGS.reminderEnabled,
    noticeDays: sanitizeNoticeDays(r['noticeDays']),
  });
}

export class SettingsStore {
  private readonly getStorage: () => StorageLike;

  constructor(getStorage: () => StorageLike) {
    this.getStorage = getStorage;
  }

  /** Ausente, ilegivel ou armazenamento inacessivel -> padroes. */
  load(): Settings {
    try {
      const raw = this.getStorage().getItem(SETTINGS_KEY);
      return raw === null ? DEFAULT_SETTINGS : parseSettings(JSON.parse(raw));
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  /** true se gravou. */
  save(settings: Settings): boolean {
    try {
      this.getStorage().setItem(SETTINGS_KEY, JSON.stringify({ version: FORMAT_VERSION, ...settings }));
      return true;
    } catch {
      return false;
    }
  }
}
