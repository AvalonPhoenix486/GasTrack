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

def new_page(browser, url, tz='America/Sao_Paulo', now=NOW, viewport=None, locale='pt-BR', motion='reduce', scheme=None):
    # motion='reduce' (padrao dos testes): sem animacoes nem abertura; o teste da abertura usa 'no-preference'.
    kw = {'viewport': viewport, 'device_scale_factor': 2} if viewport else {}
    if scheme: kw['color_scheme'] = scheme
    ctx = browser.new_context(timezone_id=tz, locale=locale, reduced_motion=motion, permissions=['clipboard-read', 'clipboard-write'], **kw)
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
    return page.evaluate("""[...document.querySelectorAll('button, input, select')].filter(e => {
      if (!e.offsetParent || e.classList.contains('visually-hidden')) return false;
      const target = e.type === 'checkbox' ? e.closest('label') : e;   // a caixa e tocada pelo rotulo inteiro
      return target.getBoundingClientRect().height < 44;
    }).map(e => e.textContent || e.id)""")

def expand(page, label):
    """Abre os detalhes de uma linha do historico (pelo trecho do rotulo)."""
    page.get_by_role('button', name=re.compile('^Mostrar detalhes do ciclo de ' + re.escape(label))).click()

def menu_row(page, name):
    return page.locator('.menu-row').filter(has=page.locator('strong', has_text=re.compile('^' + re.escape(name) + '$')))

def settings(page, name=None, tab_name='Configurações'):
    tab(page, tab_name)
    if name: menu_row(page, name).click()

def seed(page, cycles):
    page.evaluate('c => localStorage.setItem("gastrack.cycles", JSON.stringify({version: 1, cycles: c}))', cycles)
    page.reload()

def closed(durations, start='2026-01-01', gap=1):
    out, cur = [], start
    for i, d in enumerate(durations):
        end = page_add(cur, d)
        out.append({'id': f'c{i}', 'startDate': cur, 'endDate': end})
        cur = page_add(end, gap)
    return out

