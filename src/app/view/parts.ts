/** Blocos de interface reutilizados pelas telas. So exibem o que recebem; sem regra de negocio. */
import type { ForecastView } from '../../ui/forecast/index.ts';
import type { ForecastUnavailable, ProgressView } from '../screen.ts';
import type { Messages } from '../i18n/index.ts';
import { h, icon } from './dom.ts';
import type { IconName } from './dom.ts';

export function disclaimer(m: Messages): HTMLElement {
  return h('p', { class: 'hint' }, m.common.estimateNote);
}

/** Barra de progresso acessivel; a largura vem pronta do modelo da tela (0..100). */
export function progressBar(progress: ProgressView, m: Messages): HTMLElement {
  const fill = h('span', { class: 'progress-fill' });
  fill.style.width = `${progress.pct}%`;
  return h('div', { class: 'progress-wrap' },
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': progress.pct, 'aria-label': m.home.progressLabel }, fill),
    h('div', { class: 'progress-meta' },
      h('span', null, h('span', { class: 'muted' }, `${m.home.sinceLabel}: `), progress.startText),
      h('span', null, h('span', { class: 'muted' }, `${m.home.estimatedEnd}: `), progress.endText)));
}

export function forecastCard(f: ForecastView | ForecastUnavailable, full: boolean, m: Messages): HTMLElement {
  const titleId = full ? 'forecast-full-title' : 'forecast-title';
  const card = h('section', { class: 'card forecast', 'data-kind': f.kind, 'aria-labelledby': titleId });
  switch (f.kind) {
    case 'ok':
      card.append(
        h('h2', { class: 'eyebrow', id: titleId }, f.title),
        h('p', { class: 'forecast-central' }, f.centralDate),
        h('p', { class: 'forecast-window' }, f.windowLine),
      );
      if (full) for (const line of f.variabilityLines) card.append(h('p', { class: 'forecast-variability muted' }, line));
      card.append(h('p', { class: 'forecast-basis muted' }, f.basisLine));
      if (full) {
        const details = h('details', { class: 'details' }, h('summary', null, f.detailsTitle));
        const list = h('dl', { class: 'detail-list' });
        for (const row of f.details) list.append(h('div', null, h('dt', null, row.label), h('dd', null, row.value)));
        details.append(list);
        card.append(details);
      }
      break;
    case 'insufficient-data':
      card.append(
        h('h2', { class: 'eyebrow', id: titleId }, f.title),
        h('p', { class: 'forecast-message' }, f.message),
        h('p', { class: 'muted' }, f.historyLine),
        h('p', { class: 'muted' }, f.requiredLine),
      );
      break;
    case 'no-open-cycle':
      card.append(
        h('h2', { class: 'eyebrow', id: titleId }, f.title),
        h('p', { class: 'forecast-message' }, f.message),
        h('p', { class: 'muted' }, f.basisLine),
      );
      break;
    case 'unavailable':
      card.append(h('h2', { class: 'eyebrow', id: titleId }, m.forecast.heroTitle), h('p', { class: 'forecast-message' }, f.message));
      break;
  }
  card.append(disclaimer(m));
  return card;
}

export interface Choice<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: IconName;
}

/** Grupo de escolha unica (role=radiogroup). Cada opcao e um botao de pelo menos 44 px. */
export function choiceGroup<T extends string>(label: string, choices: readonly Choice<T>[], current: T, onPick: (value: T) => void, variant: 'segmented' | 'list' = 'list', disabled = false): HTMLElement {
  const group = h('div', { class: `choice-group choice-${variant}`, role: 'radiogroup', 'aria-label': label });
  for (const c of choices) {
    const selected = c.value === current;
    const b = h('button', { type: 'button', class: selected ? 'choice selected' : 'choice', role: 'radio', 'aria-checked': String(selected), disabled },
      c.icon === undefined ? null : icon(c.icon, 20),
      h('span', { class: 'choice-label' }, c.label),
      variant === 'list' ? h('span', { class: 'choice-mark', 'aria-hidden': 'true' }, selected ? icon('check', 18) : null) : null);
    b.addEventListener('click', () => { if (!selected) onPick(c.value); });
    group.append(b);
  }
  return group;
}

/** Interruptor acessivel (role=switch). */
export function switchRow(id: string, title: string, hint: string, on: boolean, onToggle: (next: boolean) => void): HTMLElement {
  const b = h('button', { type: 'button', class: on ? 'switch on' : 'switch', role: 'switch', 'aria-checked': String(on), 'aria-labelledby': `${id}-t`, 'aria-describedby': `${id}-h` },
    h('span', { class: 'switch-knob', 'aria-hidden': 'true' }));
  b.addEventListener('click', () => onToggle(!on));
  return h('div', { class: 'switch-row' },
    h('div', { class: 'switch-text' }, h('strong', { id: `${id}-t` }, title), h('span', { class: 'muted', id: `${id}-h` }, hint)),
    b);
}

/** Linha de informacao: icone, rotulo e valor. */
export function infoRow(name: IconName, label: string, value: string): HTMLElement {
  return h('div', { class: 'info-row' },
    h('span', { class: 'info-icon' }, icon(name, 20)),
    h('div', { class: 'info-text' }, h('span', { class: 'muted' }, label), h('strong', null, value)));
}

export function pageHeader(title: string, onBack: (() => void) | null, backLabel: string): HTMLElement {
  const head = h('div', { class: 'page-head' });
  if (onBack !== null) {
    const back = h('button', { type: 'button', class: 'icon-button', 'aria-label': backLabel, title: backLabel }, icon('chevronLeft', 22));
    back.addEventListener('click', onBack);
    head.append(back);
  }
  head.append(h('h2', { class: 'page-title', id: 'page-title' }, title));
  return head;
}

export function emptyState(art: HTMLElement | null, title: string, text: string, action: HTMLElement | null): HTMLElement {
  return h('section', { class: 'card empty' }, art, h('p', { class: 'empty-title' }, title), h('p', { class: 'muted' }, text), action === null ? null : h('div', { class: 'actions' }, action));
}
