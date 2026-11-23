// TESTES NOVOS (apresentacao da previsao). Os textos vem do dominio de previsao REAL;
// os casos de formato usam resultados literais do tipo OkForecast. As datas esperadas
// sao escritas a mao (e conferidas contra o oraculo de testes), nunca calculadas pela UI.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Cycle } from '../../core/domain/cycles/index.ts';
import { makeOpen } from '../../core/domain/cycles/test-support.ts';
import { oracleAddDays } from '../../core/domain/dates/test-support.ts';
import { closedFromDurations } from '../../core/domain/statistics/test-support.ts';
import { forecastNextChange, InvalidForecastInputError } from '../../core/domain/forecast/index.ts';
import type { Forecast, OkForecast } from '../../core/domain/forecast/index.ts';
import { presentForecast, presentNextChange } from './index.ts';
import type { ForecastView, OkView } from './index.ts';

/** Resultado "ok" literal; so os campos que a apresentacao le variam. */
function ok(over: Partial<OkForecast> & { variability?: Partial<OkForecast['variability']> } = {}): OkForecast {
  const { variability, ...rest } = over;
  return {
    status: 'ok',
    closedCount: 8,
    openCycleStart: '2026-11-17',
    medianDays: 29,
    halfWidthDays: 1,
    floorApplied: true,
    window: { lowerDays: 28, centralDays: 29, upperDays: 30 },
    centralDate: '2026-12-15',
    windowStartDate: '2026-12-14',
    windowEndDate: '2026-12-16',
    variability: { madDays: 0, relativeMad: 0, minDays: 29, maxDays: 29, rangeDays: 0, ...variability },
    ...rest,
  };
}

function okView(f: Forecast): OkView {
  const v = presentForecast(f);
  assert.equal(v.kind, 'ok');
  return v as OkView;
}

/** Todas as strings de uma view (inclusive detalhes). */
function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(allStrings);
  return [];
}

function history(durations: readonly number[], openStart: string | null): Cycle[] {
  const cycles: Cycle[] = [...closedFromDurations(durations, { gap: 1 })];
  if (openStart !== null) cycles.push(makeOpen('open', openStart));
  return cycles;
}

describe('insufficient-data', () => {
  test('mensagem, historico e necessario; nenhuma data', () => {
    const v = presentForecast({ status: 'insufficient-data', closedCount: 3, requiredCount: 4 });
    assert.deepEqual({ ...v }, {
      kind: 'insufficient-data',
      title: 'Próxima mudança',
      message: 'Ainda não há histórico suficiente para estimar a próxima mudança.',
      historyLine: 'Histórico: 3 ciclos',
      requiredLine: 'Necessário: 4 ciclos',
    });
    assert.doesNotMatch(JSON.stringify(v), /\d{4}|janeiro|fevereiro|dezembro|Janela|estimada/);
  });

  test('0 e 1 ciclo (singular) com o dominio real', () => {
    const zero = presentNextChange([]);
    assert.equal(zero.kind, 'insufficient-data');
    assert.equal((zero as { historyLine: string }).historyLine, 'Histórico: 0 ciclos');
    const one = presentNextChange(history([28], '2026-11-17'));
    assert.equal((one as { historyLine: string }).historyLine, 'Histórico: 1 ciclo');
    assert.equal((one as { requiredLine: string }).requiredLine, 'Necessário: 4 ciclos');
  });

  test('o numero exigido vem do dominio (requiredCount), nao e fixo na apresentacao', () => {
    const v = presentForecast({ status: 'insufficient-data', closedCount: 3, requiredCount: 6 });
    assert.equal((v as { requiredLine: string }).requiredLine, 'Necessário: 6 ciclos');
  });
});

describe('no-open-cycle', () => {
  test('mensagem e base; nenhuma data-base inventada', () => {
    const v = presentForecast({ status: 'no-open-cycle', closedCount: 8 });
    assert.deepEqual({ ...v }, {
      kind: 'no-open-cycle',
      title: 'Próxima mudança',
      message: 'Há histórico suficiente para fazer a estimativa, mas não existe um ciclo em andamento para aplicar a previsão.',
      basisLine: 'Baseado em 8 ciclos fechados',
    });
    assert.doesNotMatch(JSON.stringify(v), /\d{4}|janeiro|dezembro|Janela/);
  });

  test('com o dominio real', () => {
    const v = presentNextChange(history([28, 28, 28, 28], null));
    assert.equal(v.kind, 'no-open-cycle');
    assert.equal((v as { basisLine: string }).basisLine, 'Baseado em 4 ciclos fechados');
  });
});

