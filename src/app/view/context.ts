/** Contexto compartilhado pelas telas: idioma atual e acoes. Definido a cada renderizacao. */
import type { Messages } from '../i18n/index.ts';
import type { Locale } from '../i18n/index.ts';
import type { Handlers } from './types.ts';

export interface ViewContext {
  readonly m: Messages;
  readonly locale: Locale;
  readonly handlers: Handlers;
}
