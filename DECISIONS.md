# DECISIONS

## D001 - Codinome

GasTrack.

Status: provisoria.

O nome comercial ainda sera definido.

## D002 - Escopo

V1 focada exclusivamente em ciclos de uso de botijao de gas.

Status: aprovada.

## D003 - Offline-first

V1 funciona localmente sem conta ou servidor.

Status: aprovada.

## D004 - Datas

Datas de consumo nao possuem horario ou fuso como parte da regra de negocio.

Status: aprovada. Implementada e testada na Etapa 1a (ver D012 e D013).

## D005 - Duracao

Manter:
1. duracao de calendario;
2. total de dias.

Status: aprovada. Detalhada em D012 e D014.

## D006 - Previsao

Previsao estatistica e explicavel.

Status: aprovada.

## D007 - Banco

SQLite local e a preferencia inicial, via plugin da comunidade (@capacitor-community/sqlite), atras de uma interface de repositorio. Plano B: outro armazenamento simples atras da mesma interface, sem alterar o dominio.

Status: provisoria. A parte SQL (constraints, migracoes) foi testada em SQLite 3.50.4; o plugin nao foi testado (ver TECHNICAL_VALIDATION.md). Texto atualizado na Etapa 1a conforme a validacao tecnica.

## D008 - Stack

Capacitor + TypeScript e a primeira opcao. Capacitor 8 exige Node 22 (segundo a documentacao). React/Vite ainda nao foram validados.

Status: provisoria. Texto atualizado na Etapa 1a conforme a validacao tecnica.

O texto original registrava: "Claude deve validar antes da implementacao completa." (mantido como regra; a validacao tecnica foi feita na Etapa 1a, mas a stack Android continua nao validada).

## D009 - GitHub Actions

GitHub Actions sera o caminho principal para gerar APK quando o ambiente local nao puder compilar.

