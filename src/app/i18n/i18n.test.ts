// TESTES NOVOS: dicionarios completos e escolha do idioma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, isLanguagePreference, localeFromSystem, messagesFor, resolveLocale } from './index.ts';

type Tree = { [key: string]: unknown };
/** Caminhos folha ("a.b.c") com o tipo de cada folha; funcoes sao comparadas pelo numero de parametros. */
function shape(node: unknown, prefix = ''): string[] {
  if (typeof node === 'function') return [`${prefix}:fn${node.length}`];
  if (Array.isArray(node)) return [`${prefix}:array${node.length}`];
  if (typeof node === 'object' && node !== null) {
    return Object.keys(node as Tree).sort().flatMap((k) => shape((node as Tree)[k], prefix === '' ? k : `${prefix}.${k}`));
  }
  return [`${prefix}:${typeof node}`];
}

test('todos os idiomas tem exatamente a mesma estrutura do pt-BR', () => {
  const reference = shape(messagesFor('pt-BR'));
  for (const locale of LOCALES) assert.deepEqual(shape(messagesFor(locale)), reference, locale);
});

test('nenhum texto vazio e nenhum idioma copia o pt-BR por engano', () => {
  const flat = (node: unknown): string[] => (typeof node === 'string' ? [node] : Array.isArray(node) ? node.flatMap(flat) : typeof node === 'object' && node !== null ? Object.values(node).flatMap(flat) : []);
  for (const locale of LOCALES) for (const s of flat(messagesFor(locale))) assert.notEqual(s.trim(), '', locale);
  assert.notEqual(messagesFor('en').nav.home, messagesFor('pt-BR').nav.home);
  assert.notEqual(messagesFor('en').common.estimateNote, messagesFor('pt-BR').common.estimateNote);
});

test('previsao nunca e apresentada como garantia, nos dois idiomas', () => {
  assert.match(messagesFor('pt-BR').common.estimateNote, /não uma garantia/);
  assert.match(messagesFor('en').common.estimateNote, /not a guarantee/);
});

test('idioma do aparelho: pt* -> pt-BR; en* -> en; outros -> en', () => {
  assert.equal(localeFromSystem('pt-BR'), 'pt-BR');
  assert.equal(localeFromSystem('pt-PT'), 'pt-BR');
  assert.equal(localeFromSystem('en-US'), 'en');
  assert.equal(localeFromSystem('fr-FR'), 'en');
  assert.equal(localeFromSystem(''), 'en');
  assert.equal(localeFromSystem(undefined), 'en');
});

test('preferencia explicita vence o sistema; automatico segue o sistema', () => {
  assert.equal(resolveLocale('en', 'pt-BR'), 'en');
  assert.equal(resolveLocale('pt-BR', 'en-US'), 'pt-BR');
  assert.equal(resolveLocale('system', 'pt-BR'), 'pt-BR');
  assert.equal(resolveLocale('system', 'de'), 'en');
});

test('validacao de preferencia', () => {
  for (const ok of ['system', 'pt-BR', 'en']) assert.equal(isLanguagePreference(ok), true);
  for (const bad of ['fr', '', null, 1, undefined]) assert.equal(isLanguagePreference(bad), false);
});

test('funcoes com plural', () => {
  const pt = messagesFor('pt-BR');
  const en = messagesFor('en');
  assert.equal(pt.history.count(1), '1 ciclo encerrado');
  assert.equal(pt.history.count(3), '3 ciclos encerrados');
  assert.equal(en.history.count(1), '1 closed cycle');
  assert.equal(en.history.monthsDays(1, 1), '1 month and 1 day');
  assert.equal(pt.history.monthsDays(2, 0), '2 meses e 0 dias');
});
