// TESTES RECRIADOS na etapa R4 (saneamento de Cycles). NAO sao os originais
// perdidos; cobrem PD-001 (sem sobreposicao) e PD-002 (reabertura).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { InvalidDateError, InvalidDateRangeError } from '../dates/index.ts';
import {
  emptyHistory, historyFromCycles, listCycles, findCycle, getOpenCycle, hasOpenCycle, getClosedCycles,
  addToHistory, updateInHistory, closeInHistory, reopenInHistory, removeFromHistory, cyclesOverlap,
  CycleOverlapError, OpenCycleConflictError, DuplicateCycleIdError, CycleNotFoundError, CycleStateError,
  InvalidCycleError,
} from './index.ts';
import type { CycleHistory } from './index.ts';
import { makeClosed, makeOpen, prng, randInt } from './test-support.ts';

const snap = (h: CycleHistory) => JSON.stringify(h);
const ids = (h: CycleHistory) => listCycles(h).map((c) => c.id);

/** a [01-01..01-31], b [01-31..02-28] (adjacente a a), c aberto desde 03-01 (adjacente nao: depois de b). */
function base(): CycleHistory {
  let h = emptyHistory();
  h = addToHistory(h, makeClosed('a', '2026-01-01', '2026-01-31'));
  h = addToHistory(h, makeClosed('b', '2026-01-31', '2026-02-28'));
  h = addToHistory(h, makeOpen('c', '2026-03-01'));
  return h;
}

describe('historico vazio', () => {
  test('vazio: sem ciclos, sem aberto', () => {
    const h = emptyHistory();
    assert.deepEqual(listCycles(h), []);
    assert.equal(hasOpenCycle(h), false);
    assert.equal(getOpenCycle(h), undefined);
    assert.deepEqual(getClosedCycles(h), []);
    assert.equal(findCycle(h, 'x'), undefined);
  });
  test('operacoes sobre id inexistente em historico vazio', () => {
    const h = emptyHistory();
    assert.throws(() => updateInHistory(h, 'x', {}), CycleNotFoundError);
    assert.throws(() => closeInHistory(h, 'x', '2026-01-01'), CycleNotFoundError);
    assert.throws(() => reopenInHistory(h, 'x'), CycleNotFoundError);
    assert.throws(() => removeFromHistory(h, 'x'), CycleNotFoundError);
  });
  test('historyFromCycles([]) e vazio; nao-lista e rejeitada', () => {
    assert.deepEqual(listCycles(historyFromCycles([])), []);
    assert.throws(() => historyFromCycles({} as never), InvalidCycleError);
  });
});