def page_add(date, days):
    import datetime
    return (datetime.date.fromisoformat(date) + datetime.timedelta(days=days)).isoformat()

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

        # 2. Estado vazio em todas as abas
        ctx, page, errs = new_page(browser, url)
        expect(page.locator('.hero-empty .empty-title')).to_have_text('Nenhum ciclo em andamento.')
        expect(page.locator('.next-row')).to_contain_text('Previsão ainda indisponível')
        expect(page.locator('.kpis')).to_be_visible()
        tab(page, 'Histórico'); expect(page.locator('.empty')).to_contain_text('Nenhum ciclo encerrado ainda.')
        tab(page, 'Estatísticas'); expect(page.locator('.empty')).to_contain_text('As estatísticas aparecem depois')
        tab(page, 'Previsão')
        expect(page.locator('.forecast h2')).to_have_text('Próxima mudança')
        expect(page.locator('.forecast')).to_contain_text('Histórico: 0 ciclos')
        expect(page.locator('.forecast')).to_contain_text('A previsão é uma estimativa estatística, não uma garantia.')
        expect(page.locator('.forecast-hero')).to_have_count(0)  # nenhuma data inventada
        expect(page.locator('[role=progressbar]')).to_have_count(1)  # progresso de coleta: 0 de 4
        tab(page, 'Configurações'); expect(page.locator('.menu-row')).to_have_count(7)
        ok('estado vazio em todas as abas, previsao com dados insuficientes e sem data')

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
        expect(page.locator('.hero-empty .empty-title')).to_be_visible()
        ok('painel: foco no campo, Esc e Cancelar fecham sem alterar')

        # 4. Iniciar ciclo e heroi com dias dinamicos
        start(page, '2026-10-05')
        toast(page, 'Ciclo iniciado.')
        expect(page.locator('.hero-number')).to_have_text('49')
        expect(page.locator('.hero-unit')).to_have_text('dias')
        expect(page.locator('.hero-since')).to_have_text('Em andamento desde 5 de outubro de 2026')
        page.clock.set_system_time('2026-11-24T10:00:00')
        page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
        expect(page.locator('.hero-number')).to_have_text('50')
        ok('ciclo iniciado: heroi "49 dias" calculado de hoje e do inicio; recalcula ao voltar ao app')
        page.clock.set_system_time(NOW)
        page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")

        page.get_by_role('button', name='Encerrar ciclo').click()
        dialog(page).locator('#sheet-date').fill('2026-10-01')
        dialog(page).get_by_role('button', name='Encerrar ciclo').click()
        expect(dialog(page).locator('#sheet-error')).to_have_text('A data de encerramento não pode ser anterior à data de início.')
        expect(dialog(page).locator('#sheet-date')).to_have_value('2026-10-01')
        expect(page.locator('.hero-number')).to_have_text('49')
        ok('encerrar antes do inicio: erro dentro do painel, valor preservado, ciclo continua aberto')
        dialog(page).get_by_role('button', name='Cancelar').click()

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
            expect(page.locator('.hero-empty .empty-title')).to_have_text('Nenhum ciclo em andamento.')
            if i < 3:
                tab(page, 'Previsão')
                expect(page.locator('.forecast')).to_contain_text('Histórico: %d ciclo' % (i + 1) + ('' if i == 0 else 's'))
                expect(page.locator('.forecast')).to_contain_text('Necessário: 4 ciclos')
        tab(page, 'Previsão')
        expect(page.locator('.forecast-message')).to_contain_text('não existe um ciclo em andamento')
        expect(page.locator('.forecast')).to_contain_text('Baseado em 4 ciclos fechados')
        expect(page.locator('.forecast-hero')).to_have_count(0)
        ok('4 ciclos iniciados e encerrados; previsao so apos o 4o e sem ciclo aberto nao inventa data')

        start(page, '2026-05-10')
        expect(page.locator('.hero-number')).to_have_text('197')
        tab(page, 'Previsão')
        view = assert_forecast_matches(page)
        assert view['kind'] == 'ok'
        print('    previsao exibida:', view['centralDate'], '|', view['windowLine'])
        tab(page, 'Início')
        expect(page.locator('.kpi-median')).to_contain_text('29,5 dias')
        expect(page.locator('.kpi-closed')).to_contain_text('4')
        expect(page.locator('.next-row')).to_contain_text('Passou da janela estimada')  # 23/11 ja passou de 08/06
        ok('quinto ciclo: heroi "197 dias", previsao coincide com presentNextChange, indicadores e proxima troca')

        # 6. Previsao completa e estatisticas
        tab(page, 'Previsão')
        full = assert_forecast_matches(page)
        page.locator('.forecast summary').click()
        expect(page.locator('.forecast .detail-list')).to_contain_text('Mediana')
        expect(page.locator('.forecast .detail-list')).to_contain_text(full['details'][0]['value'])
        expect(page.locator('.tip-card')).to_be_visible()
        tab(page, 'Estatísticas')
        expect(page.locator('.stat').filter(has_text='Mediana').locator('dd')).to_have_text('29,5 dias')
        expect(page.locator('.stat').filter(has_text='Média').locator('dd')).to_have_text('29,75 dias')
        expect(page.locator('.stat').filter(has_text='Mais longo').locator('dd')).to_have_text('31 dias')
        assert page.locator('.bar-row').count() == 4
        assert page.locator('.bar-row .bar-value').all_text_contents() == ['29 dias', '29 dias', '30 dias', '31 dias']
        expect(page.locator('#records-title')).to_be_visible()
        ok('previsao completa com detalhes; estatisticas, grafico de barras e registros corretos')

        # 7. Historico: ordenacao, detalhes, edicao, exclusao
        tab(page, 'Histórico')
        assert page.locator('#history-list .history-duration').all_text_contents() == ['+31 dias', '+30 dias', '+29 dias', '+29 dias']
        page.locator('#sort-select').select_option('shortest')
        assert page.locator('#history-list .history-duration').all_text_contents() == ['+29 dias', '+29 dias', '+30 dias', '+31 dias']
        page.locator('#sort-select').select_option('recent')
        expect(page.locator('.card-open')).to_contain_text('Desde 10 de maio de 2026')
        first = page.locator('#history-list li').first
        expect(first.locator('.history-start')).to_have_text('7 de abril de 2026')
        expect(first.locator('.history-end')).to_have_text('8 de maio de 2026')
        expect(first.locator('.history-detail')).to_be_hidden()
        expand(page, '7 de abril de 2026')
        expect(first.locator('.history-detail')).to_contain_text('Duração total31 dias')
        expect(first.locator('.history-detail')).to_contain_text('1 mês e 1 dia')
        expect(first.locator('.history-head')).to_have_attribute('aria-expanded', 'true')
        expand(page, '7 de abril de 2026')
        expect(first.locator('.history-detail')).to_be_hidden()
        ok('historico: ordem, ordenacao, detalhes expansiveis (meses e dias do dominio), ciclo em andamento destacado')

        before = forecast_view(page)
        expand(page, '1º de fevereiro de 2026')
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
        expect(edited.locator('.history-duration')).to_have_text('+30 dias')
        tab(page, 'Previsão'); after = assert_forecast_matches(page)
        assert after != before, 'a previsao deveria mudar apos a edicao'
        print('    previsao apos editar:', after['centralDate'], '|', after['windowLine'])
        ok('editar ciclo: erro de data, erro de sobreposicao, edicao valida; historico e previsao corretos')

        tab(page, 'Histórico')
        expand(page, '1º de janeiro de 2026')
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

        # 8. Persistencia apos recarregar
        page.reload()
        tab(page, 'Histórico')
        expect(page.locator('#history-list li')).to_have_count(3)
        expect(row(page, '1º de fevereiro de 2026').locator('.history-end')).to_have_text('3 de março de 2026')
        tab(page, 'Início'); expect(page.locator('.hero-number')).to_have_text('197')
        tab(page, 'Previsão'); assert_forecast_matches(page)
        ok('recarregar: ciclos editados/excluidos e ciclo aberto persistem')

        # 9. Excluir o ciclo aberto
        tab(page, 'Início')
        page.get_by_role('button', name='Excluir ciclo em andamento desde 10 de maio de 2026').click()
        expect(dialog(page)).to_contain_text('Excluir o ciclo em andamento desde 10 de maio de 2026?')
        dialog(page).get_by_role('button', name='Confirmar exclusão').click()
        toast(page, 'Ciclo excluído.')
        expect(page.locator('.hero-empty .empty-title')).to_have_text('Nenhum ciclo em andamento.')
        page.reload()
        expect(page.locator('.hero-empty .empty-title')).to_have_text('Nenhum ciclo em andamento.')
        ok('excluir ciclo aberto: estado limpo e persistido')

        # 10. Tema pelo atalho do topo e por Configuracoes > Aparencia
        assert page.evaluate("document.documentElement.dataset.theme") is None
        page.get_by_role('button', name=re.compile('^Tema:')).click(); toast(page, 'Tema: Claro')
        assert page.evaluate("document.documentElement.dataset.theme") == 'light'
        page.get_by_role('button', name=re.compile('^Tema:')).click(); toast(page, 'Tema: Escuro')
        page.reload()
        assert page.evaluate("document.documentElement.dataset.theme") == 'dark'
        page.get_by_role('button', name=re.compile('^Tema:')).click()
        assert page.evaluate("document.documentElement.dataset.theme") is None
        settings(page, 'Aparência')
        page.get_by_role('radio', name='Escuro').click()
        assert page.evaluate("document.documentElement.dataset.theme") == 'dark'
        expect(page.get_by_role('radio', name='Escuro')).to_have_attribute('aria-checked', 'true')
        bg_dark = page.evaluate("getComputedStyle(document.body).backgroundColor")
        assert bg_dark not in ('rgb(0, 0, 0)',), bg_dark  # grafite, nunca preto absoluto
        page.get_by_role('radio', name='Claro').click()
        bg_light = page.evaluate("getComputedStyle(document.body).backgroundColor")
        assert bg_light != bg_dark
        page.reload(); settings(page, 'Aparência')
        expect(page.get_by_role('radio', name='Claro')).to_have_attribute('aria-checked', 'true')
        page.get_by_role('radio', name='Automático', exact=True).first.click()
        assert page.evaluate("document.documentElement.dataset.theme") is None
        ok('tema: atalho do topo e Aparencia (claro/escuro/automatico) funcionam e persistem; fundo escuro nao e preto')
        assert not errs, errs
        ctx.close()

        # 11. Automatico segue o sistema
        for scheme in ['dark', 'light']:
            ctx, page, errs = new_page(browser, url, scheme=scheme)
            bgs = page.evaluate("getComputedStyle(document.body).backgroundColor")
            ctx2 = bgs
            if scheme == 'dark': dark_auto = bgs
            else: assert bgs != dark_auto, 'automatico deveria acompanhar o sistema'
            ctx.close()
        ok('modo automatico acompanha o esquema de cores do sistema')

        # 12. Armazenamento corrompido nao derruba o app
        for raw in ['{quebrado', '{"version":1,"cycles":[{"id":"x","startDate":"2026-02-30","endDate":null}]}']:
            ctx, page, errs = new_page(browser, url)
            page.evaluate('r => localStorage.setItem("gastrack.cycles", r)', raw)
            page.reload()
            expect(page.locator('#notice')).to_contain_text('não puderam ser lidos')
            expect(page.locator('.hero-empty .empty-title')).to_have_text('Nenhum ciclo em andamento.')
            start(page, '2026-06-01')
            toast(page, 'Ciclo iniciado.')
            assert page.evaluate('localStorage.getItem("gastrack.cycles.corrupt")') == raw
            assert not errs, errs
            ctx.close()
        ok('armazenamento corrompido: aviso, app funcional e copia preservada')

        # 13. Registrar troca (encerra e inicia o proximo em uma gravacao)
        ctx, page, errs = new_page(browser, url)
        seed(page, closed([29, 29, 30, 31]) + [{'id': 'o', 'startDate': '2026-11-03', 'endDate': None}])
        expect(page.locator('.hero-number')).to_have_text('20')
        bar = page.locator('.hero [role=progressbar]')
        expect(bar).to_have_attribute('aria-valuenow', '69')  # 20 de 29 dias ate a data central estimada
        expect(page.locator('.progress-meta')).to_contain_text('3 nov 2025'.replace('2025', '2026'))
        expect(page.locator('.next-row')).to_contain_text('Próxima troca em 9 dias')
        page.get_by_role('button', name='Registrar troca').click()
        expect(dialog(page).locator('#sheet-date')).to_have_value('2026-11-23')
        dialog(page).get_by_role('button', name='Registrar troca').click()
        toast(page, 'Troca registrada.')
        expect(page.locator('.hero-number')).to_have_text('0')
        expect(page.locator('.kpi-closed')).to_contain_text('5')
        saved = page.evaluate('JSON.parse(localStorage.getItem("gastrack.cycles")).cycles')
        assert len(saved) == 6 and saved[4]['endDate'] == '2026-11-23' and saved[5] == {**saved[5], 'startDate': '2026-11-23', 'endDate': None}, saved
        page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
        ok('registrar troca: encerra o ciclo e inicia o proximo na mesma data; progresso e proxima troca vem da previsao')
        ctx.close()

        # 14. Lembrete dentro do app (aproximacao, janela, depois) e configuracoes de lembretes
        base = closed([29, 29, 30, 31])
        ctx, page, errs = new_page(browser, url)           # mediana 29,5 -> janela 29..30 dias, central 29
        seed(page, base + [{'id': 'o', 'startDate': '2026-10-27', 'endDate': None}])   # janela comeca em 25/11
        expect(page.locator('.alert-card')).to_contain_text('aproximando do seu padrão habitual')
        expect(page.locator('.alert-card')).to_contain_text('2 dias')
        settings(page, 'Lembretes')
        expect(page.locator('.unavailable')).to_contain_text('Notificações do sistema')
        expect(page.locator('.unavailable')).to_contain_text('Ainda não disponíveis')
        expect(page.locator('.unavailable [role=switch], .unavailable input')).to_have_count(0)  # nenhum controle falso
        page.get_by_role('radio', name='1 dia antes').click()
        tab(page, 'Início'); expect(page.locator('.alert-card')).to_have_count(0)
        settings(page, 'Lembretes'); page.get_by_role('radio', name='5 dias antes').click()
        tab(page, 'Início'); expect(page.locator('.alert-card')).to_have_count(1)
        settings(page, 'Lembretes')
        page.get_by_role('switch').click()
        expect(page.get_by_role('switch')).to_have_attribute('aria-checked', 'false')
        expect(page.get_by_role('radio', name='1 dia antes')).to_be_disabled()
        tab(page, 'Início'); expect(page.locator('.alert-card')).to_have_count(0)
        page.reload(); settings(page, 'Lembretes')
        expect(page.get_by_role('switch')).to_have_attribute('aria-checked', 'false')  # persistiu
        expect(page.get_by_role('radio', name='5 dias antes')).to_have_attribute('aria-checked', 'true')
        page.get_by_role('switch').click()
        for start_, text in [('2026-10-25', 'dentro da janela estimada'), ('2026-10-01', 'terminou há')]:
            seed(page, base + [{'id': 'o', 'startDate': start_, 'endDate': None}])
            expect(page.locator('.alert-card')).to_contain_text(text)
        assert not errs, errs
        ok('lembretes: alerta de aproximacao/janela/depois; antecedencia e liga/desliga reais e persistentes; notificacoes do sistema sinalizadas como indisponiveis')
        ctx.close()

        # 15. Idioma
        ctx, page, errs = new_page(browser, url)
        seed(page, base + [{'id': 'o', 'startDate': '2026-10-05', 'endDate': None}])
        settings(page, 'Idioma')
        page.get_by_role('radio', name='English').click()
        assert page.evaluate("document.documentElement.lang") == 'en'
        expect(page.locator('#tabs')).to_contain_text('Settings')
        tab(page, 'Home')
        expect(page.locator('.eyebrow').first).to_have_text('Current cycle')
        expect(page.locator('.hero-since')).to_have_text('In progress since October 5, 2026')
        tab(page, 'Forecast')
        expect(page.locator('.forecast h2')).to_have_text('Estimated next change')
        expect(page.locator('.forecast')).to_contain_text('Estimated window:')
        expect(page.locator('.forecast')).to_contain_text('The forecast is a statistical estimate, not a guarantee.')
        view_en = page.evaluate("""async () => {
          const ui = await import('/js/ui/forecast/index.js');
          return ui.presentNextChange(JSON.parse(localStorage.getItem('gastrack.cycles')).cycles, 'en');
        }""")
        expect(page.locator('.forecast-central')).to_have_text(view_en['centralDate'])
        tab(page, 'History'); expect(page.locator('#history-count')).to_have_text('4 closed cycles')
        page.reload()
        expect(page.locator('#tabs')).to_contain_text('History')  # persistiu
        settings(page, 'Language', 'Settings'); page.get_by_role('radio', name='Português (Brasil)').click()
        expect(page.locator('#tabs')).to_contain_text('Configurações')
        assert page.evaluate("document.documentElement.lang") == 'pt-BR'
        ok('idioma: ingles e portugues trocam todos os textos (inclusive previsao e datas), persistem e atualizam <html lang>')
        ctx.close()
        ctx, page, errs = new_page(browser, url, locale='en-US')
        expect(page.locator('#tabs')).to_contain_text('History')
        expect(page.locator('.hero-empty .empty-title')).to_have_text('No cycle in progress.')
        ctx.close()
        ok('idioma automatico: aparelho em ingles abre em ingles')

        # 16. Filtro por ano
        ctx, page, errs = new_page(browser, url)
        seed(page, [{'id': 'a', 'startDate': '2025-11-01', 'endDate': '2025-12-01'}, {'id': 'b', 'startDate': '2025-12-05', 'endDate': '2026-01-04'}, {'id': 'c', 'startDate': '2026-02-01', 'endDate': '2026-03-03'}])
        tab(page, 'Histórico')
        expect(page.get_by_role('radio', name='2025')).to_be_visible()
        expect(page.locator('#history-list li')).to_have_count(3)
        page.get_by_role('radio', name='2025').click()
        expect(page.locator('#history-list li')).to_have_count(2)
        expect(page.locator('#history-count')).to_have_text('2 ciclos encerrados')
        page.get_by_role('radio', name='Todos').click()
        expect(page.locator('#history-list li')).to_have_count(3)
        ok('historico: filtro por ano de inicio (so aparece com mais de um ano)')
        ctx.close()

        # 17. Dados: exportar, importar (com confirmacao) e apagar (com confirmacao explicita)
        ctx, page, errs = new_page(browser, url)
        seed(page, closed([29, 30]) + [{'id': 'o', 'startDate': '2026-11-03', 'endDate': None}])
        settings(page, 'Dados')
        exported = page.locator('#export-text').input_value()
        import json as _json
        data = _json.loads(exported)
        assert data['app'] == 'gastrack' and data['version'] == 1 and data['exportedAt'] == '2026-11-23' and len(data['cycles']) == 3, data
        page.get_by_role('button', name='Copiar').click()
        expect(page.locator('#toast')).to_have_text(re.compile('Cópia na área de transferência|Não foi possível copiar'))
        with page.expect_download() as dl:
            page.get_by_role('button', name='Baixar arquivo').click()
        assert dl.value.suggested_filename == 'gastrack-2026-11-23.json'
        assert _json.loads(Path(dl.value.path()).read_text()) == data
        # importacao recusada: JSON invalido, formato estranho, ciclos invalidos
        page.locator('#import-text').fill('')
        page.get_by_role('button', name='Verificar').click()
        expect(page.locator('#import-error')).to_contain_text('Cole o conteúdo')
        for bad, msg in [('{quebrado', 'não é um JSON válido'), ('{"app":"outro","cycles":[]}', 'não parece ser uma exportação'),
                         ('{"app":"gastrack","version":9,"cycles":[]}', 'não é suportada'),
                         ('{"app":"gastrack","version":1,"cycles":[{"id":"x","startDate":"2026-02-30","endDate":null}]}', 'inválidos')]:
            page.locator('#import-text').fill(bad)
            page.get_by_role('button', name='Verificar').click()
            expect(page.locator('#import-error')).to_contain_text(msg)
            expect(dialog(page)).to_have_count(0)
        assert len(page.evaluate('JSON.parse(localStorage.getItem("gastrack.cycles")).cycles')) == 3  # nada mudou
        # arquivo
        Path('/tmp/gastrack-e2e-import.json').write_text(_json.dumps({'app': 'gastrack', 'version': 1, 'cycles': closed([28, 28, 29, 30, 31])}))
        page.locator('#import-file').set_input_files('/tmp/gastrack-e2e-import.json')
        expect(page.locator('#import-text')).to_have_value(re.compile('"cycles"'))
        page.get_by_role('button', name='Verificar').click()
        expect(dialog(page)).to_contain_text('5 ciclos')
        expect(dialog(page)).to_contain_text('3 ciclos atuais')
        confirm = dialog(page).get_by_role('button', name='Importar e substituir')
        expect(confirm).to_be_disabled()
        dialog(page).get_by_role('button', name='Cancelar').click()
        assert len(page.evaluate('JSON.parse(localStorage.getItem("gastrack.cycles")).cycles')) == 3
        page.get_by_role('button', name='Verificar').click()
        dialog(page).get_by_label('Entendo que os dados atuais serão substituídos.').check()
        expect(confirm).to_be_enabled()
        confirm.click()
        toast(page, '5 ciclos importados.')
        assert len(page.evaluate('JSON.parse(localStorage.getItem("gastrack.cycles")).cycles')) == 5
        expect(page.locator('#import-text')).to_have_value('')
        tab(page, 'Início'); expect(page.locator('.kpi-closed')).to_contain_text('5')
        # apagar: so apos confirmar explicitamente
        settings(page, 'Dados')
        page.get_by_role('button', name='Apagar todos os dados').click()
        clear = dialog(page).get_by_role('button', name='Apagar tudo')
        expect(clear).to_be_disabled()
        clear.click(force=True)
        assert len(page.evaluate('JSON.parse(localStorage.getItem("gastrack.cycles")).cycles')) == 5
        dialog(page).get_by_label('Entendo que isto não pode ser desfeito.').check()
        clear.click()
        toast(page, 'Todos os dados foram apagados.')
        assert page.evaluate('JSON.parse(localStorage.getItem("gastrack.cycles")).cycles') == []
        expect(page.locator('.menu-row, .settings-section').first).to_be_visible()
        tab(page, 'Início'); expect(page.locator('.hero-empty')).to_be_visible()
        assert not errs, errs
        ok('dados: exportar (copiar/baixar), importar com validacao e confirmacao, apagar com confirmacao explicita')
        ctx.close()

        # 18. Navegacao: sub-telas, Voltar do aparelho, painel + Voltar, Privacidade, Ciclo, Sobre
        ctx, page, errs = new_page(browser, url)
        settings(page)
        for name, probe in [('Ciclo', 'Mínimo de ciclos encerrados para estimar'), ('Privacidade', 'Funcionamento offline'),
                            ('Sobre', 'Versão 0.1.0'), ('Idioma', 'Português (Brasil)'), ('Aparência', 'Animações')]:
            menu_row(page, name).click()
            expect(page.locator('#page-title')).to_have_text(name)
            expect(page.locator('.view')).to_contain_text(probe)
            page.get_by_role('button', name='Voltar').click()
            expect(page.locator('.menu-row')).to_have_count(7)
        menu_row(page, 'Ciclo').click()
        expect(page.locator('.view')).to_contain_text('4')       # minimo de ciclos (parametro do dominio)
        page.go_back()  # botao Voltar do aparelho
        expect(page.locator('.menu-row')).to_have_count(7)
        menu_row(page, 'Dados').click()
        page.get_by_role('button', name='Apagar todos os dados').click()
        expect(dialog(page)).to_be_visible()
        page.go_back(); expect(dialog(page)).to_have_count(0)
        expect(page.locator('#page-title')).to_have_text('Dados')
        page.go_back(); expect(page.locator('.menu-row')).to_have_count(7)
        menu_row(page, 'Sobre').click()
        expect(page.locator('.about-crystal')).to_be_visible()
        expect(page.locator('.about')).to_contain_text('Sempre um passo à frente.')
        page.get_by_role('button', name='Voltar').click(); page.get_by_role('button', name='Voltar').count()
        ok('configuracoes: 7 categorias com sub-telas, Voltar e botao Voltar do aparelho (sub-tela e painel)')
        ctx.close()

        # 19. Animacoes: preferencia do app e do sistema
        ctx, page, errs = new_page(browser, url, motion='no-preference')
        page.locator('#splash').wait_for(state='detached', timeout=5000)
        seed(page, closed([29, 29, 30, 31]) + [{'id': 'o', 'startDate': '2026-11-03', 'endDate': None}])
        page.locator('#splash').wait_for(state='detached', timeout=5000)
        assert page.evaluate("document.documentElement.dataset.motion") == 'on'
        assert page.evaluate("getComputedStyle(document.querySelector('.progress-fill')).animationName") != 'none'
        settings(page, 'Aparência')
        page.get_by_role('radio', name='Desativadas').click()
        assert page.evaluate("document.documentElement.dataset.motion") == 'off'
        tab(page, 'Início')
        assert page.evaluate("getComputedStyle(document.querySelector('.progress-fill')).animationName") == 'none'
        page.reload()
        expect(page.locator('#splash')).to_have_count(0)  # sem animacao, sem abertura
        assert page.evaluate("document.documentElement.dataset.motion") == 'off'
        ctx.close()
        ctx, page, errs = new_page(browser, url, motion='reduce')
        assert page.evaluate("document.documentElement.dataset.motion") == 'off'  # automatico obedece ao sistema
        settings(page, 'Aparência'); page.get_by_role('radio', name='Ativadas', exact=True).click()
        assert page.evaluate("document.documentElement.dataset.motion") == 'on'
        ctx.close()
        ok('animacoes: abertura com cristal ornamental, ligar/desligar no app e modo automatico seguem o sistema')

        # 20. Viewport pequena (360x640): todas as abas, sub-telas e paineis, claro e escuro
        for scheme in ['light', 'dark']:
            ctx, page, errs = new_page(browser, url, viewport={'width': 360, 'height': 640}, scheme=scheme)
            seed(page, closed([29, 29, 30, 31], start='2025-11-01') + [{'id': 'o', 'startDate': '2026-11-03', 'endDate': None}])
            screens = [('Início', None), ('Histórico', None), ('Estatísticas', None), ('Previsão', None), ('Configurações', None)]
            for t, _ in screens:
                tab(page, t)
                assert no_overflow(page), f'overflow horizontal na aba {t} ({scheme})'
                assert not small_targets(page), f'alvos pequenos em {t}: {small_targets(page)}'
                if SHOTS: page.screenshot(path=f'{SHOTS}/{scheme}-{t}.png', full_page=True)
            for name in ['Aparência', 'Idioma', 'Ciclo', 'Lembretes', 'Dados', 'Privacidade', 'Sobre']:
                settings(page, name)
                assert no_overflow(page), f'overflow horizontal em {name} ({scheme})'
                assert not small_targets(page), f'alvos pequenos em {name}: {small_targets(page)}'
                if SHOTS: page.screenshot(path=f'{SHOTS}/{scheme}-cfg-{name}.png', full_page=True)
            tab(page, 'Histórico'); expand(page, '1º de novembro de 2025')
            if SHOTS: page.screenshot(path=f'{SHOTS}/{scheme}-historico-expandido.png')
            page.get_by_role('button', name=re.compile('^Editar ciclo de 1º de novembro')).click()
            page.wait_for_timeout(350)
            assert no_overflow(page), 'overflow no painel'
            assert not small_targets(page), f'alvos pequenos no painel: {small_targets(page)}'
            box = dialog(page).bounding_box(); assert box['y'] + box['height'] <= 641 and box['x'] >= 0 and box['x'] + box['width'] <= 360, box
            if SHOTS: page.screenshot(path=f'{SHOTS}/{scheme}-painel.png')
            page.keyboard.press('Escape')
            page.get_by_role('button', name=re.compile('^Excluir ciclo de 1º de novembro')).click()
            assert no_overflow(page), 'overflow na confirmacao'
            assert not small_targets(page), f'alvos pequenos na confirmacao: {small_targets(page)}'
            assert not errs, errs
            ctx.close()
        ok('viewport 360x640 (claro e escuro): abas, sub-telas e paineis sem overflow, alvos >= 44px, sem erros no console')

        # 21. Viewport minima (320x568): sem overflow
        ctx, page, errs = new_page(browser, url, viewport={'width': 320, 'height': 568})
        seed(page, closed([29, 29, 30, 31], start='2025-11-01') + [{'id': 'o', 'startDate': '2026-11-03', 'endDate': None}])
        for t in ['Início', 'Histórico', 'Estatísticas', 'Previsão', 'Configurações']:
            tab(page, t); assert no_overflow(page), f'overflow em {t} (320px)'
        assert not errs, errs
        ok('viewport 320x568: sem overflow horizontal')
        ctx.close()

        browser.close()
    server.shutdown()
    print(f'E2E OK: {len(checks)} verificacoes')

try:
    main()
except Exception as e:
    import traceback; traceback.print_exc()
    print('E2E FALHOU:', e); sys.exit(1)