describe('ok: exemplo conceitual da especificacao', () => {
  const v = okView(ok());

  test('titulo, data central e janela', () => {
    assert.equal(v.title, 'Próxima mudança estimada');
    assert.equal(v.centralDate, '15 de dezembro de 2026');
    assert.equal(v.windowLine, 'Janela estimada: 14 a 16 de dezembro');
  });

  test('floorApplied = true: mensagem da largura minima (redacao aprovada)', () => {
    assert.deepEqual([...v.variabilityLines], ['A variabilidade observada foi inferior a 1 dia. Por isso, foi aplicada a largura mínima de 1 dia à janela estimada.']);
  });

  test('quantidade de ciclos = closedCount', () => {
    assert.equal(v.basisLine, 'Baseado em 8 ciclos fechados');
    assert.equal(okView(ok({ closedCount: 4 })).basisLine, 'Baseado em 4 ciclos fechados');
    assert.equal(okView(ok({ closedCount: 13 })).basisLine, 'Baseado em 13 ciclos fechados');
  });

  test('detalhes tecnicos', () => {
    assert.equal(v.detailsTitle, 'Detalhes técnicos');
    const rows = Object.fromEntries(v.details.map((r) => [r.label, r.value]));
    assert.deepEqual(rows, {
      'Mediana': '29 dias',
      'MAD (desvio absoluto mediano)': '0 dias',
      'Meia-largura da janela': '1 dia',
      'Variabilidade relativa': '0%',
      'Menor ciclo': '29 dias',
      'Maior ciclo': '29 dias',
      'Amplitude': '0 dias',
    });
  });

  test('"MAD" e "Meia-largura da janela" so aparecem nos detalhes tecnicos, nunca na informacao principal', () => {
    for (const view of [v, okView(ok({ floorApplied: false, halfWidthDays: 7, variability: { madDays: 7 } }))]) {
      const main = [view.title, view.centralDate, view.windowLine, ...view.variabilityLines, view.basisLine].join(' | ');
      assert.doesNotMatch(main, /MAD|Meia-largura/);
    }
    assert.ok(v.details.some((r) => r.label === 'Meia-largura da janela'));
    assert.ok(v.details.some((r) => r.label === 'MAD (desvio absoluto mediano)'));
  });
});

describe('ok: variabilidade', () => {
  test('floorApplied = false: variacao tipica vem de madDays', () => {
    const v = okView(ok({ floorApplied: false, halfWidthDays: 7, medianDays: 31.5, variability: { madDays: 7, relativeMad: 7 / 31.5, minDays: 20, maxDays: 42, rangeDays: 22 } }));
    assert.deepEqual([...v.variabilityLines], ['Variação típica: cerca de 7 dias.']);
    assert.doesNotMatch(v.variabilityLines.join(' '), /inferior|mínima/);
    const rows = Object.fromEntries(v.details.map((r) => [r.label, r.value]));
    assert.equal(rows['Mediana'], '31,5 dias');
    assert.equal(rows['Variabilidade relativa'], '22,2%');
    assert.equal(rows['Menor ciclo'], '20 dias');
    assert.equal(rows['Maior ciclo'], '42 dias');
    assert.equal(rows['Amplitude'], '22 dias');
  });

  test('MAD fracionario e singular/plural', () => {
    assert.deepEqual([...okView(ok({ floorApplied: false, halfWidthDays: 1.5, variability: { madDays: 1.5 } })).variabilityLines], ['Variação típica: cerca de 1,5 dias.']);
    assert.deepEqual([...okView(ok({ floorApplied: false, halfWidthDays: 1, variability: { madDays: 1 } })).variabilityLines], ['Variação típica: cerca de 1 dia.']);
    assert.deepEqual([...okView(ok({ floorApplied: false, halfWidthDays: 2.5, variability: { madDays: 2.5 } })).variabilityLines], ['Variação típica: cerca de 2,5 dias.']);
  });

  test('floorApplied com MAD 0,5 tambem usa a mensagem da largura minima', () => {
    const v = okView(ok({ floorApplied: true, variability: { madDays: 0.5 } }));
    assert.deepEqual([...v.variabilityLines], ['A variabilidade observada foi inferior a 1 dia. Por isso, foi aplicada a largura mínima de 1 dia à janela estimada.']);
    assert.equal(Object.fromEntries(v.details.map((r) => [r.label, r.value]))['MAD (desvio absoluto mediano)'], '0,5 dias');
  });

  test('relativeMad nulo (mediana 0): indisponivel, sem NaN nem Infinity', () => {
    const v = okView(ok({ medianDays: 0, variability: { relativeMad: null, madDays: 0, minDays: 0, maxDays: 0 } }));
    const value = Object.fromEntries(v.details.map((r) => [r.label, r.value]))['Variabilidade relativa'];
    assert.equal(value, 'indisponível (mediana 0)');
    assert.doesNotMatch(allStrings(v).join(' '), /NaN|Infinity|-0\b/);
  });

  test('variabilidade relativa: 1 casa decimal so na apresentacao; o valor original nao muda', () => {
    const input = ok({ variability: { relativeMad: 0.0175438596 } });
    const before = input.variability.relativeMad;
    const v = okView(input);
    assert.equal(Object.fromEntries(v.details.map((r) => [r.label, r.value]))['Variabilidade relativa'], '1,8%');
    assert.equal(input.variability.relativeMad, before);
    assert.equal(before, 0.0175438596);
  });

  test('variabilidade relativa e rotulada como indicador de variabilidade, nao como chance', () => {
    const v = okView(ok({ variability: { relativeMad: 0.05 } }));
    const row = v.details.find((r) => r.label === 'Variabilidade relativa');
    assert.deepEqual({ ...row }, { label: 'Variabilidade relativa', value: '5%' });
  });
});

