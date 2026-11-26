// TESTES NOVOS: progresso, proxima troca, alerta, indicadores, filtro por ano, idiomas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyFromCycles } from '../core/domain/cycles/index.ts';
import { buildScreen, filterRows } from './screen.ts';

// 29, 29, 30, 31 dias -> mediana 29,5; janela 29..30 dias; central = inicio + 29.
const CLOSED = [
  { id: 'a', startDate: '2026-01-01', endDate: '2026-01-30' },
  { id: 'b', startDate: '2026-02-01', endDate: '2026-03-02' },
  { id: 'c', startDate: '2026-03-05', endDate: '2026-04-04' },
  { id: 'd', startDate: '2026-04-07', endDate: '2026-05-08' },
];
const open = (startDate: string) => ({ id: 'o', startDate, endDate: null });
const hist = (...c: object[]) => historyFromCycles(c);
// ciclo aberto em 2026-10-01: central 30/10, janela 30..31/10
const H = hist(...CLOSED, open('2026-10-01'));

test('progresso: dias decorridos sobre a duracao central, com datas de inicio e fim estimado', () => {
  const s = buildScreen(H, '2026-10-11');
  assert.equal(s.progress?.pct, 34);
  assert.equal(s.progress?.startText, '1 out 2026');
  assert.equal(s.progress?.endText, '30 out 2026');
  assert.equal(buildScreen(H, '2026-10-11', { locale: 'en' }).progress?.startText, 'Oct 1, 2026');
});

test('sem previsao: sem progresso, sem alerta; linha "proxima troca" explica o motivo', () => {
  const few = buildScreen(hist(...CLOSED.slice(0, 2), open('2026-10-01')), '2026-10-11');
  assert.equal(few.progress, null);
  assert.equal(few.alert, null);
  assert.equal(few.next.kind, 'insufficient-data');
  assert.match(few.next.subtitle, /Histórico: 2 ciclos/);
  assert.equal(few.forecastPage.collecting?.pct, 50);
  assert.equal(few.forecastPage.collecting?.text, '2 de 4 ciclos encerrados');
  const none = buildScreen(hist(...CLOSED), '2026-10-11');
  assert.equal(none.next.kind, 'no-open-cycle');
});

test('proxima troca: antes, hoje, dentro da janela e depois dela', () => {
  assert.equal(buildScreen(H, '2026-10-11').next.title, 'Próxima troca em 19 dias');
  assert.equal(buildScreen(H, '2026-10-29').next.title, 'Próxima troca em 1 dia');
  assert.equal(buildScreen(H, '2026-10-30').next.title, 'Troca estimada para hoje');
  assert.equal(buildScreen(H, '2026-10-31').next.title, 'Dentro da janela estimada');
  assert.equal(buildScreen(H, '2026-11-03').next.title, 'Passou da janela estimada há 3 dias');
  assert.equal(buildScreen(H, '2026-10-11').next.subtitle, '≈ 30 de outubro de 2026');
});

test('alerta: so perto, dentro ou depois da janela, respeitando a preferencia e a antecedencia', () => {
  assert.equal(buildScreen(H, '2026-10-11').alert, null);
  assert.equal(buildScreen(H, '2026-10-27', { noticeDays: 2 }).alert, null); // faltam 3
  assert.match(buildScreen(H, '2026-10-28', { noticeDays: 2 }).alert?.text ?? '', /começa em 2 dias/);
  assert.match(buildScreen(H, '2026-10-27', { noticeDays: 3 }).alert?.text ?? '', /começa em 3 dias/);
  assert.match(buildScreen(H, '2026-10-30').alert?.text ?? '', /dentro da janela estimada/);
  assert.match(buildScreen(H, '2026-11-05').alert?.text ?? '', /terminou há 5 dias/);
  assert.equal(buildScreen(H, '2026-10-30', { reminderEnabled: false }).alert, null);
  assert.equal(buildScreen(H, '2026-11-05', { reminderEnabled: false }).alert, null);
});

test('alerta nao promete nada: linguagem de estimativa', () => {
  for (const day of ['2026-10-28', '2026-10-30', '2026-11-05']) {
    for (const locale of ['pt-BR', 'en'] as const) {
      const text = buildScreen(H, day, { locale }).alert?.text ?? '';
      assert.doesNotMatch(text, /garant|certeza|guarantee|certain|will run out|vai acabar/i);
    }
  }
});