describe('PD-001: sobreposicao', () => {
  test('cyclesOverlap: tabela de casos', () => {
    const A = makeClosed('a', '2026-01-10', '2026-01-20');
    const cases: Array<[string, ReturnType<typeof makeClosed>, boolean]> = [
      ['identico', makeClosed('x', '2026-01-10', '2026-01-20'), true],
      ['contido', makeClosed('x', '2026-01-12', '2026-01-15'), true],
      ['contem', makeClosed('x', '2026-01-01', '2026-01-31'), true],
      ['cruza o inicio', makeClosed('x', '2026-01-05', '2026-01-11'), true],
      ['cruza o fim', makeClosed('x', '2026-01-19', '2026-01-25'), true],
      ['adjacente antes', makeClosed('x', '2026-01-01', '2026-01-10'), false],
      ['adjacente depois', makeClosed('x', '2026-01-20', '2026-01-30'), false],
      ['separado antes', makeClosed('x', '2026-01-01', '2026-01-09'), false],
      ['separado depois', makeClosed('x', '2026-01-21', '2026-01-30'), false],
    ];
    for (const [name, other, expected] of cases) {
      assert.equal(cyclesOverlap(A, other), expected, name);
      assert.equal(cyclesOverlap(other, A), expected, `${name} (simetrico)`);
    }
  });

  test('adjacentes compartilhando a data-fronteira sao aceitos', () => {
    const h = base();
    assert.deepEqual(ids(h), ['a', 'b', 'c']);
  });

  test('sobreposicao e rejeitada ao adicionar; historico original intacto', () => {
    const h = base();
    const before = snap(h);
    for (const bad of [
      makeClosed('x', '2026-01-15', '2026-01-20'),
      makeClosed('x', '2026-01-30', '2026-02-01'),
      makeClosed('x', '2025-12-01', '2026-01-02'),
      makeClosed('x', '2026-01-01', '2026-01-31'),
    ]) {
      assert.throws(() => addToHistory(h, bad), CycleOverlapError, JSON.stringify(bad));
    }
    assert.equal(snap(h), before);
  });

  test('erro de sobreposicao identifica os ciclos', () => {
    try {
      addToHistory(base(), makeClosed('x', '2026-01-15', '2026-01-20'));
      assert.fail('deveria lancar');
    } catch (e) {
      assert.ok(e instanceof CycleOverlapError);
      assert.equal(e.code, 'CYCLE_OVERLAP');
      assert.ok([e.firstId, e.secondId].includes('x'));
      assert.ok([e.firstId, e.secondId].includes('a'));
    }
  });

  test('ciclo aberto que comecaria antes de um fechado sobrepoe e e rejeitado', () => {
    const h = addToHistory(emptyHistory(), makeClosed('a', '2026-01-01', '2026-01-31'));
    assert.throws(() => addToHistory(h, makeOpen('o', '2026-01-15')), CycleOverlapError);
    assert.throws(() => addToHistory(h, makeOpen('o', '2025-12-01')), CycleOverlapError);
    assert.deepEqual(ids(addToHistory(h, makeOpen('o', '2026-01-31'))), ['a', 'o']);
    assert.deepEqual(ids(addToHistory(h, makeOpen('o', '2026-02-05'))), ['a', 'o']);
  });

  test('historyFromCycles (importacao) rejeita sobreposicao em qualquer ordem', () => {
    const recs = [
      { id: 'a', startDate: '2026-01-01', endDate: '2026-01-31' },
      { id: 'b', startDate: '2026-01-31', endDate: '2026-02-28' },
      { id: 'c', startDate: '2026-02-27', endDate: '2026-03-10' },
    ];
    assert.throws(() => historyFromCycles(recs), CycleOverlapError);
    assert.throws(() => historyFromCycles([...recs].reverse()), CycleOverlapError);
    assert.deepEqual(ids(historyFromCycles([recs[1], recs[0]])), ['a', 'b']);
  });

  test('historyFromCycles: ids repetidos e dois abertos continuam rejeitados', () => {
    assert.throws(() => historyFromCycles([
      { id: 'a', startDate: '2026-01-01', endDate: null }, { id: 'a', startDate: '2026-02-01', endDate: null },
    ]), DuplicateCycleIdError);
    assert.throws(() => historyFromCycles([
      { id: 'a', startDate: '2026-01-01', endDate: null }, { id: 'b', startDate: '2026-02-01', endDate: null },
    ]), OpenCycleConflictError);
  });

  test('edicao que cria sobreposicao e rejeitada; valida e aceita', () => {
    const h = base();
    const before = snap(h);
    assert.throws(() => updateInHistory(h, 'a', { endDate: '2026-02-10' }), CycleOverlapError);
    assert.throws(() => updateInHistory(h, 'b', { startDate: '2026-01-30' }), CycleOverlapError);
    assert.throws(() => updateInHistory(h, 'b', { endDate: '2026-03-02' }), CycleOverlapError); // invade o aberto c
    assert.equal(snap(h), before);
    const ok = updateInHistory(h, 'b', { endDate: '2026-03-01' }); // adjacente ao aberto c
    assert.equal(findCycle(ok, 'b')?.endDate, '2026-03-01');
    assert.equal(snap(h), before);
  });

  test('edicao com datas invalidas falha sem alterar o historico', () => {
    const h = base();
    const before = snap(h);
    assert.throws(() => updateInHistory(h, 'a', { startDate: '2026-02-30' }), InvalidDateError);
    assert.throws(() => updateInHistory(h, 'a', { startDate: '2026-02-01' }), InvalidDateRangeError);
    assert.throws(() => updateInHistory(h, 'zzz', { startDate: '2026-02-01' }), CycleNotFoundError);
    assert.equal(snap(h), before);
  });

  test('fechar um ciclo aberto: adjacencia ok; sobreposicao nao ocorre se fim >= inicio', () => {
    let h = addToHistory(emptyHistory(), makeClosed('a', '2026-01-01', '2026-01-31'));
    h = addToHistory(h, makeOpen('o', '2026-01-31'));
    const closed = closeInHistory(h, 'o', '2026-02-10');
    assert.equal(findCycle(closed, 'o')?.endDate, '2026-02-10');
    assert.equal(hasOpenCycle(closed), false);
    const before = snap(h);
    assert.throws(() => closeInHistory(h, 'o', '2026-01-30'), InvalidDateRangeError);
    assert.throws(() => closeInHistory(h, 'a', '2026-02-01'), CycleStateError);
    assert.equal(snap(h), before);
  });

  test('fechar o aberto nao pode atingir ciclo posterior inserido depois (ordem cronologica)', () => {
    // aberto o em 02-01; ciclo fechado posterior nao pode coexistir (sobreporia o aberto)
    let h = addToHistory(emptyHistory(), makeOpen('o', '2026-02-01'));
    assert.throws(() => addToHistory(h, makeClosed('z', '2026-03-01', '2026-03-10')), CycleOverlapError);
    h = closeInHistory(h, 'o', '2026-02-20');
    assert.deepEqual(ids(addToHistory(h, makeClosed('z', '2026-03-01', '2026-03-10'))), ['o', 'z']);
  });
});

