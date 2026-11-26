// TESTES NOVOS: textos da previsao em ingles e completude das tabelas de idioma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closedFromDurations } from '../../core/domain/statistics/test-support.ts';
import { makeOpen } from '../../core/domain/cycles/test-support.ts';
import { LOCALES } from '../locale.ts';
import { formatDateWindow, formatDays, formatLongDate, formatNumber, formatPercent, formatShortDate, monthName } from './format.ts';
import { presentNextChange } from './index.ts';
import { forecastText } from './text.ts';

test('datas em ingles', () => {
  assert.equal(formatLongDate('2026-12-15', 'en'), 'December 15, 2026');
  assert.equal(formatLongDate('2026-01-01', 'en'), 'January 1, 2026');
  assert.equal(formatShortDate('2025-11-01', 'en'), 'Nov 1, 2025');
  assert.equal(formatShortDate('2025-11-01'), '1 nov 2025');
  assert.equal(monthName(3, 'en'), 'March');
});

test('janelas em ingles: mesmo mes, meses diferentes, anos diferentes, data unica', () => {
  assert.equal(formatDateWindow('2026-12-14', '2026-12-16', 'en'), 'December 14–16');
  assert.equal(formatDateWindow('2026-01-30', '2026-02-02', 'en'), 'January 30 – February 2');
  assert.equal(formatDateWindow('2026-12-30', '2027-01-01', 'en'), 'December 30, 2026 – January 1, 2027');
  assert.equal(formatDateWindow('2026-12-15', '2026-12-15', 'en'), 'December 15');
});

test('numeros e plurais em ingles', () => {
  assert.equal(formatNumber(28.5, 'en'), '28.5');
  assert.equal(formatDays(1, 'en'), '1 day');
  assert.equal(formatDays(1.5, 'en'), '1.5 days');
  assert.equal(formatDays(0, 'en'), '0 days');
  assert.equal(formatPercent(0.0175, 'en'), '1.8%');
});

test('previsao completa em ingles vem do dominio real e nao promete acerto', () => {
  const cycles = [...closedFromDurations([29, 29, 30, 31]), makeOpen('o', '2026-11-17')];
  const view = presentNextChange(cycles, 'en');
  assert.equal(view.kind, 'ok');
  if (view.kind !== 'ok') return;
  assert.equal(view.title, 'Estimated next change');
  assert.match(view.windowLine, /^Estimated window: /);
  assert.equal(view.basisLine, 'Based on 4 closed cycles');
  assert.equal(presentNextChange(cycles).title, 'Próxima mudança estimada');
  const all = JSON.stringify(view);
  assert.doesNotMatch(all, /confidence|probabilit|guarantee|certain|likely/i);
});

test('estados sem data em ingles', () => {
  const few = presentNextChange(closedFromDurations([29, 30]), 'en');
  assert.equal(few.kind, 'insufficient-data');
  if (few.kind === 'insufficient-data') {
    assert.equal(few.historyLine, 'History: 2 cycles');
    assert.equal(few.requiredLine, 'Required: 4 cycles');
  }
  const noOpen = presentNextChange(closedFromDurations([29, 29, 30, 31]), 'en');
  assert.equal(noOpen.kind, 'no-open-cycle');
});

test('todos os idiomas tem tabela completa e valor invalido cai em pt-BR', () => {
  const reference = Object.keys(forecastText('pt-BR')).sort();
  for (const l of LOCALES) assert.deepEqual(Object.keys(forecastText(l)).sort(), reference, l);
  for (const l of LOCALES) {
    assert.equal(forecastText(l).months.length, 12);
    assert.equal(forecastText(l).monthsShort.length, 12);
  }
  assert.equal(forecastText('xx' as never), forecastText('pt-BR'));
});
