# ARCHITECTURE

## Status

Arquitetura provisoria. Deve ser validada tecnicamente antes da implementacao completa.

## Direcao inicial

Hipotese atual:

- Capacitor;
- TypeScript;
- interface mobile-first;
- React + Vite se a validacao justificar;
- armazenamento local estruturado, preferencialmente SQLite;
- GitHub Actions para build Android.

Claude deve validar essa stack antes de considera-la definitiva.

## Separacao

Camadas conceituais:

core/domain
- datas;
- ciclos;
- estatisticas;
- previsao.

data
- persistencia;
- banco;
- repositorios.

notifications
- notificacoes;
- controle de alertas.

ui
- telas;
- componentes;
- tema.

app
- composicao;
- navegacao.

A regra de negocio nao deve depender da interface.

## Modelo

A entidade central e o ciclo de consumo.

Campos conceituais:

- id;
- startDate;
- endDate;
- status.

Nao criar produto, marca, peso ou fornecedor na V1 sem necessidade real.

## Persistencia

Preferencia: SQLite local.

Requisitos:
- dados persistentes;
- migracoes;
- repositorio separado do dominio;
- funcionamento offline;
- edicoes atualizam estatisticas;
- exclusoes atualizam estatisticas.

## Testes

O dominio deve ser implementado e testado antes da UI completa.

Testar:
- calculos de datas;
- ciclos abertos;
- historico;
- edicao;
- exclusao;
- estatisticas;
- previsao;
- outliers;
- mudanca de padrao.

## Validacao tecnica obrigatoria

Antes da implementacao completa, verificar:

1. ferramentas disponiveis;
2. dependencias;
3. Capacitor;
4. Android;
5. SQLite;
6. notificacoes;
7. testes;
8. GitHub Actions;
9. build de APK;
10. riscos da stack.

Se algo for inviavel, escolher a menor alternativa que preserve o produto.

## Build

Objetivo futuro:

GitHub
-> Actions
-> dependencias
-> testes
-> build Android
-> APK artifact.

Primeiro alvo:
APK de debug.

Release e assinatura ficam para depois.

## Restricoes conhecidas

O ambiente do Claude pode nao possuir:
- Android SDK;
- adb;
- emulator;
- acesso completo aos repositorios Maven/Google.

Nao assumir que o APK pode ser compilado localmente.

Distinguir:
- instalado;
- declarado;
- testado;
- configurado;
- compilado;
- validado.

## Git

Git desde o inicio.

Usar commits pequenos em etapas importantes.

Associar checkpoints a commits quando uma etapa estiver validada.

## Nao fazer

- backend;
- autenticacao;
- cloud;
- abstracoes genericas desnecessarias;
- plataforma de varios consumiveis;
- funcionalidades fora da V1.