Status: aprovada. Nota R7 (2026-10-10): o repositorio agora esta no GitHub (PR #1 integrada, segundo o usuario), mas nao existe `.github/` no repositorio; nenhum workflow foi criado nem executado. Continua nao verificada.

## D010 - Checkpoints

Etapas importantes devem atualizar CHECKPOINT.md.

Status: aprovada.

## D011 - Dominio isolado e sem dependencias

O dominio fica em src/core/domain, em TypeScript puro, sem dependencias de runtime e sem importar nada de UI, Android, Capacitor ou banco. Testes com o runner nativo do Node (node --test), que roda arquivos .ts por type stripping (sem enum nem parameter properties; imports com extensao .ts; tsconfig com erasableSyntaxOnly).

Status: aprovada. Implementada e testada para o modulo de datas.

## D012 - Total de dias e a medida fundamental

O total exato de dias (fim - inicio) e a medida usada por estatisticas e previsao. "Meses + dias" e apenas representacao humana.

Status: aprovada (decisao do produto, Etapa 1a). Implementada e testada.

## D013 - Datas sem horario e calculo independente de fuso

Datas sao texto YYYY-MM-DD (ano 0001-9999). A aritmetica usa inteiros (dias desde 1970-01-01, calendario gregoriano) e nao usa Date, Intl nem relogio no modulo. Motivo medido: o calculo ingenuo com horario local deu 9 dias em vez de 10 para 2018-10-31 -> 2018-11-10 em America/Sao_Paulo. A escolha de implementar a conta com inteiros, em vez de Date.UTC, evita a armadilha de Date.UTC com anos 0-99; ela foi conferida contra Date (UTC) como oraculo independente, para todos os dias de 0001-01-01 a 9999-12-31. Nenhuma biblioteca de datas foi adicionada.

Status: aprovada. Implementada e testada.

## D014 - Regra de "meses + dias" (representacao humana)

Nunca usar "1 mes = 30 dias" e nunca ajustar dia inexistente. Aniversario mensal = mesma data (mesmo dia) em mes posterior; mes completo = aniversario que existe.
- Inicio nos dias 1-28: months = aniversarios alcancados; days = restante; sem mes completo, so dias.
- Inicio nos dias 29-31: so ha meses+dias quando o fim cai exatamente em aniversario (N meses e 0 dias); caso contrario, so total de dias.
- Fim anterior ao inicio: calendarDuration lanca erro; daysBetween devolve valor negativo.
- Sem anos: 12 meses aparece como "12 meses".
Exemplos obrigatorios: 2026-10-05 -> 2027-01-15 = 102 dias = 3 meses e 10 dias; 2026-01-31 -> 2026-03-01 = 29 dias, so dias (nunca "1 mes e 1 dia").
Consequencia aceita: 2026-05-31 -> 2026-06-30 (30 dias) aparece so como dias, nao "1 mes".
Documentada tambem em src/core/domain/dates/README.md.

Status: aprovada quanto aos dois exemplos obrigatorios (decisao do produto); os demais casos de fim de mes sao escolha de engenharia ("mais simples e consistente"), documentada e coberta por testes, e podem ser revistos pelo produto. Implementada e testada.

## D015 - Exportacao/importacao local na V1

Exportar e importar os dados localmente entra na V1.

Status: aprovada (decisao do produto). NAO implementada; sera feita em etapa posterior.

## D016 - Modelo de ciclo: {id, startDate, endDate}, estado derivado

Um ciclo tem apenas id, startDate e endDate (null = aberto). O estado (aberto/fechado) e derivado de endDate e nao e armazenado; assim nao existe "aberto com data de fim" nem "fechado sem fim". Nenhum campo extra e aceito (marca, peso, preco, etc.). Interpreta o campo conceitual "status" do ARCHITECTURE.md como derivado; se o produto preferir um campo armazenado, e uma mudanca pequena.

Status: aprovada para a Etapa 1b (instrucao do produto: dois estados, objeto pequeno). Implementada e testada.

## D017 - Identificadores de ciclo fornecidos por quem chama

O dominio nao gera ids (sem banco, sem relogio, sem aleatoriedade). createCycle recebe o id; formato valido: 1 a 64 caracteres entre letras ASCII, digitos, "-" e "_". Motivo: testes deterministicos e ids estaveis na exportacao/importacao (D015), onde um contador local colidiria. A camada de aplicacao devera gerar ids (ex.: UUID); a disponibilidade de crypto.randomUUID no ambiente do Capacitor ainda nao foi verificada.

Status: escolha de engenharia, implementada e testada no dominio; geracao real de ids nao implementada.

## D018 - Historico imutavel, ordenado e com invariantes

O historico de ciclos e um valor imutavel em memoria; cada operacao devolve um novo historico. Sempre ordenado por compareCycles (inicio; fechado antes de aberto; fim; id), independente da ordem de insercao. Rejeita ids repetidos e mais de um ciclo aberto. Persistencia futura: guardar registros e recarregar com historyFromCycles. Escolhas de engenharia revisaveis: operacao sobre id inexistente lanca erro (nao e no-op); cycleDuration de ciclo fechado ignora a data de referencia.

Status: implementada e testada. Politica de consistencia historica alem disso estava pendente (PD-001); resolvida na etapa R4, ver D019 (a regra de nao sobreposicao complementa os invariantes desta decisao).

## D019 - PD-001: ciclos nao podem se sobrepor

Decisao do produto (etapa R4, saneamento de Cycles). Ciclos NAO podem se sobrepor. Ciclos adjacentes, que compartilham a mesma data-fronteira (fim de um = inicio do outro), sao permitidos. Sobreposicao e rejeitada com CycleOverlapError (code CYCLE_OVERLAP).

Semantica implementada (src/core/domain/cycles/overlap.ts): ciclo fechado = [inicio, fim]; aberto = [inicio, infinito). Sobrepoem-se quando a.inicio < b.fim E b.inicio < a.fim (fim de aberto = infinito). Consequencias: um ciclo aberto so e valido depois de todos os fechados; um ciclo aberto que comecaria antes do fim de um fechado e rejeitado.

A regra vale para criacao/adicao, edicao, fechamento, reabertura e carga/importacao (historyFromCycles), pois todas passam pela mesma validacao central (build). Operacao invalida lanca erro e nao altera o historico original.

Status: aprovada (decisao do produto). Implementada e testada na etapa R4 (testes recriados; ver CHECKPOINT R4).

Ainda a confirmar com o produto (escolha de engenharia, nao decisao): ciclo de zero dia (inicio = fim) e aceito sobre a data-fronteira de outro ciclo e rejeitado se cair estritamente dentro de outro; dois ciclos de zero dia na mesma data sao aceitos. Lacunas entre ciclos continuam aceitas; periodos identicos com ids diferentes agora sao rejeitados (sobreposicao).

## D020 - PD-002: ciclos fechados podem ser reabertos

Decisao do produto (etapa R4). Um ciclo fechado pode ser reaberto: reopenCycle (ciclo) e reopenInHistory (historico); editCycle/updateInHistory com endDate: null tem o mesmo efeito. O id e o inicio sao preservados. A reabertura passa pela mesma validacao de integridade do historico: e rejeitada se existir outro ciclo aberto (OpenCycleConflictError), se causar sobreposicao, por exemplo havendo ciclo posterior (CycleOverlapError), ou se violar outro invariante; reabrir um ciclo ja aberto lanca CycleStateError. Em falha o historico original nao e alterado.

Status: aprovada (decisao do produto). Implementada e testada na etapa R4 (testes recriados).

## D021 - R5: ciclos de zero dia na mesma data sao conflito

Decisao do produto (etapa R5). Um ciclo fechado com inicio = fim continua valido individualmente, mas dois ciclos de zero dia com a MESMA data sao rejeitados com CycleOverlapError, mesmo com ids diferentes, em qualquer ordem de insercao e em toda operacao (adicao, edicao, fechamento, reabertura, importacao), pela validacao central do historico (cyclesOverlap em overlap.ts, usada por build() em history.ts). Falha preserva o historico original.

Nao mudam: ciclos adjacentes continuam permitidos (inclusive um zero dia na fronteira de outro ciclo); zero dia em datas distintas e permitido; zero dia estritamente dentro de outro ciclo continua rejeitado (D019); lacunas continuam aceitas; nao ha exigencia de continuidade.

Esta decisao SUBSTITUI a ressalva de D019 de que dois ciclos de zero dia na mesma data eram aceitos (escolha de engenharia a confirmar); o texto de D019 e mantido como historico.

Status: aprovada (decisao do produto). Implementada e testada (testes recriados).

## D022 - GitHub como remoto efetivo; `origin` e a referencia local antiga

Registro (R7, informado pelo usuario). O remoto efetivo e `github`; `origin` e a referencia local de recuperacao (em `2dc04c0`). A diferenca (`main...origin/main [ahead 4]`) e esperada e nao deve ser resolvida com reset, rebase ou force push. A tag anotada `checkpoint-recovery-integrated-2026-10-10` (commit `8a66b593e086380c9adc5f4cfe61a176391a16bb`) marca a recuperacao e integracao; nao indica aplicativo Android concluido.

Status: registrada; nao ha decisao tecnica pendente.

## Decisoes de produto pendentes

> Historico preservado. PD-001 e PD-002 abaixo foram RESOLVIDAS na etapa R4 (D019 e D020); o texto original e mantido como registro do que estava pendente.

- **PD-001 - consistencia historica e importacao. [RESOLVIDA em R4: ver D019 - sobreposicao rejeitada; lacunas continuam aceitas]** Sobreposicao de ciclos, ciclo aberto comecando antes de ciclos fechados, lacunas e periodos identicos com ids diferentes sao hoje aceitos sem aviso. O produto ainda nao definiu o que fazer (aceitar, avisar ou rejeitar), nem como tratar historicos inconsistentes importados.
- **PD-002 - reabrir ciclo fechado. [RESOLVIDA em R4: ver D020 - reabertura permitida com validacao de integridade]** Hoje nao e suportado (apagar a data de fim). Falta decidir se o produto precisa disso (ex.: fechou por engano).
