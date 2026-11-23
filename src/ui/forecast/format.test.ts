// TESTES NOVOS (apresentacao da previsao): formatacao pt-BR, sem Date/Intl.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { InvalidDateError } from '../../core/domain/dates/index.ts';
import {
  dayLabel, formatClosedCycles, formatCycles, formatDateWindow, formatDays, formatLongDate, formatNumber, formatPercent, monthName,
} from './format.ts';

describe('datas', () => {
  test('nome dos 12 meses', () => {
    assert.deepEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(monthName),
      ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    );
  });

  test('dia 1 e escrito 1º; os demais em algarismos', () => {
    assert.equal(dayLabel(1), '1º');
    assert.equal(dayLabel(2), '2');
    assert.equal(dayLabel(31), '31');
  });

  test('data longa', () => {
    assert.equal(formatLongDate('2026-12-15'), '15 de dezembro de 2026');
    assert.equal(formatLongDate('2026-01-01'), '1º de janeiro de 2026');
    assert.equal(formatLongDate('2026-12-31'), '31 de dezembro de 2026');
    assert.equal(formatLongDate('2024-02-29'), '29 de fevereiro de 2024');
    assert.equal(formatLongDate('0001-01-01'), '1º de janeiro de 1');
    assert.equal(formatLongDate('9999-12-31'), '31 de dezembro de 9999');
  });

  test('janela no mesmo mes', () => {
    assert.equal(formatDateWindow('2026-12-14', '2026-12-16'), '14 a 16 de dezembro');
    assert.equal(formatDateWindow('2026-03-01', '2026-03-03'), '1º a 3 de março');
  });

  test('janela com virada de mes (mesmo ano)', () => {
    assert.equal(formatDateWindow('2026-01-30', '2026-02-02'), '30 de janeiro a 2 de fevereiro');
    assert.equal(formatDateWindow('2026-01-31', '2026-02-01'), '31 de janeiro a 1º de fevereiro');
    assert.equal(formatDateWindow('2024-02-28', '2024-03-01'), '28 de fevereiro a 1º de março');
  });

  test('janela com virada de ano (anos nos dois lados)', () => {
    assert.equal(formatDateWindow('2026-12-30', '2027-01-01'), '30 de dezembro de 2026 a 1º de janeiro de 2027');
    assert.equal(formatDateWindow('2026-12-31', '2027-01-02'), '31 de dezembro de 2026 a 2 de janeiro de 2027');
  });

  test('inicio e fim iguais: uma data so', () => {
    assert.equal(formatDateWindow('2026-12-15', '2026-12-15'), '15 de dezembro');
  });

  test('data invalida lanca erro do dominio de datas (nao inventa texto)', () => {
    for (const bad of ['2026-02-30', '', 'abc', '2026-1-1']) {
      assert.throws(() => formatLongDate(bad), InvalidDateError, bad);
      assert.throws(() => formatDateWindow(bad, '2026-01-01'), InvalidDateError, bad);
    }
  });
});

describe('numeros, dias, ciclos e porcentagem', () => {
  test('numero com virgula decimal', () => {
    assert.equal(formatNumber(28), '28');
    assert.equal(formatNumber(28.5), '28,5');
    assert.equal(formatNumber(0), '0');
  });

  test('dias: singular somente quando o valor e exatamente 1', () => {
    assert.equal(formatDays(0), '0 dias');
    assert.equal(formatDays(0.5), '0,5 dias');
    assert.equal(formatDays(1), '1 dia');
    assert.equal(formatDays(1.5), '1,5 dias');
    assert.equal(formatDays(1.9), '1,9 dias');
    assert.equal(formatDays(2), '2 dias');
    assert.equal(formatDays(28.5), '28,5 dias');
  });

  test('ciclos', () => {
    assert.equal(formatCycles(1), '1 ciclo');
    assert.equal(formatCycles(3), '3 ciclos');
    assert.equal(formatClosedCycles(1), '1 ciclo fechado');
    assert.equal(formatClosedCycles(8), '8 ciclos fechados');
  });

  test('porcentagem de exibicao (no maximo 1 casa)', () => {
    assert.equal(formatPercent(0), '0%');
    assert.equal(formatPercent(0.05), '5%');
    assert.equal(formatPercent(0.0175), '1,8%');
    assert.equal(formatPercent(2 / 9), '22,2%');
    assert.equal(formatPercent(0.4), '40%');
    assert.equal(formatPercent(1.5), '150%');
  });
});