describe('ok: datas de fronteira (so formatadas, nunca recalculadas)', () => {
  test('virada de mes', () => {
    const v = okView(ok({ centralDate: '2026-02-01', windowStartDate: '2026-01-31', windowEndDate: '2026-02-02' }));
    assert.equal(v.centralDate, '1º de fevereiro de 2026');
    assert.equal(v.windowLine, 'Janela estimada: 31 de janeiro a 2 de fevereiro');
  });

  test('virada de ano', () => {
    const v = okView(ok({ centralDate: '2027-01-01', windowStartDate: '2026-12-31', windowEndDate: '2027-01-02' }));
    assert.equal(v.centralDate, '1º de janeiro de 2027');
    assert.equal(v.windowLine, 'Janela estimada: 31 de dezembro de 2026 a 2 de janeiro de 2027');
  });

  test('2026-01-01 e 2026-12-31 como datas centrais', () => {
    assert.equal(okView(ok({ centralDate: '2026-01-01', windowStartDate: '2025-12-31', windowEndDate: '2026-01-02' })).centralDate, '1º de janeiro de 2026');
    assert.equal(okView(ok({ centralDate: '2026-12-31', windowStartDate: '2026-12-30', windowEndDate: '2027-01-01' })).centralDate, '31 de dezembro de 2026');
  });

  test('bissexto', () => {
    const v = okView(ok({ centralDate: '2024-02-29', windowStartDate: '2024-02-28', windowEndDate: '2024-03-01' }));
    assert.equal(v.centralDate, '29 de fevereiro de 2024');
    assert.equal(v.windowLine, 'Janela estimada: 28 de fevereiro a 1º de março');
  });
});

describe('integracao com forecastNextChange real (datas conferidas contra o oraculo)', () => {
  test('mesmo mes: ciclo aberto em 2026-11-20, 4 ciclos de 28 dias', () => {
    const cycles = history([28, 28, 28, 28], '2026-11-20');
    const f = forecastNextChange(cycles);
    assert.equal(f.status, 'ok');
    assert.equal(oracleAddDays('2026-11-20', 28), '2026-12-18');
    const v = okView(f);
    assert.equal(v.centralDate, '18 de dezembro de 2026');
    assert.equal(v.windowLine, 'Janela estimada: 17 a 19 de dezembro');
    assert.deepEqual([...v.variabilityLines], ['A variabilidade observada foi inferior a 1 dia. Por isso, foi aplicada a largura mínima de 1 dia à janela estimada.']);
    assert.equal(v.basisLine, 'Baseado em 4 ciclos fechados');
    assert.deepEqual(presentNextChange(cycles), v);
  });

  test('virada de mes e ano: ciclo aberto em 2026-12-10', () => {
    const f = forecastNextChange(history([28, 28, 28, 28], '2026-12-10')) as OkForecast;
    assert.equal(oracleAddDays('2026-12-10', 28), '2027-01-07');
    const v = okView(f);
    assert.equal(v.centralDate, '7 de janeiro de 2027');
    assert.equal(v.windowLine, 'Janela estimada: 6 a 8 de janeiro');
  });

  test('janela que cruza o mes: ciclo aberto em 2026-01-31', () => {
    const v = okView(forecastNextChange(history([28, 28, 28, 28], '2026-01-31')));
    assert.equal(v.centralDate, '28 de fevereiro de 2026');
    assert.equal(v.windowLine, 'Janela estimada: 27 de fevereiro a 1º de março');
  });

  test('janela que cruza o ano', () => {
    const v = okView(forecastNextChange(history([28, 28, 28, 28], '2026-12-02')));
    assert.equal(oracleAddDays('2026-12-02', 28), '2026-12-30');
    assert.equal(v.windowLine, 'Janela estimada: 29 a 31 de dezembro');
    const w = okView(forecastNextChange(history([28, 28, 28, 28], '2026-12-03')));
    assert.equal(w.windowLine, 'Janela estimada: 30 de dezembro de 2026 a 1º de janeiro de 2027');
  });

  test('historico irregular: variacao tipica, mediana x,5 e detalhes', () => {
    const v = okView(forecastNextChange(history([20, 28, 35, 42], '2026-11-20')));
    assert.deepEqual([...v.variabilityLines], ['Variação típica: cerca de 7 dias.']);
    const rows = Object.fromEntries(v.details.map((r) => [r.label, r.value]));
    assert.equal(rows['Mediana'], '31,5 dias');
    assert.equal(rows['Menor ciclo'], '20 dias');
    assert.equal(rows['Maior ciclo'], '42 dias');
    assert.equal(rows['Amplitude'], '22 dias');
    assert.equal(rows['Variabilidade relativa'], '22,2%');
    // janela em dias: 25 a 38 (mediana 31,5; h = 7); central = floor(31,5) = 31
    assert.equal(oracleAddDays('2026-11-20', 25), '2026-12-15');
    assert.equal(oracleAddDays('2026-11-20', 31), '2026-12-21');
    assert.equal(oracleAddDays('2026-11-20', 38), '2026-12-28');
    assert.equal(v.windowLine, 'Janela estimada: 15 a 28 de dezembro');
    assert.equal(v.centralDate, '21 de dezembro de 2026');
  });

  test('erros do dominio (nao sao estados normais) sao propagados', () => {
    const two = [...history([28, 28, 28, 28], '2026-11-20'), makeOpen('open2', '2026-12-01')];
    assert.throws(() => presentNextChange(two), InvalidForecastInputError);
  });
});

