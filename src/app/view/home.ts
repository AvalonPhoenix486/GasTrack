/** Tela Início: ciclo atual, progresso, proxima troca, indicadores e ultimos ciclos. */
import type { Screen } from '../screen.ts';
import { cylinderArt } from './brand.ts';
import type { ViewContext } from './context.ts';
import { button, h, icon } from './dom.ts';
import type { IconName } from './dom.ts';
import { emptyState, progressBar } from './parts.ts';

const KPI_ICONS: Record<string, IconName> = { closed: 'checkCircle', median: 'stats', mean: 'calendar' };

function openHero(ctx: ViewContext, screen: Screen): HTMLElement {
  const { m, handlers } = ctx;
  const open = screen.openCycle;
  if (open === null) throw new Error('openHero sem ciclo aberto');
  const label = m.history.openRow(open.startText);
  return h('section', { class: 'card hero', 'aria-labelledby': 'hero-title' },
    h('h2', { class: 'eyebrow with-icon', id: 'hero-title' }, icon('home', 18), m.home.currentCycle),
    h('div', { class: 'hero-body' },
      h('div', { class: 'hero-main' },
        open.daysValue === null
          ? h('p', { class: 'hero-note' }, open.note ?? '')
          : h('p', { class: 'hero-days' }, h('span', { class: 'hero-number' }, open.daysValue), ' ', h('span', { class: 'hero-unit' }, open.daysUnit)),
        h('p', { class: 'hero-since' }, screen.currentText)),
      cylinderArt('cylinder-art hero-art')),
    screen.progress === null ? h('p', { class: 'hint' }, m.home.progressUnavailable) : progressBar(screen.progress, m),
    h('div', { class: 'actions hero-actions' },
      button(m.home.finishCycle, 'ghost', () => handlers.onOpenSheet({ kind: 'finish' })),
      button(m.home.editStart, 'ghost', () => handlers.onOpenSheet({ kind: 'edit', id: open.id }), m.history.editAria(label)),
      button(m.common.delete, 'ghost danger-text', () => handlers.onOpenSheet({ kind: 'delete', id: open.id }), m.history.deleteAria(label))));
}

function emptyHero(ctx: ViewContext): HTMLElement {
  const { m, handlers } = ctx;
  return h('section', { class: 'card hero hero-empty', 'aria-labelledby': 'hero-title' },
    cylinderArt('cylinder-art hero-art'),
    h('h2', { class: 'eyebrow with-icon', id: 'hero-title' }, icon('home', 18), m.home.currentCycle),
    h('p', { class: 'empty-title' }, m.home.emptyTitle),
    h('p', { class: 'muted' }, m.home.emptyText),
    h('div', { class: 'actions' }, button(m.home.startCycle, 'primary', () => handlers.onOpenSheet({ kind: 'start' }))));
}

export function homeView(ctx: ViewContext, screen: Screen): HTMLElement {
  const { m, handlers } = ctx;
  const root = h('div', { class: 'view' });
  if (screen.alert !== null) {
    root.append(h('section', { class: 'alert-card', role: 'status' }, icon('bell', 22),
      h('div', null, h('strong', null, screen.alert.title), h('p', null, screen.alert.text))));
  }
  root.append(screen.openCycle === null ? emptyHero(ctx) : openHero(ctx, screen));

  const tone = screen.forecastPage.tone === 'attention' ? ' attention' : '';
  const next = h('button', { type: 'button', class: `next-row${tone}`, 'data-kind': screen.next.kind },
    h('span', { class: 'next-icon' }, icon('calendar', 24)),
    h('span', { class: 'next-text' }, h('strong', null, screen.next.title), h('span', { class: 'muted' }, screen.next.subtitle)),
    icon('chevronRight', 20));
  next.addEventListener('click', () => handlers.onTab('forecast'));
  root.append(next);

  const kpis = h('div', { class: 'kpis' });
  for (const k of screen.kpis) {
    kpis.append(h('div', { class: `kpi kpi-${k.id}` }, h('span', { class: 'kpi-icon' }, icon(KPI_ICONS[k.id] ?? 'stats', 22)), h('strong', null, k.value), h('span', { class: 'muted' }, k.label)));
  }
  root.append(kpis);

  if (screen.openCycle !== null) {
    root.append(button(m.home.registerChange, 'cta', () => handlers.onOpenSheet({ kind: 'change' })));
    const cta = root.lastElementChild;
    if (cta instanceof HTMLElement) cta.prepend(icon('play', 18));
  }

  const recent = h('section', { class: 'card', 'aria-labelledby': 'recent-title' }, h('h2', { class: 'section-title', id: 'recent-title' }, m.home.recent));
  if (screen.historyRows.length === 0) {
    recent.append(h('p', { class: 'muted' }, m.home.noRecent));
  } else {
    const list = h('ul', { class: 'recent-list' });
    for (const row of screen.historyRows.slice(0, 3)) {
      list.append(h('li', null,
        h('span', { class: 'check-badge' }, icon('check', 14)),
        h('span', { class: 'recent-dates' }, `${row.startText} → ${row.endText}`),
        h('strong', { class: 'plus-days' }, m.history.plusDays(row.durationText))));
    }
    recent.append(list, button(m.home.seeHistory, 'link', () => handlers.onTab('history')));
  }
  root.append(recent);
  return root;
}
