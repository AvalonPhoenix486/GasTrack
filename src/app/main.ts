/** Ponto de entrada no navegador: liga repositorio, controlador e tela. */
import type { CycleChanges } from '../core/domain/cycles/index.ts';
import { GasTrackController } from './controller.ts';
import { LocalStorageCycleRepository } from './localStorageRepository.ts';
import { localCivilDate } from './localDate.ts';
import { describeError } from './messages.ts';
import { bind, render, setBusy, showMessage, showNotice, showSuccess } from './render.ts';
import type { UiState } from './render.ts';
import { buildScreen } from './screen.ts';

const controller = new GasTrackController(
  new LocalStorageCycleRepository(() => window.localStorage),
  () => crypto.randomUUID(),
);

let ui: UiState = { editingId: null, deletingId: null };
let busy = false;

function refresh(): void {
  const screen = buildScreen(controller.history, localCivilDate());
  render(screen, ui);
  if (screen.forecast.kind === 'unavailable') console.error('Falha na previsão:', screen.forecast.cause);
}

/** Erro conhecido -> mensagem; desconhecido -> mensagem generica E registro no console (nunca silencioso). */
function fail(error: unknown): void {
  const message = describeError(error);
  if (message === null) {
    console.error(error);
    showMessage('Ocorreu um erro inesperado. Nada foi alterado.');
  } else {
    showMessage(message);
  }
}

/**
 * Executa uma acao que muda dados. Sucesso: fecha editor/confirmacao, mostra a
 * mensagem de sucesso. Falha: mantem editor/confirmacao abertos e mostra o erro.
 */
async function act(run: () => Promise<unknown>, success: string): Promise<void> {
  if (busy) return;
  busy = true;
  showMessage(null);
  showSuccess(null);
  setBusy(true);
  try {
    await run();
    ui = { editingId: null, deletingId: null };
    showSuccess(success);
  } catch (error) {
    fail(error);
  } finally {
    busy = false;
    setBusy(false);
    refresh();
  }
}

function setUi(next: UiState): void {
  if (busy) return;
  showMessage(null);
  showSuccess(null);
  ui = next;
  refresh();
}

async function start(): Promise<void> {
  bind({
    onStart: (date) => void act(() => controller.startCycle(date), 'Ciclo iniciado.'),
    onFinish: (date) => void act(() => controller.finishCycle(date), 'Ciclo encerrado.'),
    onEdit: (id) => setUi({ editingId: id, deletingId: null }),
    onSaveEdit: (id, startDate, endDate) => {
      const changes: CycleChanges = endDate === undefined ? { startDate } : { startDate, endDate };
      void act(() => controller.updateCycle(id, changes), 'Ciclo atualizado.');
    },
    onCancelEdit: () => setUi({ editingId: null, deletingId: null }),
    onAskDelete: (id) => setUi({ editingId: null, deletingId: id }),
    onConfirmDelete: (id) => void act(() => controller.deleteCycle(id), 'Ciclo excluído.'),
    onCancelDelete: () => setUi({ editingId: null, deletingId: null }),
  });
  try {
    const problem = await controller.load();
    if (problem?.kind === 'corrupt') {
      showNotice(problem.backedUp
        ? 'Os dados salvos neste aparelho não puderam ser lidos. O histórico foi iniciado vazio e uma cópia dos dados ilegíveis foi mantida.'
        : 'Os dados salvos neste aparelho não puderam ser lidos. O histórico foi iniciado vazio.');
    } else if (problem?.kind === 'unavailable') {
      showNotice('O armazenamento deste aparelho não está disponível. Os registros não serão guardados.');
    }
  } catch (error) {
    fail(error);
  }
  refresh();
}

void start();
