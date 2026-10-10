// TESTES RECRIADOS na etapa R4 (nao sao os originais perdidos): invariantes do
// historico sob sequencias aleatorias deterministicas e todas as permutacoes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareDates } from '../dates/index.ts';
import {
  emptyHistory, historyFromCycles, listCycles, addToHistory, updateInHistory, closeInHistory,
  reopenInHistory, removeFromHistory, compareCycles, cyclesOverlap,
  CycleOverlapError, OpenCycleConflictError, DuplicateCycleIdError, CycleNotFoundError, CycleStateError,
} from './index.ts';
import type { Cycle, CycleHistory } from './index.ts';
import { prng, randInt, randomDate, makeOpen, makeClosed, permutations, shuffled } from './test-support.ts';
import { InvalidDateRangeError, InvalidDateError } from '../dates/index.ts';

function assertInvariants(h: CycleHistory, ctx: string): void {
  const cs = listCycles(h);
  assert.equal(new Set(cs.map((c) => c.id)).size, cs.length, `${ctx}: ids unicos`);
  assert.ok(cs.filter((c) => c.endDate === null).length <= 1, `${ctx}: no maximo um aberto`);
  for (const c of cs) if (c.endDate !== null) assert.ok(compareDates(c.startDate, c.endDate) <= 0, `${ctx}: inicio<=fim`);
  for (let i = 1; i < cs.length; i++) {
    assert.ok(compareCycles(cs[i - 1] as Cycle, cs[i] as Cycle) <= 0, `${ctx}: ordem`);
  }
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) assert.equal(cyclesOverlap(cs[i] as Cycle, cs[j] as Cycle), false, `${ctx}: sem sobreposicao`);
  }
  // o historico e re-importavel sem perda
  assert.deepEqual(listCycles(historyFromCycles(cs.map((c) => ({ ...c })))), cs, `${ctx}: reimportavel`);
}

const KNOWN = [CycleOverlapError, OpenCycleConflictError, DuplicateCycleIdError, CycleNotFoundError, CycleStateError, InvalidDateRangeError, InvalidDateError];

test('sequencias aleatorias de operacoes: invariantes valem a cada passo; falha nao altera o historico', () => {
  let ok = 0;
  let rejected = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const rnd = prng(seed);
    let h = emptyHistory();
    let n = 0;
    for (let step = 0; step < 80; step++) {
      const before = JSON.stringify(h);
      const list = listCycles(h);
      const pick = list.length > 0 ? (list[randInt(rnd, 0, list.length - 1)] as Cycle).id : 'nenhum';
      const op = randInt(rnd, 0, 5);
      try {
        if (op === 0) {
          const s = randomDate(rnd);
          h = addToHistory(h, makeOpen(`c${n++}`, s));
        } else if (op === 1) {
          const s = randomDate(rnd);
          const e = randomDate(rnd);
          h = addToHistory(h, compareDates(s, e) <= 0 ? makeClosed(`c${n++}`, s, e) : makeClosed(`c${n++}`, e, s));
        } else if (op === 2) h = closeInHistory(h, pick, randomDate(rnd));
        else if (op === 3) h = reopenInHistory(h, pick);
        else if (op === 4) h = updateInHistory(h, pick, rnd() < 0.5 ? { startDate: randomDate(rnd) } : { endDate: randomDate(rnd) });
        else h = removeFromHistory(h, pick);
        ok++;
      } catch (e) {
        rejected++;
        assert.ok(KNOWN.some((k) => e instanceof k), `erro inesperado: ${String(e)}`);
        assert.equal(JSON.stringify(h), before, 'falha nao altera o historico');
      }
      assertInvariants(h, `seed ${seed} passo ${step}`);
    }
  }
  assert.ok(ok > 500 && rejected > 500, `cobertura: ok=${ok} rejeitadas=${rejected}`);
});

test('todas as 5040 permutacoes de 7 ciclos (adjacentes + aberto) geram o mesmo historico', () => {
  const cs: Cycle[] = [
    makeClosed('c1', '2026-01-01', '2026-01-10'), makeClosed('c2', '2026-01-10', '2026-02-01'),
    makeClosed('c3', '2026-02-01', '2026-02-01'), makeClosed('c4', '2026-02-05', '2026-03-01'),
    makeClosed('c5', '2026-03-01', '2026-04-15'), makeClosed('c6', '2026-05-01', '2026-05-31'),
    makeOpen('c7', '2026-05-31'),
  ];
  const expected = listCycles(historyFromCycles(cs));
  const perms = permutations(cs);
  assert.equal(perms.length, 5040);
  for (const p of perms) {
    assert.deepEqual(listCycles(historyFromCycles(p)), expected);
  }
});

test('importacao: qualquer embaralhamento de um conjunto com sobreposicao e sempre rejeitado', () => {
  const cs = [
    makeClosed('a', '2026-01-01', '2026-01-20'), makeClosed('b', '2026-01-20', '2026-02-10'),
    makeClosed('c', '2026-02-09', '2026-03-01'), makeOpen('d', '2026-03-01'),
  ];
  const rnd = prng(99);
  for (let i = 0; i < 200; i++) {
    assert.throws(() => historyFromCycles(shuffled(cs, rnd)), CycleOverlapError);
  }
});

test('mutacao de verificacao: sem a checagem de sobreposicao o detector acusaria (cyclesOverlap e o unico juiz)', () => {
  // sanidade do oraculo: pares conhecidos
  assert.equal(cyclesOverlap(makeClosed('a', '2026-01-01', '2026-01-10'), makeClosed('b', '2026-01-09', '2026-01-12')), true);
  assert.equal(cyclesOverlap(makeClosed('a', '2026-01-01', '2026-01-10'), makeClosed('b', '2026-01-10', '2026-01-12')), false);
});
