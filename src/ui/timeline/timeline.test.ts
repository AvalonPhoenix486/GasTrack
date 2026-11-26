import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyFromCycles, listCycles } from '../../core/domain/cycles/index.ts';
import { buildTimeline, FORECAST_PARAMETERS } from './index.ts';
import type { TimelineOk } from './index.ts';

// Ciclos de 29, 29, 30 e 31 dias: mediana 29,5, MAD 0,5 -> h = 1; janela 28..30 dias; central = floor(29,5) = 29.
const CLOSED = [
  { id: 'a', startDate: '2026-01-01', endDate: '2026-01-30' },
  { id: 'b', startDate: '2026-02-01', endDate: '2026-03-02' },
  { id: 'c', startDate: '2026-03-05', endDate: '2026-04-04' },
  { id: 'd', startDate: '2026-04-07', endDate: '2026-05-08' },
];
const cycles = (open: string | null) => listCycles(historyFromCycles(open === null ? CLOSED : [...CLOSED, { id: 'o', startDate: open, endDate: null }]));
const ok = (open: string, today: string, notice = 3): TimelineOk => {
  const t = buildTimeline(cycles(open), today, notice);
  assert.equal(t.status, 'ok');
  return t as TimelineOk;
};

test('sem previsao ok: poucos ciclos ou sem ciclo aberto', () => {
  const noOpen = buildTimeline(cycles(null), '2026-11-23', 3);
  assert.equal(noOpen.status, 'none');
  assert.equal(noOpen.status === 'none' && noOpen.reason, 'no-open-cycle');
  const few = buildTimeline(listCycles(historyFromCycles([{ id: 'a', startDate: '2026-01-01', endDate: '2026-01-30' }, { id: 'o', startDate: '2026-02-01', endDate: null }])), '2026-02-10', 3);
  assert.deepEqual({ ...few }, { status: 'none', reason: 'insufficient-data', closedCount: 1, requiredCount: 4 });
  assert.equal(buildTimeline(listCycles(historyFromCycles([{ id: 'o', startDate: '2026-11-01', endDate: null }])), '2026-11-23', 3).status, 'none');
});

test('datas vem do dominio: central = inicio + 29 dias; janela = inicio + 29..30 dias (mediana 29,5, h = 1)', () => {
  const t = ok('2026-10-01', '2026-10-11');
  assert.equal(t.centralDays, 29);
  assert.equal(t.centralDate, '2026-10-30');
  assert.equal(t.windowStartDate, '2026-10-30');
  assert.equal(t.windowEndDate, '2026-10-31');
});

test('progresso: dias decorridos / duracao central, limitado a 0..100', () => {
  assert.equal(ok('2026-10-01', '2026-10-01').progressPct, 0);
  assert.equal(ok('2026-10-01', '2026-10-11').elapsedDays, 10);
  assert.equal(ok('2026-10-01', '2026-10-11').progressPct, 34); // 10/29
  assert.equal(ok('2026-10-01', '2026-10-30').progressPct, 100);
  assert.equal(ok('2026-10-01', '2026-12-30').progressPct, 100);
  assert.equal(ok('2026-12-01', '2026-11-23').progressPct, 0); // inicio no futuro
  assert.equal(ok('2026-12-01', '2026-11-23').elapsedDays, 0);
});

test('fases: antes, perto (antecedencia), dentro e depois da janela', () => {
  assert.equal(ok('2026-10-01', '2026-10-25', 3).phase, 'before'); // faltam 5 dias para a janela (30/10)
  assert.equal(ok('2026-10-01', '2026-10-27', 3).phase, 'approaching'); // faltam exatamente 3
  assert.equal(ok('2026-10-01', '2026-10-27', 2).phase, 'before');
  assert.equal(ok('2026-10-01', '2026-10-30', 3).phase, 'in-window');
  assert.equal(ok('2026-10-01', '2026-10-31', 3).phase, 'in-window');
  const after = ok('2026-10-01', '2026-11-03', 3);
  assert.equal(after.phase, 'after-window');
  assert.equal(after.daysPastWindowEnd, 3);
  assert.equal(after.overdueDays, 4);
  assert.equal(after.remainingDays, 0);
});

test('dias ate a janela e ate a data central', () => {
  const t = ok('2026-10-01', '2026-10-25', 3);
  assert.equal(t.daysToWindowStart, 5);
  assert.equal(t.remainingDays, 5);
  assert.equal(t.overdueDays, 0);
});

test('parametros fixos expostos para exibicao', () => {
  assert.deepEqual({ ...FORECAST_PARAMETERS }, { minClosedCycles: 4, floorDays: 1 });
});
