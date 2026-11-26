/**
 * Exportacao e importacao dos ciclos como texto JSON. Sem DOM, sem relogio, sem armazenamento.
 * O conteudo importado NAO e confiado: passa pela validacao do dominio (historyFromCycles) e so
 * entao pode substituir os dados.
 */
import { historyFromCycles, listCycles } from '../core/domain/cycles/index.ts';
import type { Cycle } from '../core/domain/cycles/index.ts';

export const BACKUP_APP = 'gastrack';
export const BACKUP_VERSION = 1;

export type BackupErrorKind = 'not-json' | 'format' | 'version' | 'invalid';

export class BackupError extends Error {
  readonly kind: BackupErrorKind;

  constructor(kind: BackupErrorKind) {
    super(`Importacao recusada: ${kind}`);
    this.name = 'BackupError';
    this.kind = kind;
  }
}

/** `exportedAt`: data civil "YYYY-MM-DD" informada por quem chama (este modulo nao consulta o relogio). */
export function exportBackup(cycles: readonly Cycle[], exportedAt: string): string {
  return JSON.stringify(
    {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt,
      cycles: cycles.map((c) => ({ id: c.id, startDate: c.startDate, endDate: c.endDate })),
    },
    null,
    2,
  );
}

/**
 * Le uma exportacao (ou o formato interno {version:1,cycles}) e devolve os ciclos validos.
 * Lanca BackupError; nunca devolve dados parciais.
 */
export function parseBackup(text: string): readonly Cycle[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('not-json');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new BackupError('format');
  const record = data as { app?: unknown; version?: unknown; cycles?: unknown };
  if (record.app !== undefined && record.app !== BACKUP_APP) throw new BackupError('format');
  if (!Array.isArray(record.cycles)) throw new BackupError('format');
  if (record.version !== BACKUP_VERSION) throw new BackupError('version');
  try {
    return listCycles(historyFromCycles(record.cycles));
  } catch {
    throw new BackupError('invalid');
  }
}
