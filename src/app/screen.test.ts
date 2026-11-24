import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyFromCycles } from '../core/domain/cycles/index.ts';
import { presentNextChange } from '../ui/forecast/index.ts';
import { buildScreen, shortDateLabel, sortRows, SORT_LABELS } from './screen.ts';
import type { HistorySort } from './screen.ts';

const CLOSED = [
  { id: 'a', startDate: '2026-01-01', endDate: '2026-01-30' }, // 29
  { id: 'b', startDate: '2026-02-01', endDate: '2026-03-02' }, // 29
  { id: 'c', startDate: '2026-03-05', endDate: '2026-04-04' }, // 30
  { id: 'd', startDate: '2026-04-07', endDate: '2026-05-08' }, // 31
];
const open = (startDate: string) => ({ id: 'o', startDate, endDate: null });
const hist = (...c: object[]) => historyFromCycles(c);

test('heroi: dias calculados a partir de HOJE e do inicio (nada fixo)', () => {
  const h = hist(...CLOSED, open('2026-10-05'));
  assert.deepEqual(
    [buildScreen(h, '2026-11-23').openCycle?.daysValue, buildScreen(h, '2026-11-23').openCycle?.daysUnit],
    ['49', 'dias'],
  );
  assert.equal(buildScreen(h, '2026-11-24').openCycle?.daysValue, '50');
  assert.equal(buildScreen(h, '2026-10-06').openCycle?.daysValue, '1');
  assert.equal(buildScreen(h, '2026-10-06').openCycle?.daysUnit, 'dia');
  assert.equal(buildScreen(h, '2026-10-05').openCycle?.daysValue, '0');
  assert.equal(buildScreen(h, '2026-10-05').openCycle?.daysUnit, 'dias');
});

test('heroi: usa calendario real (virada de mes e ano bissexto)', () => {
  assert.equal(buildScreen(hist(open('2028-02-28')), '2028-03-01').openCycle?.daysValue, '2'); // 29/02 existe
  assert.equal(buildScreen(hist(open('2027-02-28')), '2027-03-01').openCycle?.daysValue, '1');
  assert.equal(buildScreen(hist(open('2026-12-31')), '2027-01-01').openCycle?.daysValue, '1');
});

test('heroi: inicio no futuro nao quebra a tela', () => {
  const s = buildScreen(hist(open('2026-12-01')), '2026-11-23');
  assert.equal(s.openCycle?.daysValue, null);
  assert.equal(s.openCycle?.note, 'O início está em uma data futura.');
  assert.equal(s.currentText, 'Em andamento desde 1º de dezembro de 2026');
});

test('sem ciclo aberto: texto e ausencia de heroi', () => {
  const s = buildScreen(hist(...CLOSED), '2026-11-23');
  assert.equal(s.currentText, 'Nenhum ciclo em andamento.');
  assert.equal(s.openCycle, null);
  assert.equal(s.hasOpenCycle, false);
  assert.equal(s.closedCount, 4);
});

test('previsao da tela e exatamente presentNextChange', () => {
  for (const h of [hist(), hist(...CLOSED), hist(...CLOSED, open('2026-05-10')), hist(CLOSED[0] as object, open('2026-05-10'))]) {
    assert.deepEqual(buildScreen(h, '2026-05-10').forecast, presentNextChange(h.cycles));
  }
});

test('estatisticas: valores vem do dominio e sao formatados em pt-BR', () => {
  const s = buildScreen(hist(...CLOSED, open('2026-05-10')), '2026-05-10').stats;
  assert.equal(s.kind, 'ok');
  if (s.kind !== 'ok') return;
  const byLabel = Object.fromEntries(s.cards.map((c) => [c.label, c.value]));
  assert.equal(byLabel['Mediana'], '29,5 dias');
  assert.equal(byLabel['Média'], '29,75 dias');
  assert.equal(byLabel['Mais curto'], '29 dias');
  assert.equal(byLabel['Mais longo'], '31 dias');
  assert.equal(byLabel['Amplitude'], '2 dias');
  assert.equal(byLabel['Variação típica (MAD)'], '0,5 dias');
  assert.equal(byLabel['Variação relativa'], '1,7%');
  assert.equal(s.basisLine, 'Baseado em 4 ciclos fechados');
  assert.equal(s.caution, null);
});

test('grafico: ordem cronologica, largura relativa ao maior ciclo, ciclo aberto fora', () => {
  const s = buildScreen(hist(...CLOSED, open('2026-05-10')), '2026-05-10').stats;
  if (s.kind !== 'ok') throw new Error('esperava dados');
  assert.deepEqual(s.bars.map((b) => [b.id, b.label, b.valueText, b.widthPct]), [
    ['a', '1 jan', '29 dias', 94], ['b', '1 fev', '29 dias', 94], ['c', '5 mar', '30 dias', 97], ['d', '7 abr', '31 dias', 100],
  ]);
  assert.equal(s.medianPct, 95);
  assert.equal(s.medianLabel, 'Mediana: 29,5 d');
});

test('estatisticas: vazio sem ciclos fechados; aviso vem da previsao quando faltam dados', () => {
  const none = buildScreen(hist(open('2026-05-10')), '2026-05-10').stats;
  assert.equal(none.kind, 'empty');
  const three = buildScreen(hist(...CLOSED.slice(0, 3)), '2026-05-10').stats;
  assert.equal(three.kind, 'ok');
  if (three.kind === 'ok') {
    assert.equal(three.basisLine, 'Baseado em 3 ciclos fechados');
    assert.match(three.caution ?? '', /histórico: 3 ciclos; necessário: 4 ciclos/);
  }
  const one = buildScreen(hist(...CLOSED.slice(0, 1)), '2026-05-10').stats;
  if (one.kind === 'ok') assert.equal(one.basisLine, 'Baseado em 1 ciclo fechado');
});

test('historico: do mais recente ao mais antigo, com dias totais do dominio', () => {
  const rows = buildScreen(hist(...CLOSED), '2026-05-10').historyRows;
  assert.deepEqual(rows.map((r) => [r.id, r.totalDays, r.durationText]), [['d', 31, '31 dias'], ['c', 30, '30 dias'], ['b', 29, '29 dias'], ['a', 29, '29 dias']]);
});

test('ordenacao: nao altera a lista original e desempata pelo mais recente', () => {
  const rows = buildScreen(hist(...CLOSED), '2026-05-10').historyRows;
  const ids = (s: HistorySort) => sortRows(rows, s).map((r) => r.id);
  assert.deepEqual(ids('recent'), ['d', 'c', 'b', 'a']);
  assert.deepEqual(ids('oldest'), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids('longest'), ['d', 'c', 'b', 'a']);
  assert.deepEqual(ids('shortest'), ['b', 'a', 'c', 'd']); // 29 (b, a: mais recente primeiro), 30, 31
  assert.deepEqual(rows.map((r) => r.id), ['d', 'c', 'b', 'a']);
  assert.deepEqual(Object.keys(SORT_LABELS), ['recent', 'oldest', 'longest', 'shortest']);
});

test('rotulo curto de data', () => {
  assert.equal(shortDateLabel('2026-04-07'), '7 abr');
  assert.equal(shortDateLabel('2026-03-01'), '1 mar');
  assert.equal(shortDateLabel('2026-12-25'), '25 dez');
});
