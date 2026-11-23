/** Erros conhecidos -> mensagens em portugues para o usuario. Desconhecido -> null (quem chama trata). */
import {
  InvalidCycleError, CycleStateError, OpenCycleConflictError, DuplicateCycleIdError,
  CycleNotFoundError, CycleOverlapError,
} from '../core/domain/cycles/index.ts';
import { InvalidDateError, InvalidDateRangeError } from '../core/domain/dates/index.ts';
import { RepositoryError } from './repository.ts';

export function describeError(error: unknown): string | null {
  if (error instanceof InvalidDateError) return 'Data inválida. Escolha uma data real do calendário.';
  if (error instanceof InvalidDateRangeError) return 'A data de encerramento não pode ser anterior à data de início.';
  if (error instanceof OpenCycleConflictError) return 'Já existe um ciclo em andamento. Encerre-o antes de iniciar outro.';
  if (error instanceof CycleOverlapError) return 'Essas datas coincidem com outro ciclo já registrado. Escolha datas que não se sobreponham a ciclos existentes.';
  if (error instanceof CycleStateError) return 'Não há ciclo em andamento para encerrar.';
  if (error instanceof RepositoryError) return 'Não foi possível salvar os dados neste aparelho. Nada foi alterado.';
  if (error instanceof DuplicateCycleIdError || error instanceof CycleNotFoundError || error instanceof InvalidCycleError) {
    return 'Os dados do ciclo são inválidos. Nada foi alterado.';
  }
  return null;
}
