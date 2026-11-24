"""E2E real no Chromium: serve www/ por HTTP e conduz a interface como um usuario.
Pre-requisito: `npm run build:web`. Usa o Playwright do Python."""
import functools, http.server, os, re, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

WWW = Path(__file__).resolve().parent.parent / 'www'
SHOTS = os.environ.get('E2E_SHOTS', '')
if SHOTS:
    os.makedirs(SHOTS, exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve():
    handler = functools.partial(Quiet, directory=str(WWW))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f'http://127.0.0.1:{server.server_address[1]}/'

SPANS = [('2026-01-01', '2026-01-30'), ('2026-02-01', '2026-03-02'),
         ('2026-03-05', '2026-04-04'), ('2026-04-07', '2026-05-08')]
NOW = '2026-11-23T10:00:00'
checks = []

def ok(name):
    checks.append(name); print('  ok -', name)

def new_page(browser, url, tz='America/Sao_Paulo', now=NOW, viewport=None):
    kw = {'viewport': viewport, 'device_scale_factor': 2} if viewport else {}
    ctx = browser.new_context(timezone_id=tz, locale='pt-BR', **kw)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    if now: page.clock.install(time=now)
    page.goto(url)
    return ctx, page, errors

def tab(page, name):
    page.get_by_role('button', name=name, exact=True).click()

def dialog(page):
    return page.get_by_role('dialog')

def start(page, date):
    tab(page, 'Início')
    page.get_by_role('button', name='Iniciar ciclo').click()
    dialog(page).locator('#sheet-date').fill(date)
    dialog(page).get_by_role('button', name='Iniciar ciclo').click()

def finish(page, date):
    tab(page, 'Início')
    page.get_by_role('button', name='Encerrar ciclo').click()
    dialog(page).locator('#sheet-date').fill(date)
    dialog(page).get_by_role('button', name='Encerrar ciclo').click()

def toast(page, text):
    expect(page.locator('#toast')).to_have_text(text)

def forecast_view(page):
    return page.evaluate("""async () => {
      const ui = await import('/js/ui/forecast/index.js');
      const raw = JSON.parse(localStorage.getItem('gastrack.cycles'));
      return ui.presentNextChange(raw.cycles);
    }""")

def assert_forecast_matches(page):
    """A tela mostra exatamente o que presentNextChange produz para o que esta salvo."""
    view = forecast_view(page)
    card = page.locator('.forecast')
    expect(card.locator('h2')).to_have_text(view['title'])
    if view['kind'] == 'ok':
        expect(card.locator('.forecast-central')).to_have_text(view['centralDate'])
        expect(card.locator('.forecast-window')).to_have_text(view['windowLine'])
    else:
        expect(card.locator('.forecast-message')).to_have_text(view['message'])
    return view

def row(page, label):
    return page.locator('#history-list li').filter(has_text=label)

def no_overflow(page):
    return page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth')

def small_targets(page):
    return page.evaluate("[...document.querySelectorAll('button, input, select')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).map(e => e.textContent || e.id)")

def main():
    server, url = serve()
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # 1. Data civil LOCAL pre-preenchida: 23:30 em Pago Pago (UTC-11) ja e dia 2 em UTC.
        ctx, page, errs = new_page(browser, url, 'Pacific/Pago_Pago', '2026-11-01T23:30:00')
        page.get_by_role('button', name='Iniciar ciclo').click()
        expect(dialog(page).locator('#sheet-date')).to_have_value('2026-11-01')
        assert page.evaluate('new Date().toISOString().slice(0,10)') == '2026-11-02', 'premissa do teste'
        ok('data de inicio pre-preenchida e a civil local (nao a UTC)')
        ctx.close()

        # 2. Estado vazio
        ctx, page, errs = new_page(browser, url)
        expect(page.locator('.hero-empty-text')).to_have_text('Nenhum ciclo em andamento.')
        expect(page.locator('.forecast h2')).to_have_text('Próxima mudança')
        expect(page.locator('.forecast')).to_contain_text('Histórico: 0 ciclos')
        expect(page.locator('.forecast')).to_contain_text('A previsão é uma estimativa estatística, não uma garantia.')
        tab(page, 'Histórico'); expect(page.locator('.empty')).to_contain_text('Nenhum ciclo encerrado ainda.')
        tab(page, 'Estatísticas'); expect(page.locator('.empty')).to_contain_text('As estatísticas aparecem depois')
        tab(page, 'Previsão'); expect(page.locator('.forecast-message')).to_be_visible()
        ok('estado vazio em todas as abas, previsao com dados insuficientes')

        # 3. Painel: cancelar, Esc, foco
        tab(page, 'Início')
        opener = page.get_by_role('button', name='Iniciar ciclo')
        opener.click()
        expect(dialog(page)).to_be_visible()
        expect(dialog(page).locator('#sheet-date')).to_be_focused()
        page.keyboard.press('Escape')
        expect(dialog(page)).to_have_count(0)
        opener.click(); dialog(page).get_by_role('button', name='Cancelar').click()
        expect(dialog(page)).to_have_count(0)
        expect(page.locator('.hero-empty-text')).to_be_visible()
        ok('painel: foco no campo, Esc e Cancelar fecham sem alterar')

        # 4. Iniciar ciclo e herói com dias dinâmicos
        start(page, '2026-10-05')
        toast(page, 'Ciclo iniciado.')
        expect(page.locator('.hero-number')).to_have_text('49')
        expect(page.locator('.hero-unit')).to_have_text('dias')
        expect(page.locator('.hero-since')).to_have_text('Em andamento desde5 de outubro de 2026')
        # o dia virou: ao voltar ao app o numero e recalculado
        page.clock.set_system_time('2026-11-24T10:00:00')
        page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
        expect(page.locator('.hero-number')).to_have_text('50')
        ok('ciclo iniciado: heroi "49 dias" calculado de hoje e do inicio; recalcula ao voltar ao app')
        page.clock.set_system_time(NOW)
        page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")

        # erro de dominio: painel continua aberto com a mensagem e o valor digitado
        page.get_by_role('button', name='Encerrar ciclo').click()
        dialog(page).locator('#sheet-date').fill('2026-10-01')
        dialog(page).get_by_role('button', name='Encerrar ciclo').click()
        expect(dialog(page).locator('#sheet-error')).to_have_text('A data de encerramento não pode ser anterior à data de início.')
        expect(dialog(page).locator('#sheet-date')).to_have_value('2026-10-01')
        expect(page.locator('.hero-number')).to_have_text('49')
        ok('encerrar antes do inicio: erro dentro do painel, valor preservado, ciclo continua aberto')
        dialog(page).get_by_role('button', name='Cancelar').click()

        # corrige o inicio para o primeiro ciclo da serie: edita o aberto
        page.get_by_role('button', name='Editar ciclo em andamento desde 5 de outubro de 2026').click()
        dialog(page).get_by_label('Início', exact=True).fill(SPANS[0][0])
        dialog(page).get_by_role('button', name='Salvar').click()
        toast(page, 'Ciclo atualizado.')
        expect(page.locator('.hero-since')).to_contain_text('1º de janeiro de 2026')

        # 5. Quatro ciclos fechados + quinto aberto
        for i, (s, e) in enumerate(SPANS):
            if i > 0: start(page, s)
            finish(page, e)
            toast(page, 'Ciclo encerrado.')
            expect(page.locator('.hero-empty-text')).to_have_text('Nenhum ciclo em andamento.')
            if i < 3:
                expect(page.locator('.forecast')).to_contain_text('Histórico: %d ciclo' % (i + 1) + ('' if i == 0 else 's'))
                expect(page.locator('.forecast')).to_contain_text('Necessário: 4 ciclos')
        expect(page.locator('.forecast-message')).to_contain_text('não existe um ciclo em andamento')
        expect(page.locator('.forecast')).to_contain_text('Baseado em 4 ciclos fechados')
        ok('4 ciclos iniciados e encerrados; previsao so apos o 4o')

        start(page, '2026-05-10')
        expect(page.locator('.hero-number')).to_have_text('197')
        view = assert_forecast_matches(page)
        assert view['kind'] == 'ok'
        print('    previsao exibida:', view['centralDate'], '|', view['windowLine'])
        expect(page.locator('.kpi').first).to_contain_text('29,5 dias')
        ok('quinto ciclo: heroi "197 dias", previsao aparece e coincide com presentNextChange, indicadores')

        # 6. Abas: previsão completa e estatísticas
        tab(page, 'Previsão')
        full = assert_forecast_matches(page)
        expect(page.locator('.forecast .detail-list')).to_contain_text('Mediana')
        expect(page.locator('.forecast .detail-list')).to_contain_text(full['details'][0]['value'])
        tab(page, 'Estatísticas')
        expect(page.locator('.stat').filter(has_text='Mediana').locator('dd')).to_have_text('29,5 dias')
        expect(page.locator('.stat').filter(has_text='Média').locator('dd')).to_have_text('29,75 dias')
        expect(page.locator('.stat').filter(has_text='Mais longo').locator('dd')).to_have_text('31 dias')
        assert page.locator('.bar-row').count() == 4
        assert page.locator('.bar-row .bar-value').all_text_contents() == ['29 dias', '29 dias', '30 dias', '31 dias']
        ok('previsao completa com detalhes; estatisticas e grafico de barras corretos')

        # 7. Histórico: ordenação, edição, exclusão
        tab(page, 'Histórico')
        assert page.locator('#history-list .history-duration').all_text_contents() == ['31 dias', '30 dias', '29 dias', '29 dias']
        page.locator('#sort-select').select_option('shortest')
        assert page.locator('#history-list .history-duration').all_text_contents() == ['29 dias', '29 dias', '30 dias', '31 dias']
        page.locator('#sort-select').select_option('recent')
        expect(page.locator('.card-open')).to_contain_text('Desde 10 de maio de 2026')
        first = page.locator('#history-list li').first
        expect(first.locator('.history-start')).to_have_text('7 de abril de 2026')
        expect(first.locator('.history-end')).to_have_text('8 de maio de 2026')
        ok('historico: ordem, ordenacao por duracao, ciclo em andamento destacado')

        before = forecast_view(page)
        page.get_by_role('button', name='Editar ciclo de 1º de fevereiro de 2026 a 2 de março de 2026').click()
        expect(dialog(page).get_by_label('Início', exact=True)).to_be_focused()
        dialog(page).get_by_label('Fim', exact=True).fill('2026-01-15'); dialog(page).get_by_role('button', name='Salvar').click()
        expect(dialog(page).locator('#sheet-error')).to_have_text('A data de encerramento não pode ser anterior à data de início.')
        dialog(page).get_by_label('Fim', exact=True).fill('2026-03-10'); dialog(page).get_by_role('button', name='Salvar').click()
        expect(dialog(page).locator('#sheet-error')).to_contain_text('coincidem com outro ciclo')
        dialog(page).get_by_label('Fim', exact=True).fill('2026-03-03'); dialog(page).get_by_role('button', name='Salvar').click()
        toast(page, 'Ciclo atualizado.')
        expect(dialog(page)).to_have_count(0)
        edited = row(page, '1º de fevereiro de 2026')
        expect(edited.locator('.history-end')).to_have_text('3 de março de 2026')
        expect(edited.locator('.history-duration')).to_have_text('30 dias')
        tab(page, 'Previsão'); after = assert_forecast_matches(page)
        assert after != before, 'a previsao deveria mudar apos a edicao'
        print('    previsao apos editar:', after['centralDate'], '|', after['windowLine'])
        ok('editar ciclo: erro de data, erro de sobreposicao, edicao valida; historico e previsao corretos')

        tab(page, 'Histórico')
        page.get_by_role('button', name='Excluir ciclo de 1º de janeiro de 2026 a 30 de janeiro de 2026').click()
        expect(dialog(page)).to_contain_text('Excluir o ciclo de 1º de janeiro de 2026 a 30 de janeiro de 2026?')
        expect(dialog(page).get_by_role('button', name='Cancelar')).to_be_focused()
        dialog(page).get_by_role('button', name='Cancelar').click()
        expect(page.locator('#history-list li')).to_have_count(4)
        page.get_by_role('button', name='Excluir ciclo de 1º de janeiro de 2026 a 30 de janeiro de 2026').click()
        dialog(page).get_by_role('button', name='Confirmar exclusão').click()
        toast(page, 'Ciclo excluído.')
        expect(page.locator('#history-list li')).to_have_count(3)
        expect(page.locator('#history-list')).not_to_contain_text('1º de janeiro de 2026')
        tab(page, 'Previsão'); view = assert_forecast_matches(page)
        assert view['kind'] == 'insufficient-data'
        expect(page.locator('.forecast')).to_contain_text('Histórico: 3 ciclos')
        tab(page, 'Estatísticas'); assert page.locator('.bar-row').count() == 3
        expect(page.locator('.chart-legend, .banner-info')).to_have_count(2)
        ok('excluir: cancelar nao altera; confirmar remove; previsao e estatisticas atualizam')

        # 8. Persistência após recarregar
        page.reload()
        tab(page, 'Histórico')
        expect(page.locator('#history-list li')).to_have_count(3)
        expect(row(page, '1º de fevereiro de 2026').locator('.history-end')).to_have_text('3 de março de 2026')
        tab(page, 'Início'); expect(page.locator('.hero-number')).to_have_text('197')
        assert_forecast_matches(page)
        ok('recarregar: ciclos editados/excluidos e ciclo aberto persistem')

        # 9. Excluir o ciclo aberto
        tab(page, 'Início')
        page.get_by_role('button', name='Excluir ciclo em andamento desde 10 de maio de 2026').click()
        expect(dialog(page)).to_contain_text('Excluir o ciclo em andamento desde 10 de maio de 2026?')
        dialog(page).get_by_role('button', name='Confirmar exclusão').click()
        toast(page, 'Ciclo excluído.')
        expect(page.locator('.hero-empty-text')).to_have_text('Nenhum ciclo em andamento.')
        assert_forecast_matches(page)
        page.reload()
        expect(page.locator('.hero-empty-text')).to_have_text('Nenhum ciclo em andamento.')
        ok('excluir ciclo aberto: estado limpo e persistido')

        # 10. Tema
        assert page.evaluate("document.documentElement.dataset.theme") is None
        page.get_by_role('button', name=re.compile('^Tema:')).click(); toast(page, 'Tema: Claro')
        assert page.evaluate("document.documentElement.dataset.theme") == 'light'
        page.get_by_role('button', name=re.compile('^Tema:')).click(); toast(page, 'Tema: Escuro')
        page.reload()
        assert page.evaluate("document.documentElement.dataset.theme") == 'dark'
        page.get_by_role('button', name=re.compile('^Tema:')).click()
        assert page.evaluate("document.documentElement.dataset.theme") is None
        ok('tema: claro/escuro/automatico alternam e persistem')
        assert not errs, errs
        ctx.close()

        # 11. Armazenamento corrompido nao derruba o app
        for raw in ['{quebrado', '{"version":1,"cycles":[{"id":"x","startDate":"2026-02-30","endDate":null}]}']:
            ctx, page, errs = new_page(browser, url)
            page.evaluate('r => localStorage.setItem("gastrack.cycles", r)', raw)
            page.reload()
            expect(page.locator('#notice')).to_contain_text('não puderam ser lidos')
            expect(page.locator('.hero-empty-text')).to_have_text('Nenhum ciclo em andamento.')
            start(page, '2026-06-01')
            toast(page, 'Ciclo iniciado.')
            assert page.evaluate('localStorage.getItem("gastrack.cycles.corrupt")') == raw
            assert not errs, errs
            ctx.close()
        ok('armazenamento corrompido: aviso, app funcional e copia preservada')

        # 12. Viewport pequena (360x640), todas as abas e painéis
        ctx, page, errs = new_page(browser, url, viewport={'width': 360, 'height': 640})
        for s_, e_ in SPANS:
            start(page, s_); finish(page, e_)
        start(page, '2026-10-05')
        for t in ['Início', 'Histórico', 'Estatísticas', 'Previsão']:
            tab(page, t)
            assert no_overflow(page), f'overflow horizontal na aba {t}'
            assert not small_targets(page), f'alvos pequenos em {t}: {small_targets(page)}'
            if SHOTS: page.screenshot(path=f'{SHOTS}/mobile-{t}.png')
        tab(page, 'Histórico')
        page.get_by_role('button', name='Editar ciclo de 1º de fevereiro de 2026 a 2 de março de 2026').click()
        assert no_overflow(page), 'overflow no painel'
        assert not small_targets(page), f'alvos pequenos no painel: {small_targets(page)}'
        page.wait_for_timeout(350)  # fim da animacao de entrada
        box = dialog(page).bounding_box(); assert box['y'] + box['height'] <= 641 and box['x'] >= 0 and box['x'] + box['width'] <= 360, box
        if SHOTS: page.screenshot(path=f'{SHOTS}/mobile-painel.png')
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Excluir ciclo de 1º de fevereiro de 2026 a 2 de março de 2026').click()
        assert no_overflow(page), 'overflow na confirmacao'
        assert not small_targets(page), f'alvos pequenos na confirmacao: {small_targets(page)}'
        assert not errs, errs
        ok('viewport 360x640: abas e paineis sem overflow horizontal, alvos de toque >= 44px, sem erros no console')
        ctx.close()

        browser.close()
    server.shutdown()
    print(f'E2E OK: {len(checks)} verificacoes')

try:
    main()
except Exception as e:
    print('E2E FALHOU:', e); sys.exit(1)