test('indicadores: trocas, mediana e media vem do dominio', () => {
  const k = Object.fromEntries(buildScreen(H, '2026-10-11').kpis.map((x) => [x.id, x.value]));
  assert.deepEqual(k, { closed: '4', median: '29,5 dias', mean: '29,75 dias' });
  const empty = Object.fromEntries(buildScreen(hist(), '2026-10-11').kpis.map((x) => [x.id, x.value]));
  assert.deepEqual(empty, { closed: '0', median: '—', mean: '—' });
});

test('pagina de previsao: cartao, linhas de detalhe e progresso', () => {
  const p = buildScreen(H, '2026-10-11').forecastPage;
  assert.equal(p.hero?.big, 'em 19 dias');
  assert.equal(p.hero?.approx, '≈ 30 de outubro de 2026');
  assert.deepEqual(p.rows.map((r) => [r.label, r.value]), [
    ['Data central', '30 de outubro de 2026'],
    ['Janela estimada', '30 a 31 de outubro'],
    ['Duração estimada', '29 dias'],
    ['Base de cálculo', 'Baseado em 4 ciclos fechados'],
  ]);
  assert.equal(p.progress?.pct, 34);
});

test('historico: ano do inicio, anos disponiveis e filtro', () => {
  const h = hist(
    { id: 'x', startDate: '2025-11-20', endDate: '2025-12-20' },
    { id: 'y', startDate: '2025-12-21', endDate: '2026-01-25' },
    { id: 'z', startDate: '2026-02-01', endDate: '2026-03-01' },
  );
  const s = buildScreen(h, '2026-05-01');
  assert.deepEqual(s.years, ['2026', '2025']);
  assert.deepEqual(filterRows(s.historyRows, '2025').map((r) => r.id), ['y', 'x']);
  assert.deepEqual(filterRows(s.historyRows, '2026').map((r) => r.id), ['z']);
  assert.deepEqual(filterRows(s.historyRows, 'all').map((r) => r.id), ['z', 'y', 'x']);
  assert.deepEqual(filterRows(s.historyRows, '1999'), []);
});

test('historico: meses e dias so quando o dominio os considera nao ambiguos', () => {
  const rows = buildScreen(hist(
    { id: 'x', startDate: '2025-11-20', endDate: '2025-12-25' }, // 1 mes e 5 dias
    { id: 'y', startDate: '2026-01-31', endDate: '2026-03-01' }, // inicio dia 31: so dias
  ), '2026-05-01').historyRows;
  assert.equal(rows.find((r) => r.id === 'x')?.calendarText, '1 mês e 5 dias');
  assert.equal(rows.find((r) => r.id === 'y')?.calendarText, null);
});

test('ingles: textos, datas e unidades do modelo da tela', () => {
  const s = buildScreen(H, '2026-10-11', { locale: 'en' });
  assert.equal(s.locale, 'en');
  assert.equal(s.currentText, 'In progress since October 1, 2026');
  assert.equal(s.next.title, 'Next change in 19 days');
  assert.equal(s.openCycle?.daysValue, '10');
  assert.equal(s.historyRows[0]?.startText, 'April 7, 2026');
  assert.equal(s.historyRows[0]?.durationText, '31 days');
  if (s.stats.kind === 'ok') {
    assert.equal(s.stats.cards[0]?.label, 'Median');
    assert.equal(s.stats.cards[0]?.value, '29.5 days');
    assert.equal(s.stats.bars[0]?.label, 'Jan 1');
  }
  assert.equal(s.forecast.kind, 'ok');
  if (s.forecast.kind === 'ok') assert.equal(s.forecast.title, 'Estimated next change');
});

test('registros: contagens e datas vem do historico', () => {
  const s = buildScreen(H, '2026-10-11').stats;
  if (s.kind !== 'ok') throw new Error('esperava dados');
  assert.deepEqual(s.records.map((r) => [r.label, r.value]), [
    ['Ciclos registrados', '5'], ['Em andamento', 'Sim'], ['Primeiro registro', '1º de janeiro de 2026'], ['Último encerramento', '8 de maio de 2026'],
  ]);
});
