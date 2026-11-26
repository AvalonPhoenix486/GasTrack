/**
 * Idiomas suportados. Para adicionar um idioma: incluir o codigo aqui, criar o
 * dicionario da app (src/app/i18n/<codigo>.ts) e a tabela de textos da previsao
 * (src/ui/forecast/text.ts). Os testes de completude apontam o que faltar.
 */
export type Locale = 'pt-BR' | 'en';

export const LOCALES: readonly Locale[] = ['pt-BR', 'en'];
export const DEFAULT_LOCALE: Locale = 'pt-BR';

export function isLocale(value: unknown): value is Locale {
  return value === 'pt-BR' || value === 'en';
}