describe('PD-002: reabertura', () => {
  test('reabrir o ultimo ciclo fechado e valido; preserva o id e o inicio', () => {
    let h = addToHistory(emptyHistory(), makeClosed('a', '2026-01-01', '2026-01-31'));
    h = addToHistory(h, makeClosed('b', '2026-01-31', '2026-02-28'));
    const r = reopenInHistory(h, 'b');
    assert.deepEqual(findCycle(r, 'b'), { id: 'b', startDate: '2026-01-31', endDate: null });
    assert.equal(getOpenCycle(r)?.id, 'b');
    assert.deepEqual(ids(r), ['a', 'b']);
    assert.equal(findCycle(r, 'a'), findCycle(h, 'a'), 'ciclo nao afetado mantem a referencia');
    assert.equal(findCycle(h, 'b')?.endDate, '2026-02-28', 'original intacto');
  });

  test('reabrir via updateInHistory(endDate: null) segue a mesma regra', () => {
    const h = addToHistory(emptyHistory(), makeClosed('a', '2026-01-01', '2026-01-31'));
    assert.equal(getOpenCycle(updateInHistory(h, 'a', { endDate: null } as never))?.id, 'a');
    const h2 = base();
    const before = snap(h2);
    assert.throws(() => updateInHistory(h2, 'a', { endDate: null } as never), OpenCycleConflictError);
    assert.equal(snap(h2), before);
  });

  test('reabrir quando ja ha outro aberto e rejeitado', () => {
    const h = base();
    const before = snap(h);
    assert.throws(() => reopenInHistory(h, 'b'), OpenCycleConflictError);
    assert.equal(snap(h), before);
  });

  test('reabrir que sobreporia ciclo posterior e rejeitado', () => {
    let h = addToHistory(emptyHistory(), makeClosed('a', '2026-01-01', '2026-01-31'));
    h = addToHistory(h, makeClosed('b', '2026-02-10', '2026-02-20'));
    const before = snap(h);
    assert.throws(() => reopenInHistory(h, 'a'), CycleOverlapError);
    assert.equal(snap(h), before);
    // com b removido, reabrir a e valido
    assert.equal(getOpenCycle(reopenInHistory(removeFromHistory(h, 'b'), 'a'))?.id, 'a');
  });

  test('reabrir um ciclo ja aberto e rejeitado', () => {
    const h = addToHistory(emptyHistory(), makeOpen('o', '2026-01-01'));
    assert.throws(() => reopenInHistory(h, 'o'), CycleStateError);
  });

  test('reabrir e fechar de novo preserva o id', () => {
    const h = addToHistory(emptyHistory(), makeClosed('a', '2026-01-01', '2026-01-31'));
    const again = closeInHistory(reopenInHistory(h, 'a'), 'a', '2026-02-05');
    assert.deepEqual(findCycle(again, 'a'), { id: 'a', startDate: '2026-01-01', endDate: '2026-02-05' });
  });
});

