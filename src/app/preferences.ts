/** Preferencia de tema, guardada localmente. Falha de armazenamento nao e fatal: o app usa o padrao. */
import type { StorageLike } from './localStorageRepository.ts';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_KEY = 'gastrack.theme';
export const THEME_ORDER: readonly ThemePreference[] = ['system', 'light', 'dark'];
export const THEME_LABELS: Readonly<Record<ThemePreference, string>> = {
  system: 'Automático',
  light: 'Claro',
  dark: 'Escuro',
};

export function nextTheme(current: ThemePreference): ThemePreference {
  const index = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(index + 1) % THEME_ORDER.length] as ThemePreference;
}

export class ThemeStore {
  private readonly getStorage: () => StorageLike;

  constructor(getStorage: () => StorageLike) {
    this.getStorage = getStorage;
  }

  /** Valor desconhecido, ausente ou armazenamento inacessivel -> 'system'. */
  load(): ThemePreference {
    try {
      const raw = this.getStorage().getItem(THEME_KEY);
      return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
    } catch {
      return 'system';
    }
  }

  /** true se gravou. */
  save(theme: ThemePreference): boolean {
    try {
      this.getStorage().setItem(THEME_KEY, theme);
      return true;
    } catch {
      return false;
    }
  }
}