describe('linguagem: nada de confianca, probabilidade, certeza, peso ou ultimos N', () => {
  const FORBIDDEN = /confian|probabilidad|chance|certeza|garantid|garantia|vai acontecer|acontecer[áa]|previsão certa|intervalo de|margem de|alta segurança|% de (erro|acerto)|peso|pesos|recente|últimos|ultimos|NaN|Infinity/i;

  const views: ForecastView[] = [
    presentForecast({ status: 'insufficient-data', closedCount: 3, requiredCount: 4 }),
    presentForecast({ status: 'insufficient-data', closedCount: 0, requiredCount: 4 }),
    presentForecast({ status: 'no-open-cycle', closedCount: 8 }),
    presentForecast(ok()),
    presentForecast(ok({ floorApplied: false, variability: { madDays: 7, relativeMad: 0.2222 } })),
    presentForecast(ok({ variability: { relativeMad: null } })),
    presentForecast(ok({ variability: { relativeMad: 0.05 } })),
    presentNextChange(history([28, 28, 28, 28], '2026-11-20')),
    presentNextChange(history([5, 60, 12, 90, 30], '2026-11-20')),
  ];

  test('nenhum texto das views contem termos proibidos', () => {
    for (const v of views) for (const s of allStrings(v)) assert.doesNotMatch(s, FORBIDDEN, s);
  });

  test('a janela e chamada de "janela estimada" e a data de "estimada"', () => {
    const v = okView(ok());
    assert.match(v.title, /estimada/);
    assert.match(v.windowLine, /^Janela estimada:/);
  });

  test('a porcentagem so aparece rotulada como variabilidade relativa', () => {
    for (const v of views) {
      if (v.kind !== 'ok') continue;
      for (const s of v.variabilityLines) assert.doesNotMatch(s, /%/);
      for (const r of v.details) if (r.value.includes('%')) assert.equal(r.label, 'Variabilidade relativa');
    }
  });
});

describe('imutabilidade e estados', () => {
  test('views congeladas e entrada nao alterada', () => {
    const input = ok();
    const before = JSON.stringify(input);
    Object.freeze(input);
    const v = okView(input);
    assert.equal(JSON.stringify(input), before);
    assert.equal(Object.isFrozen(v), true);
    assert.equal(Object.isFrozen(v.details), true);
    assert.equal(Object.isFrozen(v.details[0]), true);
    assert.equal(Object.isFrozen(v.variabilityLines), true);
    assert.equal(Object.isFrozen(presentForecast({ status: 'no-open-cycle', closedCount: 4 })), true);
    assert.equal(Object.isFrozen(presentForecast({ status: 'insufficient-data', closedCount: 1, requiredCount: 4 })), true);
  });

  test('estado desconhecido lanca erro (nao mostra previsao inventada)', () => {
    assert.throws(() => presentForecast({ status: 'outro' } as unknown as Forecast), /desconhecido/);
  });

  test('os tres estados normais produzem tres tipos de view', () => {
    assert.equal(presentForecast({ status: 'insufficient-data', closedCount: 3, requiredCount: 4 }).kind, 'insufficient-data');
    assert.equal(presentForecast({ status: 'no-open-cycle', closedCount: 4 }).kind, 'no-open-cycle');
    assert.equal(presentForecast(ok()).kind, 'ok');
  });
});
