/** Ponto de entrada no navegador: liga repositorio, controlador, preferencias e tela. */
import type { CycleChanges } from '../core/domain/cycles/index.ts';
import { GasTrackController } from './controller.ts';
import { LocalStorageCycleRepository } from './localStorageRepository.ts';
import { localCivilDate } from './localDate.ts';
import { describeError } from './messages.ts';
import { ThemeStore, THEME_LABELS, nextTheme } from './preferences.ts';
import { bind, focusView, onBecameVisible, render, setBusy, showError, showNotice, showToast } from './render.ts';
import type { Sheet, UiState } from './render.ts';
import { buildScreen } from './screen.ts';

const controller = new GasTrackController(
  new LocalStorageCycleRepository(() => window.localStorage),
  () => crypto.randomUUID(),
);
const themeStore = new ThemeStore(() => window.localStorage);

let ui: UiState = { tab: 'home', sheet: null, sort: 'recent', theme: themeStore.load() };
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
    showError('Ocorreu um erro inesperado. Nada foi alterado.');
  } else {
    showError(message);
  }
}

/**
 * Executa uma acao que muda dados. Sucesso: fecha o painel e mostra um aviso curto.
 * Falha: o painel continua aberto, com o erro e o que o usuario digitou.
 */
async function act(run: () => Promise<unknown>, success: string): Promise<void> {
  if (busy) return;
  busy = true;
  showError(null);
  setBusy(true);
  let done = false;
  try {
    await run();
    ui = { ...ui, sheet: null };
    done = true;
  } catch (error) {
    fail(error);
  } finally {
    busy = false;
    refresh();
    setBusy(false);
  }
  if (done) showToast(success);
}

function openSheet(sheet: Exclude<Sheet, null>): void {
  if (busy) return;
  ui = { ...ui, sheet };
  refresh();
}

async function start(): Promise<void> {
  bind({
    onTab: (tab) => { if (busy) return; ui = { ...ui, tab, sheet: null }; refresh(); focusView(); },
    onOpenSheet: openSheet,
    onCloseSheet: () => { if (busy) return; ui = { ...ui, sheet: null }; refresh(); },
    onStart: (date) => void act(() => controller.startCycle(date), 'Ciclo iniciado.'),
    onFinish: (date) => void act(() => controller.finishCycle(date), 'Ciclo encerrado.'),
    onSaveEdit: (id, startDate, endDate) => {
      const changes: CycleChanges = endDate === undefined ? { startDate } : { startDate, endDate };
      void act(() => controller.updateCycle(id, changes), 'Ciclo atualizado.');
    },
    onConfirmDelete: (id) => void act(() => controller.deleteCycle(id), 'Ciclo excluído.'),
    onSort: (sort) => { ui = { ...ui, sort }; refresh(); },
    onTheme: () => {
      const theme = nextTheme(ui.theme);
      ui = { ...ui, theme };
      refresh();
      if (themeStore.save(theme)) showToast(`Tema: ${THEME_LABELS[theme]}`);
      else showToast('Não foi possível salvar a preferência de tema.', 'error');
    },
  });
  // Ao voltar ao app (ex.: WebView retomado no dia seguinte), recalcula "hoje" e os dias.
  onBecameVisible(() => { if (!busy) refresh(); });

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
    console.error(error);
    showNotice('Não foi possível carregar os dados salvos.');
  }
  refresh();
}

void start();
