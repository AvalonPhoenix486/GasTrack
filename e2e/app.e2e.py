"""E2E real no Chromium: serve www/ por HTTP e conduz a interface como um usuario.
Pre-requisito: `npm run build:web`. Usa o Playwright do Python."""
import functools, http.server, re, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

WWW = Path(__file__).resolve().parent.parent / 'www'

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve():
    handler = functools.partial(Quiet, directory=str(WWW))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f'http://127.0.0.1:{server.server_address[1]}/'

SPANS = [('2026-01-01', '2026-01-30'), ('2026-02-01', '2026-03-02'),
         ('2026-03-05', '2026-04-04'), ('2026-04-07', '2026-05-08')]
import os
SHOTS = os.environ.get('E2E_SHOTS', '/tmp/claude-0/-home-claude/f1416109-2382-52ef-9061-e40734557a7a/scratchpad/')
os.makedirs(SHOTS, exist_ok=True)
checks = []

def ok(name):
    checks.append(name); print('  ok -', name)

def new_page(browser, url, tz='America/Sao_Paulo', now=None):
    ctx = browser.new_context(timezone_id=tz, locale='pt-BR')
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    if now: page.clock.install(time=now)
    page.goto(url)
    return ctx, page, errors

def start(page, date):
    page.fill('#start-date', date); page.click('#start-button')

def finish(page, date):
    page.fill('#end-date', date); page.click('#end-button')


def forecast_view(page):
    return page.evaluate("""async () => {
      const ui = await import('/js/ui/forecast/index.js');
      const raw = JSON.parse(localStorage.getItem('gastrack.cycles'));
      return ui.presentNextChange(raw.cycles);
    }""")

def assert_forecast_matches(page):
    """A tela mostra exatamente o que presentNextChange produz para o que esta salvo."""
    view = forecast_view(page)
    card = page.locator('#forecast')
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

