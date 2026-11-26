/** Idiomas da aplicacao: dicionarios, escolha do idioma e preferencia. Sem DOM. */
import { DEFAULT_LOCALE, LOCALES, isLocale } from '../../ui/locale.ts';
import type { Locale } from '../../ui/locale.ts';
import { en } from './en.ts';
import { ptBR } from './pt-BR.ts';
import type { Messages } from './pt-BR.ts';

export type { Messages } from './pt-BR.ts';
export type { Locale } from '../../ui/locale.ts';
export { LOCALES, DEFAULT_LOCALE, isLocale } from '../../ui/locale.ts';

/** 'system' segue o idioma do aparelho. */
export type LanguagePreference = 'system' | Locale;
export const LANGUAGE_ORDER: readonly LanguagePreference[] = ['system', ...LOCALES];

const DICTIONARIES: Readonly<Record<Locale, Messages>> = { 'pt-BR': ptBR, en };

export function messagesFor(locale: Locale): Messages {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/**
 * Idioma do aparelho -> idioma suportado. "pt", "pt-BR" e "pt-PT" -> pt-BR (unico portugues
 * disponivel); "en", "en-US"... -> en; qualquer outro -> en (idioma de reserva universal).
 */
export function localeFromSystem(systemLanguage: string | null | undefined): Locale {
  const code = (systemLanguage ?? '').toLowerCase();
  if (code.startsWith('pt')) return 'pt-BR';
  if (code.startsWith('en')) return 'en';
  return 'en';
}

export function resolveLocale(preference: LanguagePreference, systemLanguage: string | null | undefined): Locale {
  return preference === 'system' ? localeFromSystem(systemLanguage) : preference;
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'system' || isLocale(value);
}
