/**
 * Porta de persistencia dos ciclos. O restante da aplicacao depende SO desta
 * interface; a implementacao concreta (localStorage hoje, SQLite no futuro) fica atras dela.
 * Assincrona de proposito: o SQLite futuro sera assincrono.
 */
import type { Cycle } from '../core/domain/cycles/index.ts';

/** Problema ao carregar. `null` = tudo certo (inclusive armazenamento vazio). */
export type LoadProblem =
  | { readonly kind: 'corrupt'; readonly backedUp: boolean }
  | { readonly kind: 'unavailable' };

export interface LoadResult {
  /** Ciclos validos; vazio quando nao ha dados ou quando houve problema. */
  readonly cycles: readonly Cycle[];
  readonly problem: LoadProblem | null;
}

/** Falha ao gravar. Quem chama deve tratar a gravacao como NAO realizada. */
export class RepositoryError extends Error {
  readonly code = 'REPOSITORY';

  constructor(reason: string) {
    super(`Falha de armazenamento: ${reason}`);
    this.name = 'RepositoryError';
  }
}

export interface CycleRepository {
  /** Nunca lanca por dados ruins ou armazenamento indisponivel: devolve `problem`. */
  load(): Promise<LoadResult>;
  /** Substitui todos os ciclos. Lanca RepositoryError se nao conseguir gravar. */
  save(cycles: readonly Cycle[]): Promise<void>;
}

/** Implementacao em memoria (testes e reserva). Nao persiste entre execucoes. */
export class MemoryCycleRepository implements CycleRepository {
  private stored: readonly Cycle[];
  failSave = false;

  constructor(initial: readonly Cycle[] = []) {
    this.stored = initial;
  }

  load(): Promise<LoadResult> {
    return Promise.resolve({ cycles: this.stored, problem: null });
  }

  save(cycles: readonly Cycle[]): Promise<void> {
    if (this.failSave) return Promise.reject(new RepositoryError('gravacao recusada'));
    this.stored = cycles;
    return Promise.resolve();
  }
}
