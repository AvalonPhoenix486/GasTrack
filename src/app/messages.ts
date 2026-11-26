/** Erros conhecidos -> mensagens no idioma escolhido. Desconhecido -> null (quem chama trata). */
import {
  InvalidCycleError, CycleStateError, OpenCycleConflictError, DuplicateCycleIdError,
  CycleNotFoundError, CycleOverlapError,
} from '../core/domain/cycles/index.ts';
import { InvalidDateError, InvalidDateRangeError } from '../core/domain/dates/index.ts';
import { BackupError } from './backup.ts';
import { messagesFor } from './i18n/index.ts';
import type { Locale } from './i18n/index.ts';
import { RepositoryError } from './repository.ts';

export function describeError(error: unknown, locale: Locale = 'pt-BR'): string | null {
  const e = messagesFor(locale).errors;
  if (error instanceof InvalidDateError) return e.invalidDate;
  if (error instanceof InvalidDateRangeError) return e.invalidRange;
  if (error instanceof OpenCycleConflictError) return e.openConflict;
  if (error instanceof CycleOverlapError) return e.overlap;
  if (error instanceof CycleStateError) return e.noOpen;
  if (error instanceof RepositoryError) return e.storage;
  if (error instanceof BackupError) {
    switch (error.kind) {
      case 'not-json': return e.backupNotJson;
      case 'format': return e.backupFormat;
      case 'version': return e.backupVersion;
      case 'invalid': return e.backupInvalid;
    }
  }
  if (error instanceof DuplicateCycleIdError || error instanceof CycleNotFoundError || error instanceof InvalidCycleError) {
    return e.invalidCycle;
  }
  return null;
}