describe('add, delete, ordem e isolamento', () => {
  test('ordem cronologica independe da ordem de insercao', () => {
    const cs = [
      makeClosed('a', '2026-01-01', '2026-01-31'), makeClosed('b', '2026-01-31', '2026-02-28'),
      makeClosed('c', '2026-03-05', '2026-04-01'), makeOpen('d', '2026-04-01'),
    ];
    for (const order of [[0, 1, 2, 3], [3, 2, 1, 0], [2, 0, 3, 1]]) {
      let h = emptyHistory();
      for (const i of order) h = addToHistory(h, cs[i] as never);
      assert.deepEqual(ids(h), ['a', 'b', 'c', 'd']);
    }
  });

  test('id duplicado e segundo aberto sao rejeitados sem alterar o historico', () => {
    const h = base();
    const before = snap(h);
    assert.throws(() => addToHistory(h, makeClosed('a', '2027-01-01', '2027-01-02')), DuplicateCycleIdError);
    assert.throws(() => addToHistory(h, makeOpen('n', '2027-01-01')), OpenCycleConflictError);
    assert.throws(() => addToHistory(h, { id: 'bad id', startDate: '2027-01-01', endDate: null } as never), InvalidCycleError);
    assert.equal(snap(h), before);
  });

  test('remover (fechado ou aberto) libera espaco; original intacto', () => {
    const h = base();
    const before = snap(h);
    const r1 = removeFromHistory(h, 'b');
    assert.deepEqual(ids(r1), ['a', 'c']);
    assert.deepEqual(ids(addToHistory(r1, makeClosed('n', '2026-01-31', '2026-02-27'))), ['a', 'n', 'c']);
    const r2 = removeFromHistory(h, 'c');
    assert.equal(hasOpenCycle(r2), false);
    assert.equal(snap(h), before);
  });

  test('historico e ciclos sao imutaveis (congelados)', () => {
    const h = base();
    assert.ok(Object.isFrozen(h));
    assert.ok(Object.isFrozen(h.cycles));
    assert.throws(() => { (h.cycles as unknown as unknown[]).push(1); }, TypeError);
  });

  test('toda operacao devolve novo historico e nunca altera o recebido', () => {
    const h = base();
    const before = snap(h);
    const results = [
      addToHistory(h, makeClosed('n', '2025-01-01', '2025-01-05')),
      updateInHistory(h, 'a', { startDate: '2025-12-31' }),
      removeFromHistory(h, 'a'),
    ];
    for (const r of results) assert.notEqual(r, h);
    assert.equal(snap(h), before);
  });

  test('ciclo de zero dia: na fronteira e aceito; dentro de outro ciclo e rejeitado (a confirmar)', () => {
    const h = addToHistory(emptyHistory(), makeClosed('a', '2026-01-01', '2026-01-31'));
    assert.deepEqual(ids(addToHistory(h, makeClosed('z', '2026-01-31', '2026-01-31'))), ['a', 'z']);
    assert.throws(() => addToHistory(h, makeClosed('z', '2026-01-15', '2026-01-15')), CycleOverlapError);
  });
});

