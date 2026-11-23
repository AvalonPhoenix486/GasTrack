/**
 * Persistencia provisoria (D008) em localStorage, atras de CycleRepository.
 * Formato: {"version":1,"cycles":[{"id","startDate","endDate"}]}. Os dados lidos
 * passam pela validacao do dominio (historyFromCycles); nada e confiado.
 */
import { historyFromCycles, listCycles } from '../core/domain/cycles/index.ts';
import type { Cycle } from '../core/domain/cycles/index.ts';
import { RepositoryError } from './repository.ts';
import type { CycleRepository, LoadResult } from './repository.ts';

/** Subconjunto de Storage usado aqui. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const STORAGE_KEY = 'gastrack.cycles';
const FORMAT_VERSION = 1;

export class LocalStorageCycleRepository implements CycleRepository {
  private readonly getStorage: () => StorageLike;
  private readonly key: string;

  /** `getStorage` e lazy porque ate ACESSAR window.localStorage pode lancar. */
  constructor(getStorage: () => StorageLike, key: string = STORAGE_KEY) {
    this.getStorage = getStorage;
    this.key = key;
  }

  load(): Promise<LoadResult> {
    let storage: StorageLike;
    let raw: string | null;
    try {
      storage = this.getStorage();
      raw = storage.getItem(this.key);
    } catch {
      return Promise.resolve({ cycles: [], problem: { kind: 'unavailable' } });
    }
    if (raw === null) return Promise.resolve({ cycles: [], problem: null });
    try {
      const data: unknown = JSON.parse(raw);
      if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('formato');
      const record = data as { version?: unknown; cycles?: unknown };
      if (record.version !== FORMAT_VERSION) throw new Error('versao');
      const history = historyFromCycles(record.cycles);
      return Promise.resolve({ cycles: listCycles(history), problem: null });
    } catch {
      return Promise.resolve({ cycles: [], problem: { kind: 'corrupt', backedUp: this.backup(storage, raw) } });
    }
  }

  save(cycles: readonly Cycle[]): Promise<void> {
    try {
      const payload = {
        version: FORMAT_VERSION,
        cycles: cycles.map((c) => ({ id: c.id, startDate: c.startDate, endDate: c.endDate })),
      };
      this.getStorage().setItem(this.key, JSON.stringify(payload));
      return Promise.resolve();
    } catch {
      return Promise.reject(new RepositoryError('nao foi possivel gravar no armazenamento local'));
    }
  }

  /** Guarda uma copia dos dados ilegiveis para nao serem perdidos no proximo save. */
  private backup(storage: StorageLike, raw: string): boolean {
    try {
      storage.setItem(`${this.key}.corrupt`, raw);
      return true;
    } catch {
      return false;
    }
  }
}
