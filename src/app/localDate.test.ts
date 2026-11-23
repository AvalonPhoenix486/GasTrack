import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localCivilDate } from './localDate.ts';

test('usa os componentes locais (independe do fuso do processo)', () => {
  assert.equal(localCivilDate(new Date(2026, 10, 1, 0, 0, 0)), '2026-11-01');
  assert.equal(localCivilDate(new Date(2026, 10, 1, 23, 59, 59)), '2026-11-01');
  assert.equal(localCivilDate(new Date(2026, 11, 31, 23, 30)), '2026-12-31');
  assert.equal(localCivilDate(new Date(2028, 1, 29, 12)), '2028-02-29');
});

test('quase meia-noite local nao vira o dia seguinte/anterior (armadilha do toISOString)', () => {
  // Em qualquer TZ, o instante local 23:30 e 00:30 caem no dia local correto.
  assert.equal(localCivilDate(new Date(2026, 5, 15, 23, 30)), '2026-06-15');
  assert.equal(localCivilDate(new Date(2026, 5, 16, 0, 30)), '2026-06-16');
});

test('zero a esquerda em mes e dia', () => {
  assert.equal(localCivilDate(new Date(2026, 0, 5, 10)), '2026-01-05');
});