// TESTES RECRIADOS na etapa R5: unicidade de ciclos de zero dia na mesma data.
describe('R5: ciclos de zero dia', () => {
  const z = (id: string, d: string) => makeClosed(id, d, d);

  test('um ciclo de zero dia continua valido individualmente', () => {
    const h = addToHistory(emptyHistory(), z('z1', '2026-05-10'));
    assert.deepEqual(findCycle(h, 'z1'), { id: 'z1', startDate: '2026-05-10', endDate: '2026-05-10' });
    assert.deepEqual(listCycles(historyFromCycles([{ id: 'z1', startDate: '2026-05-10', endDate: '2026-05-10' }])).length, 1);
  });

  test('dois de zero dia na mesma data (ids diferentes) sao rejeitados, nas duas ordens', () => {
    const h1 = addToHistory(emptyHistory(), z('z1', '2026-05-10'));
    const before1 = snap(h1);
    assert.throws(() => addToHistory(h1, z('z2', '2026-05-10')), CycleOverlapError);
    assert.equal(snap(h1), before1);
    const h2 = addToHistory(emptyHistory(), z('z2', '2026-05-10'));
    assert.throws(() => addToHistory(h2, z('z1', '2026-05-10')), CycleOverlapError);
    const recs = [
      { id: 'z1', startDate: '2026-05-10', endDate: '2026-05-10' },
      { id: 'z2', startDate: '2026-05-10', endDate: '2026-05-10' },
    ];
    assert.throws(() => historyFromCycles(recs), CycleOverlapError);
    assert.throws(() => historyFromCycles([...recs].reverse()), CycleOverlapError);
    assert.equal(cyclesOverlap(z('a', '2026-05-10'), z('b', '2026-05-10')), true);
  });

  test('independe da posicao: com outros ciclos no historico', () => {
    let h = addToHistory(emptyHistory(), makeClosed('a', '2026-05-01', '2026-05-10'));
    h = addToHistory(h, z('z1', '2026-05-10')); // zero dia na fronteira de a: adjacente, valido
    h = addToHistory(h, makeClosed('b', '2026-05-10', '2026-05-20')); // adjacente a z1 e a a
    assert.deepEqual(ids(h), ['a', 'z1', 'b']);
    const before = snap(h);
    assert.throws(() => addToHistory(h, z('z2', '2026-05-10')), CycleOverlapError);
    assert.equal(snap(h), before);
  });

  test('dois de zero dia em datas diferentes sao aceitos, em qualquer ordem', () => {
    const a = z('z1', '2026-05-10');
    const b = z('z2', '2026-05-11');
    assert.deepEqual(ids(addToHistory(addToHistory(emptyHistory(), a), b)), ['z1', 'z2']);
    assert.deepEqual(ids(addToHistory(addToHistory(emptyHistory(), b), a)), ['z1', 'z2']);
  });

  test('zero dia estritamente dentro de outro ciclo continua rejeitado, em ambas as ordens', () => {
    const wide = makeClosed('w', '2026-05-01', '2026-05-20');
    const inner = z('z1', '2026-05-10');
    assert.throws(() => addToHistory(addToHistory(emptyHistory(), wide), inner), CycleOverlapError);
    assert.throws(() => addToHistory(addToHistory(emptyHistory(), inner), wide), CycleOverlapError);
    assert.throws(() => historyFromCycles([wide, inner]), CycleOverlapError);
    assert.throws(() => historyFromCycles([inner, wide]), CycleOverlapError);
    // dentro de um ciclo aberto tambem
    assert.throws(() => addToHistory(addToHistory(emptyHistory(), makeOpen('o', '2026-05-01')), z('z1', '2026-05-10')), CycleOverlapError);
  });

  test('adjacentes continuam validos (fim de um = inicio do outro)', () => {
    const h = addToHistory(addToHistory(emptyHistory(), makeClosed('a', '2026-05-01', '2026-05-10')), makeClosed('b', '2026-05-10', '2026-05-20'));
    assert.deepEqual(ids(h), ['a', 'b']);
  });

  test('lacunas continuam aceitas', () => {
    const h = addToHistory(addToHistory(emptyHistory(), makeClosed('a', '2026-05-01', '2026-05-10')), makeClosed('b', '2026-06-01', '2026-06-10'));
    assert.deepEqual(ids(h), ['a', 'b']);
  });

  test('edicao que produz duplicacao e rejeitada; historico intacto', () => {
    let h = addToHistory(emptyHistory(), z('z1', '2026-05-10'));
    h = addToHistory(h, makeClosed('b', '2026-05-11', '2026-05-20'));
    const before = snap(h);
    // b -> [05-10, 05-10] duplicaria z1
    assert.throws(() => updateInHistory(h, 'b', { startDate: '2026-05-10', endDate: '2026-05-10' }), CycleOverlapError);
    // z1 editado para a mesma data de outro zero dia
    const h2 = addToHistory(h, z('z3', '2026-05-30'));
    const before2 = snap(h2);
    assert.throws(() => updateInHistory(h2, 'z3', { startDate: '2026-05-10', endDate: '2026-05-10' }), CycleOverlapError);
    assert.equal(snap(h), before);
    assert.equal(snap(h2), before2);
    // edicao valida de zero dia para outra data livre
    const ok = updateInHistory(h2, 'z3', { startDate: '2026-06-01', endDate: '2026-06-01' });
    assert.deepEqual(findCycle(ok, 'z3'), { id: 'z3', startDate: '2026-06-01', endDate: '2026-06-01' });
  });

  test('fechar um aberto no mesmo dia de inicio, havendo zero dia nessa data, e rejeitado', () => {
    let h = addToHistory(emptyHistory(), z('z1', '2026-05-10'));
    h = addToHistory(h, makeOpen('o', '2026-05-10')); // adjacente ao zero dia: valido
    const before = snap(h);
    assert.throws(() => closeInHistory(h, 'o', '2026-05-10'), CycleOverlapError);
    assert.equal(snap(h), before);
    assert.equal(findCycle(closeInHistory(h, 'o', '2026-05-11'), 'o')?.endDate, '2026-05-11');
  });

  test('reabertura nao produz duplicacao de zero dia (reabrir zero dia ao lado de aberto e outras regras)', () => {
    const h = addToHistory(emptyHistory(), z('z1', '2026-05-10'));
    const r = reopenInHistory(h, 'z1'); // vira aberto desde 05-10: valido
    assert.deepEqual(findCycle(r, 'z1'), { id: 'z1', startDate: '2026-05-10', endDate: null });
    // fechar de novo no mesmo dia com outro zero dia ja presente na data: rejeitado
    const h2 = addToHistory(r, makeClosed('b', '2026-05-01', '2026-05-10'));
    const closedSame = closeInHistory(h2, 'z1', '2026-05-10');
    assert.deepEqual(ids(closedSame), ['b', 'z1']);
    // com outro zero dia na mesma data, a reabertura/fechamento nunca deixa duplicar
    const h3 = addToHistory(emptyHistory(), z('zA', '2026-05-10'));
    assert.throws(() => addToHistory(h3, z('zB', '2026-05-10')), CycleOverlapError);
    const before = snap(h3);
    assert.throws(() => reopenInHistory(h3, 'zX'), CycleNotFoundError);
    assert.equal(snap(h3), before);
  });

  test('invariante central: nenhuma sequencia aleatoria produz dois zero dia na mesma data', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rnd = prng(seed);
      let h = emptyHistory();
      let n = 0;
      for (let step = 0; step < 60; step++) {
        const d = `2026-05-${String(randInt(rnd, 1, 6)).padStart(2, '0')}`;
        const list = listCycles(h);
        const pick = list.length ? (list[randInt(rnd, 0, list.length - 1)] as { id: string }).id : 'nenhum';
        try {
          const op = randInt(rnd, 0, 3);
          if (op === 0) h = addToHistory(h, makeClosed(`c${n++}`, d, d));
          else if (op === 1) h = updateInHistory(h, pick, { startDate: d, endDate: d });
          else if (op === 2) h = closeInHistory(h, pick, d);
          else h = reopenInHistory(h, pick);
        } catch { /* rejeicao esperada */ }
        const zeros = listCycles(h).filter((c) => c.endDate === c.startDate).map((c) => c.startDate);
        assert.equal(new Set(zeros).size, zeros.length, `seed ${seed} passo ${step}`);
      }
    }
  });
});