def main():
    server, url = serve()
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # 1. Data civil LOCAL pre-preenchida: 23:30 em Pago Pago (UTC-11) ja e dia 2 em UTC.
        ctx, page, errs = new_page(browser, url, 'Pacific/Pago_Pago', '2026-11-01T23:30:00')
        expect(page.locator('#current-status')).to_have_text('Nenhum ciclo em andamento.')
        expect(page.locator('#start-date')).to_have_value('2026-11-01')
        assert page.evaluate('new Date().toISOString().slice(0,10)') == '2026-11-02', 'premissa do teste'
        ok('data de inicio pre-preenchida e a civil local (nao a UTC)')
        ctx.close()

        # 2. Fluxo completo
        ctx, page, errs = new_page(browser, url)
        expect(page.locator('#current-status')).to_have_text('Nenhum ciclo em andamento.')
        expect(page.locator('#start-form')).to_be_visible()
        expect(page.locator('#end-form')).to_be_hidden()
        expect(page.locator('#history-empty')).to_have_text('Nenhum ciclo encerrado ainda.')
        expect(page.locator('#forecast h2')).to_have_text('Próxima mudança')
        expect(page.locator('#forecast')).to_contain_text('Histórico: 0 ciclos')
        ok('abrir: estado vazio, previsao com dados insuficientes')

        start(page, SPANS[0][0])
        expect(page.locator('#current-status')).to_have_text('Em andamento desde 1º de janeiro de 2026')
        expect(page.locator('#end-form')).to_be_visible()
        expect(page.locator('#start-form')).to_be_hidden()
        ok('iniciar ciclo: texto "Em andamento desde 1º de janeiro de 2026"')

        # erro de dominio vira mensagem; ciclo segue aberto
        finish(page, '2025-12-31')
        expect(page.locator('#message')).to_have_text('A data de encerramento não pode ser anterior à data de início.')
        expect(page.locator('#current-status')).to_have_text('Em andamento desde 1º de janeiro de 2026')
        ok('encerrar antes do inicio: mensagem compreensivel e ciclo continua aberto')

        for i, (s, e) in enumerate(SPANS):
            if i > 0: start(page, s)
            finish(page, e)
            expect(page.locator('#current-status')).to_have_text('Nenhum ciclo em andamento.')
            expect(page.locator('#message')).to_be_hidden()
            expect(page.locator('#history-list li')).to_have_count(i + 1)
            if i < 3:
                expect(page.locator('#forecast')).to_contain_text(f'Histórico: {i + 1} ciclo' + ('' if i == 0 else 's'))
                expect(page.locator('#forecast')).to_contain_text('Necessário: 4 ciclos')
        ok('4 ciclos iniciados e encerrados; historico com 4 linhas; previsao so apos o 4o')

        first = page.locator('#history-list li').first
        expect(first.locator('.history-start')).to_have_text('7 de abril de 2026')
        expect(first.locator('.history-end')).to_have_text('8 de maio de 2026')
        expect(first.locator('.history-duration')).to_have_text('31 dias')
        durations = page.locator('#history-list .history-duration').all_text_contents()
        assert durations == ['31 dias', '30 dias', '29 dias', '29 dias'], durations
        ok('historico: mais recente primeiro, datas e duracoes do dominio')

        # sem ciclo aberto, com 4 fechados
        expect(page.locator('#forecast')).to_contain_text('não existe um ciclo em andamento')
        expect(page.locator('#forecast')).to_contain_text('Baseado em 4 ciclos fechados')

        # sobreposicao
        start(page, '2026-04-20')
        expect(page.locator('#message')).to_contain_text('coincidem com outro ciclo')
        expect(page.locator('#current-status')).to_have_text('Nenhum ciclo em andamento.')
        ok('sobreposicao rejeitada com mensagem')

        start(page, '2026-05-10')
        expect(page.locator('#current-status')).to_have_text('Em andamento desde 10 de maio de 2026')
        card = page.locator('#forecast')
        expect(card.locator('h2')).to_have_text('Próxima mudança estimada')
        central = card.locator('.forecast-central').inner_text()
        assert re.fullmatch(r'\d{1,2}º? de [a-zç]+ de 2026', central), central
        expect(card.locator('.forecast-window')).to_contain_text('Janela estimada:')
        expect(card).to_contain_text('Baseado em 4 ciclos fechados')
        view = assert_forecast_matches(page)
        assert view['kind'] == 'ok'
        assert central == view['centralDate'], (central, view['centralDate'])
        print('    previsao exibida:', central, '|', view['windowLine'])
        ok('quinto ciclo iniciado: previsao aparece e coincide com presentNextChange')

        # persistencia ao recarregar
        page.reload()
        expect(page.locator('#current-status')).to_have_text('Em andamento desde 10 de maio de 2026')
        expect(page.locator('#history-list li')).to_have_count(4)
        expect(page.locator('#forecast h2')).to_have_text('Próxima mudança estimada')
        ok('recarregar: ciclos, ids e previsao persistem')

        # ---- EDITAR ----
        before = forecast_view(page)
        page.get_by_role('button', name='Editar ciclo de 1º de fevereiro de 2026 a 2 de março de 2026').click()
        expect(page.get_by_label('Início', exact=True)).to_be_focused()
        # invalido: fim antes do inicio; o editor continua aberto
        page.get_by_label('Fim', exact=True).fill('2026-01-15'); page.get_by_role('button', name='Salvar').click()
        expect(page.locator('#message')).to_have_text('A data de encerramento não pode ser anterior à data de início.')
        expect(page.get_by_label('Fim', exact=True)).to_be_visible()
        # sobreposicao com o ciclo seguinte
        page.get_by_label('Fim', exact=True).fill('2026-03-10'); page.get_by_role('button', name='Salvar').click()
        expect(page.locator('#message')).to_contain_text('coincidem com outro ciclo')
        assert page.locator('#history-list li').count() == 4
        # valido: 2026-03-03 (30 dias)
        page.get_by_label('Fim', exact=True).fill('2026-03-03'); page.get_by_role('button', name='Salvar').click()
        expect(page.locator('#success')).to_have_text('Ciclo atualizado.')
        expect(page.locator('#message')).to_be_hidden()
        edited = row(page, '1º de fevereiro de 2026')
        expect(edited.locator('.history-end')).to_have_text('3 de março de 2026')
        expect(edited.locator('.history-duration')).to_have_text('30 dias')
        assert page.locator('#history-list .history-duration').all_text_contents() == ['31 dias', '30 dias', '30 dias', '29 dias']
        after = assert_forecast_matches(page)
        assert after != before, 'a previsao deveria mudar apos a edicao'
        print('    previsao apos editar:', after['centralDate'], '|', after['windowLine'])
        # cancelar edicao nao altera
        page.get_by_role('button', name='Editar ciclo de 1º de janeiro de 2026 a 30 de janeiro de 2026').click()
        page.get_by_label('Fim', exact=True).fill('2026-01-25')
        page.get_by_role('button', name='Cancelar').click()
        expect(row(page, '1º de janeiro de 2026').locator('.history-end')).to_have_text('30 de janeiro de 2026')
        ok('editar ciclo encerrado: erros, sobreposicao, edicao valida, cancelar; historico e previsao corretos')

        # editar o ciclo aberto
        page.get_by_role('button', name='Editar ciclo em andamento desde 10 de maio de 2026').click()
        page.get_by_label('Início', exact=True).fill('2026-05-11'); page.get_by_role('button', name='Salvar').click()
        expect(page.locator('#current-status')).to_have_text('Em andamento desde 11 de maio de 2026')
        assert_forecast_matches(page)
        ok('editar ciclo aberto: texto e previsao atualizados')

        # ---- EXCLUIR ----
        page.get_by_role('button', name='Excluir ciclo de 1º de janeiro de 2026 a 30 de janeiro de 2026').click()
        expect(page.get_by_text('Excluir este ciclo?')).to_be_visible()
        expect(page.get_by_role('button', name='Cancelar')).to_be_focused()
        page.get_by_role('button', name='Cancelar').click()
        expect(page.locator('#history-list li')).to_have_count(4)
        expect(page.get_by_text('Excluir este ciclo?')).to_have_count(0)
        ok('cancelar exclusao nao altera nada')

        page.get_by_role('button', name='Excluir ciclo de 1º de janeiro de 2026 a 30 de janeiro de 2026').click()
        page.get_by_role('button', name='Confirmar exclusão').click()
        expect(page.locator('#success')).to_have_text('Ciclo excluído.')
        expect(page.locator('#history-list li')).to_have_count(3)
        expect(page.locator('#history-list')).not_to_contain_text('1º de janeiro de 2026')
        view = assert_forecast_matches(page)
        assert view['kind'] == 'insufficient-data'
        expect(page.locator('#forecast')).to_contain_text('Histórico: 3 ciclos')
        ok('excluir ciclo encerrado: removido; previsao volta a dados insuficientes')

        page.reload()
        expect(page.locator('#history-list li')).to_have_count(3)
        expect(page.locator('#history-list')).not_to_contain_text('1º de janeiro de 2026')
        expect(row(page, '1º de fevereiro de 2026').locator('.history-end')).to_have_text('3 de março de 2026')
        expect(page.locator('#current-status')).to_have_text('Em andamento desde 11 de maio de 2026')
        assert_forecast_matches(page)
        ok('recarregar apos editar e excluir: tudo persiste')

        # excluir o ciclo aberto
        page.get_by_role('button', name='Excluir ciclo em andamento desde 11 de maio de 2026').click()
        expect(page.get_by_text('Excluir o ciclo em andamento?')).to_be_visible()
        page.get_by_role('button', name='Confirmar exclusão').click()
        expect(page.locator('#current-status')).to_have_text('Nenhum ciclo em andamento.')
        expect(page.locator('#start-form')).to_be_visible()
        expect(page.locator('#end-form')).to_be_hidden()
        expect(page.locator('#open-actions button')).to_have_count(0)
        assert_forecast_matches(page)
        page.reload()
        expect(page.locator('#current-status')).to_have_text('Nenhum ciclo em andamento.')
        expect(page.locator('#history-list li')).to_have_count(3)
        ok('excluir ciclo aberto: estado limpo e persistido')
        assert not errs, errs
        ctx.close()

        # 3. Armazenamento corrompido nao derruba o app
        for raw in ['{quebrado', '{"version":1,"cycles":[{"id":"x","startDate":"2026-02-30","endDate":null}]}']:
            ctx, page, errs = new_page(browser, url)
            page.evaluate('r => localStorage.setItem("gastrack.cycles", r)', raw)
            page.reload()
            expect(page.locator('#notice')).to_contain_text('não puderam ser lidos')
            expect(page.locator('#current-status')).to_have_text('Nenhum ciclo em andamento.')
            start(page, '2026-06-01')
            expect(page.locator('#current-status')).to_have_text('Em andamento desde 1º de junho de 2026')
            assert page.evaluate('localStorage.getItem("gastrack.cycles.corrupt")') == raw
            assert not errs, errs
            ctx.close()
        ok('armazenamento corrompido: aviso, app funcional e copia preservada')


        # 4. Viewport pequena (360x640): sem rolagem horizontal; alvos de toque >= 44px
        ctx = browser.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, locale='pt-BR', timezone_id='America/Sao_Paulo')
        page = ctx.new_page()
        page.goto(url)
        for s_, e_ in SPANS:
            start(page, s_); finish(page, e_)
        start(page, '2026-05-10')
        assert no_overflow(page), 'overflow horizontal (estado normal)'
        page.screenshot(path=SHOTS + 'mobile-normal.png', full_page=True)
        page.get_by_role('button', name='Editar ciclo de 1º de fevereiro de 2026 a 2 de março de 2026').click()
        assert no_overflow(page), 'overflow horizontal (editor)'
        page.screenshot(path=SHOTS + 'mobile-editando.png', full_page=True)
        page.get_by_role('button', name='Cancelar').click()
        page.get_by_role('button', name='Excluir ciclo de 1º de janeiro de 2026 a 30 de janeiro de 2026').click()
        assert no_overflow(page), 'overflow horizontal (confirmacao)'
        page.screenshot(path=SHOTS + 'mobile-excluindo.png', full_page=True)
        small = page.evaluate("[...document.querySelectorAll('button, input')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).map(e => e.textContent || e.id)")
        assert not small, f'alvos de toque pequenos: {small}'
        ok('viewport 360x640: sem overflow horizontal e alvos de toque >= 44px')
        ctx.close()

        browser.close()
    server.shutdown()
    print(f'E2E OK: {len(checks)} verificacoes')

try:
    main()
except Exception as e:
    print('E2E FALHOU:', e); sys.exit(1)
