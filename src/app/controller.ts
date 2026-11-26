/**
 * Casos de uso da tela: carregar, iniciar e encerrar ciclo. Sem DOM, sem relogio,
 * sem armazenamento direto: depende de CycleRepository e de um gerador de ids.
 * Regra: grava PRIMEIRO; so se a gravacao der certo o estado em memoria muda.
 * Erros sobem inalterados (a tela os traduz com describeError).
 */
import {
  emptyHistory, historyFromCycles, createCycle, addToHistory, closeInHistory, updateInHistory, removeFromHistory,
  getOpenCycle, listCycles,
  CycleStateError,
} from '../core/domain/cycles/index.ts';
import type { CycleChanges, CycleHistory } from '../core/domain/cycles/index.ts';
import type { CycleRepository, LoadProblem } from './repository.ts';

export class GasTrackController {
  private readonly repository: CycleRepository;
  private readonly newId: () => string;
  private current: CycleHistory = emptyHistory();

  constructor(repository: CycleRepository, newId: () => string) {
    this.repository = repository;
    this.newId = newId;
  }

  get history(): CycleHistory {
    return this.current;
  }

  /** Carrega do repositorio. Dados ruins viram historico vazio + `problem`. */
  async load(): Promise<LoadProblem | null> {
    const result = await this.repository.load();
    this.current = historyFromCycles([...result.cycles]);
    return result.problem;
  }

  async startCycle(startDate: string): Promise<CycleHistory> {
    const next = addToHistory(this.current, createCycle({ id: this.newId(), startDate }));
    await this.repository.save(listCycles(next));
    this.current = next;
    return next;
  }

  async finishCycle(endDate: string): Promise<CycleHistory> {
    const open = getOpenCycle(this.current);
    if (open === undefined) throw new CycleStateError('nao ha ciclo em andamento');
    const next = closeInHistory(this.current, open.id, endDate);
    await this.repository.save(listCycles(next));
    this.current = next;
    return next;
  }

  /** Edita datas de um ciclo (inicio e/ou fim) pelas regras do dominio. */
  async updateCycle(id: string, changes: CycleChanges): Promise<CycleHistory> {
    const next = updateInHistory(this.current, id, changes);
    await this.repository.save(listCycles(next));
    this.current = next;
    return next;
  }

  /** Exclui um ciclo (aberto ou fechado). */
  async deleteCycle(id: string): Promise<CycleHistory> {
    const next = removeFromHistory(this.current, id);
    await this.repository.save(listCycles(next));
    this.current = next;
    return next;
  }

  /**
   * Registra a troca do botijao: encerra o ciclo em andamento em `date` e inicia o proximo na
   * mesma data. As duas mudancas valem juntas: uma unica gravacao (tudo ou nada).
   */
  async registerChange(date: string): Promise<CycleHistory> {
    const open = getOpenCycle(this.current);
    if (open === undefined) throw new CycleStateError('nao ha ciclo em andamento');
    const closed = closeInHistory(this.current, open.id, date);
    const next = addToHistory(closed, createCycle({ id: this.newId(), startDate: date }));
    await this.repository.save(listCycles(next));
    this.current = next;
    return next;
  }

  /** Substitui todo o historico (importacao). Os ciclos passam pela validacao do dominio; tudo ou nada. */
  async replaceAll(cycles: unknown): Promise<CycleHistory> {
    const next = historyFromCycles(cycles);
    await this.repository.save(listCycles(next));
    this.current = next;
    return next;
  }

  /** Apaga todos os ciclos deste aparelho. */
  async clearAll(): Promise<CycleHistory> {
    const next = emptyHistory();
    await this.repository.save(listCycles(next));
    this.current = next;
    return next;
  }
}
