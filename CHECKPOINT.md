# CHECKPOINT

## CHECKPOINT R7 - Continuidade e reconciliacao documental (2026-10-10)

Etapa so de auditoria e documentacao. Nenhum codigo de produto foi alterado, nenhuma dependencia instalada, nenhum commit/tag/branch criado. Alteracoes ficam no diretorio de trabalho (nao commitadas).

### Marco de recuperacao e integracao
- Commit de referencia: `8a66b593e086380c9adc5f4cfe61a176391a16bb` (merge da PR #1, "integration/r6-with-github-main", em 2026-10-10 14:54 -0300). Segundo o usuario, `main` local e `github/main` apontam para ele.
- Tag anotada `checkpoint-recovery-integrated-2026-10-10` (objeto `39ec75fed4cc548e7cee601fd7c404a206e94346`, tagger em 2026-10-10 15:11 -0300) aponta para esse commit. Ela marca a recuperacao e a integracao, NAO um aplicativo Android concluido.
- `origin` e a referencia LOCAL antiga de recuperacao (em `2dc04c0`, R5); o remoto efetivo do GitHub e `github`. A divergencia "ahead 4" em `main...origin/main` e esperada e nao deve ser corrigida com reset, rebase ou force push.
- Historico: `cb5f955` (inicializacao no GitHub, so documentos) -> `85b9d10` (R1, base reconstruida) -> `8d67d80` (R4: PD-001/PD-002) -> `2dc04c0` (R5: zero dia) -> `c7b693a` (merge da documentacao inicial) -> `b02a2d0` (remove BOM do .gitignore) -> `8a66b59` (merge da PR #1). O codigo em `src/`, `package.json`, `tsconfig.json` e `scripts/` em `8a66b59` e identico ao de `2dc04c0` (diff vazio).

### Logica de dominio realmente encontrada (evidencia: arquivos e testes)
| Componente | Estado | Evidencia |
|---|---|---|
| Datas (validacao, comparacao, dias entre datas) | implementado e testado | `src/core/domain/dates/calendar.ts`, 25 testes em `calendar.test.ts` |
| Duracao de calendario (meses + dias, total de dias) | implementado e testado | `duration.ts`, 43 testes em `duration.test.ts` |
| Independencia de fuso | implementado e testado | `timezone.test.ts` (6 testes, 3 dependem do TZ) e `scripts/test-tz.mjs` (8 fusos) |
| Ciclo aberto/fechado, criacao, fechamento, edicao, reabertura | implementado e testado | `cycles/cycle.ts`, `cycle.test.ts` (54 testes) |
| Historico imutavel, ordenado, ids unicos, um aberto | implementado e testado | `cycles/history.ts`, `order.ts`, `history.test.ts` (37), `invariants.test.ts` (4) |
| Sobreposicao e adjacencia (PD-001) | implementado e testado | `cycles/overlap.ts` (CycleOverlapError); testes em `history.test.ts` |
| Ciclo de zero dia (D021) | implementado e testado | `overlap.ts`; bloco "R5" de `history.test.ts` |
| Reabertura de ciclo (PD-002) | implementado e testado | `reopenCycle`, `reopenInHistory` |
| Validacao de registros externos | implementado e testado | `cycles/validate.ts`, `validate.test.ts` (10) |
| Isolamento do dominio (sem Date/Intl/relogio/rede etc.) | testado | `isolation.test.ts` em dates (3) e cycles (4) |
| Estatisticas e previsao | NAO existe (planejado) | nao ha `src/core/domain/statistics/` no repositorio |
| Persistencia (SQLite/repositorio) | NAO existe (planejado) | nenhum codigo; `package.json` sem dependencias |
| Interface | NAO existe (planejado) | nenhum codigo |
| Notificacoes | NAO existe (planejado) | nenhum codigo |
| Capacitor / Android / APK | NAO existe (planejado) | sem `android/`, sem `capacitor.config`, sem dependencias |
| GitHub Actions | NAO existe | sem diretorio `.github/`; nunca executado |
| Exportacao/importacao local (D015) | NAO implementada | so `historyFromCycles` valida registros em memoria |

### Testes executados nesta etapa (copia limpa do bundle, Node v22.22.0, tsc 6.0.3)
Resultados ATUAIS (executados agora, separados do historico):
- `npm test` (TZ nao definido): 186 testes, 22 suites, 183 aprovados, 0 reprovados, 3 ignorados (dates 77: 74 aprovados + 3 ignorados; cycles 109: 109 aprovados).
- `npm run test:tz`: 186 testes em cada um dos 8 fusos (UTC, America/Sao_Paulo, America/New_York, Europe/London, Asia/Kolkata, Pacific/Kiritimati, Pacific/Pago_Pago, Pacific/Auckland); 0 reprovados; ignorados: 1 em UTC e Sao_Paulo, 2 nos demais. Resultado: OK.
- `npm run typecheck` (= `tsc -p tsconfig.json`, tsc global 6.0.3): exit 0.
- `npm exec --yes --package=typescript -- tsc -p tsconfig.json`: NAO concluido neste ambiente (excedeu o limite de 60 s e foi interrompido, exit 124; o registro npm e bloqueado aqui). Nao conta como aprovado. Referencia historica informada: exit 0 no computador do usuario.
- Dates: sha256 dos 10 arquivos identico a linha de base R4 (`DATES_BASELINE.sha256`).
Referencia historica (nao reexecutada alem do acima): 186 / 183 / 0 / 3, matriz de 8 fusos sem falhas.

### Testes ignorados e limitacoes
- Os 3 ignorados sao testes de `dates/timezone.test.ts` que so valem em fuso especifico (TZ do processo definido, America/Sao_Paulo, UTC); sao ignorados por desenho, nao por defeito.
- Testes tipados apenas com shim; nao ha `@types/node`. Os testes nao entram no `typecheck`.
- Os testes de `history`, `invariants` e o bloco R5 sao RECRIADOS; os originais perdidos nao foram recuperados. A fidelidade do codigo reconstruido ao original nao esta provada.
- Nao ha `package-lock.json` porque nao ha dependencias; nao ha execucao em CI.
- Testes de fuso dependem da tzdata do sistema.

### Componentes de produto ausentes
Estatisticas, previsao, alertas, persistencia, exportacao/importacao, geracao real de ids, interface, notificacoes, Capacitor, Android, APK, GitHub Actions. O texto literal dos 9 arquivos antigos de Statistics existe apenas como evidencia (pacote de recuperacao R6, `03-evidence/R3`), nao no repositorio.

### Riscos conhecidos
1. Codigo reconstruido (fidelidade nao provada); testes de history/invariants recriados.
2. Stack Android nunca compilada nem testada: Capacitor, plugin SQLite, notificacoes, Actions e APK seguem como hipotese (ver TECHNICAL_VALIDATION).
3. Estatisticas dependem de escolhas de engenharia nunca aprovadas pelo produto (ex.: N = 0, MAD bruto, `relativeMad`).
4. Validacao do historico O(n^2) por operacao; desempenho nao medido.
5. `package.json` ainda descreve "Etapa 1a: dominio de datas" (descricao desatualizada; nao alterada por ser arquivo de configuracao fora do escopo desta etapa).
6. Referencia `origin` local desatualizada: risco de confusao com o remoto `github`.
7. Backup/exportacao ainda fora da V1 efetiva (D015 aprovada, nao implementada): perda de dados ao desinstalar.
8. Commits locais e snapshots nao protegem contra perda do computador; manter o pacote R6 e o GitHub.

### Divergencias documentais corrigidas nesta etapa
- CHECKPOINT.md dizia que nenhum codigo de produto foi testado e nao registrava R1-R5; historico restaurado a partir do Project e esta secao adicionada. O texto original do CHECKPOINT 00 foi preservado.
- DECISIONS.md so tinha D001-D010 na forma inicial; foram incorporadas D011-D021 (e a resolucao de PD-001/PD-002) e a D022. Texto de D001-D010 conforme a versao mais recente do Project (D004, D005, D007, D008 ampliadas; D009 anotada).
- PROJECT.md: status "fase de preparacao tecnica" atualizado.
- ARCHITECTURE.md e README.md: adicionada secao de estado real.
- CLAUDE_PROJECT_INSTRUCTIONS.md: sem divergencia; nao alterado.

### Proximo passo recomendado
Etapa pequena e unica: reconstruir o dominio de Statistics em `src/core/domain/statistics/` a partir da evidencia R3, SOMENTE com autorizacao do produto, apos decidir as escolhas da secao 4.5 do documento R2. Criterios de aceitacao: so `closed` entram; sem arredondamento prematuro; resultado explicito para ausencia de dados; testes de propriedade com semente e isolamento; `npm test`, `npm run test:tz` e `typecheck` verdes; dates e cycles sem alteracao (hash e diff). Nao iniciar previsao, persistencia, UI ou Android nessa etapa.

### Regra de continuidade
Ao retomar: ler este arquivo; `git status --short --branch`; `git log -1`; inspecionar a estrutura real; `npm test`, `npm run test:tz`, `npm run typecheck`; separar planejado de funcional.

---

## CHECKPOINT R5 - Unicidade de ciclos de zero dia (2026-10-10)

### Estado
- Commit inicial: 8d67d808cb99701fb0c9c62c9c283f9878e4404c (tag pre-r5-zero-day; arvore limpa; snapshots R4 conferidos por sha256). Commit final: ver relatorio da etapa.
- Regra D021: dois ciclos de zero dia na mesma data sao rejeitados (CycleOverlapError), em qualquer ordem e operacao, pela validacao central. Dates NAO modificado (sha256 e diff -r conferidos).

### Alterado
- src/core/domain/cycles/overlap.ts: cyclesOverlap passa a tratar dois zero dia na mesma data como conflito (unica alteracao de codigo; history.ts nao mudou, pois build() ja usa assertNoOverlap).
- src/core/domain/cycles/history.test.ts: bloco "R5: ciclos de zero dia" (11 testes RECRIADOS/novos).
- Criados/removidos: nenhum arquivo.

### Testes (executados)
- Antes: 175 testes, 172 aprovados, 0 reprovados, 3 pulados. Os novos testes foram escritos primeiro e falharam sem a regra (6 falhas), depois passaram.
- Depois: npm test = 186 testes, 183 aprovados, 0 reprovados, 3 pulados (pulados de datas dependentes de fuso).
- npm run test:tz: 186 testes em cada um dos 8 fusos, 0 reprovados, OK.
- npm run typecheck: sem erros (testes nao tipados com shim nesta etapa).
- Cobertura: mesma data em ambas as ordens, datas diferentes, zero dia dentro de outro ciclo (fechado e aberto), adjacentes, lacunas, edicao/fechamento/reabertura, importacao, 40 sequencias aleatorias (invariante: nenhum zero dia duplicado), historico preservado apos falha.

### Limitacoes
- Todos os testes de history sao recriados; os originais nao foram recuperados.
- Fidelidade ao codigo original perdido nao comprovada. Validacao O(n^2) nao medida.
- Statistics, SQLite, UI, notificacoes nao implementados; Statistics so com autorizacao.

### Proximo passo
Aguardar revisao. Nao iniciar Statistics.

---

## CHECKPOINT R4 - Saneamento controlado de Cycles (2026-10-10)

### Contexto
O ambiente original foi perdido; os modulos dates, cycles e statistics foram RECONSTRUIDOS (R1 preservou o estado reconstruido; R2/R3 preservaram evidencias de Statistics em claude/*). Esta etapa audita e corrige apenas src/core/domain/cycles. NAO ha prova de que o codigo reconstruido seja igual ao original perdido.

### Estado
- Commit inicial: 85b9d10eaccb84b9278d5a23bf08166d8f8d20e5 (tag pre-cycles-sanitation). Commit final: ver relatorio da etapa / git log (hash registrado no relatorio final, pois um commit nao pode conter o proprio hash).
- Checkpoint antes de modificar: /home/claude/gastrack-snapshots/R4-pre-2026-10-10/ (tarball sha256 9e1fc19c672f96835a417672bfea96f53ede3ac4ae5565f12ec6ce8c82cee515). Snapshots R1/R3 e evidencias R2/R3 nao foram tocados.
- Dates: NAO modificado (sha256 de 10 arquivos identico a linha de base; diff -r vazio; git status limpo para dates).

### Auditoria (lacunas provadas)
- historyFromCycles/addToHistory/updateInHistory/closeInHistory aceitavam sobreposicao (sem regra PD-001).
- Reabertura nao suportada: editCycle(endDate: null) lancava CycleStateError (PD-002).
- Nao existiam history.test.ts nem invariants.test.ts (citados no CHECKPOINT 03); apenas cycle.test.ts, validate.test.ts, isolation.test.ts.
- types.ts, errors.ts, factory.ts, validate.ts, order.ts: sem defeito encontrado alem do tipo CycleChanges.endDate (agora aceita null).

### Alterado
- Criados: src/core/domain/cycles/overlap.ts (cyclesOverlap, assertNoOverlap), history.test.ts (recriado), invariants.test.ts (recriado).
- Modificados: errors.ts (CycleOverlapError), cycle.ts (reopenCycle; editCycle aceita endDate: null), history.ts (build() valida ids unicos, um aberto e nao sobreposicao em TODA operacao; reopenInHistory), index.ts (novas exportacoes), types.ts, cycle.test.ts (teste de reabertura substitui o de "nao suportado"), isolation.test.ts (lista de arquivos inclui overlap.ts).
- Removidos: nenhum arquivo.
- Decisoes registradas em DECISIONS.md: D019 (PD-001) e D020 (PD-002); historico anterior preservado.

### Testes (executados)
- Linha de base antes das alteracoes: npm test = 144 testes, 141 aprovados, 0 reprovados, 3 pulados.
- Depois: npm test = 175 testes, 172 aprovados, 0 reprovados, 3 pulados (pulados = testes de datas dependentes de fuso).
- npm run test:tz: 175 testes em cada um dos 8 fusos, 0 reprovados, resultado OK (pulados: 1 em UTC/Sao_Paulo, 2 nos demais, todos em datas).
- npm run typecheck: sem erros (src sem testes; testes nao foram tipados com shim nesta etapa).
- Verificacao da suite por mutacao em copia descartavel: remover assertNoOverlap -> 10 falhas; trocar < por <= na fronteira -> 20 falhas (detectados).
- Cobertura nova: sobreposicao (tabela de 9 casos, add, edicao, importacao em qualquer ordem), adjacencia, reabertura valida/invalida (outro aberto, ciclo posterior, ja aberto), edicao, remocao, abertos, historico vazio, ordem cronologica, estado original preservado apos falha, 60 sequencias aleatorias x 80 passos com invariantes apos cada passo, 5040 permutacoes.

### Testes recriados x originais
Todos os testes novos desta etapa sao RECRIADOS. Os originais de history/invariants NAO foram recuperados.

### Limitacoes e pendencias
- Fidelidade ao original perdido: nao comprovada.
- Confirmar com o produto: ciclo de zero dia na fronteira/dentro de outro; lacunas entre ciclos continuam aceitas.
- Validacao de historico e O(n^2) por operacao (aceitavel para o volume esperado; nao medido).
- Statistics, SQLite, UI, notificacoes e integracao de IA NAO implementados nesta etapa. Statistics so inicia com autorizacao.
- Commit local nao protege contra perda do workspace; copias em Project (docs) e tarballs fora do repo.

### Proximo passo
Aguardar revisao e confirmacao dos pontos pendentes. Nao iniciar Statistics automaticamente.

---

## CHECKPOINT 03 - Etapa 1b: dominio de ciclos (2026-10-07)

### Estado
Dominio de ciclos implementado e testado. Nada alem de ciclos foi implementado. O modulo de datas (Etapa 1a) nao foi alterado: sha256 de todos os seus arquivos identico ao da linha de base tirada antes da etapa.

### Arquivos
Criados (todos em src/core/domain/cycles/): types.ts, errors.ts, factory.ts, validate.ts, order.ts, cycle.ts, history.ts, index.ts, README.md; testes: cycle.test.ts, validate.test.ts, history.test.ts, invariants.test.ts, isolation.test.ts, test-support.ts.
Modificados: DECISIONS.md (D016-D018 e decisoes pendentes PD-001/PD-002), CHECKPOINT.md.
Nao modificados: src/core/domain/dates/*, package.json, tsconfig.json, scripts/test-tz.mjs (a suite nova entra pelo mesmo glob).

### Implementado
- Ciclo {id, startDate, endDate} (endDate null = aberto), estado derivado, objetos congelados.
- createCycle, closeCycle, editCycle, cycleDuration (delegando a calendarDuration), isOpen/isClosed/cycleStatus, parseCycle (valida registros externos; rejeita campos desconhecidos).
- Historico imutavel: emptyHistory, historyFromCycles, addToHistory, updateInHistory, closeInHistory, removeFromHistory, listCycles, findCycle, getOpenCycle, hasOpenCycle, getClosedCycles, compareCycles.
- Regras 1-8 do enunciado. Ordem cronologica deterministica independente da insercao.
- Ids fornecidos por quem chama (D017); o dominio nao gera ids nem le o relogio.

### Testado (executado)
Comandos, na pasta do projeto:
- `npm test` (TZ=America/Sao_Paulo): 192 testes (77 de datas + 115 de ciclos), 191 aprovados, 0 reprovados, 1 pulado (teste de datas que so vale em UTC).
- `npm run test:tz` (UTC, America/Sao_Paulo, America/New_York, Europe/London, Asia/Kolkata, Pacific/Kiritimati, Pacific/Pago_Pago, Pacific/Auckland): 192 testes em cada, 0 reprovados em todos; pulados: 1 em UTC e Sao_Paulo, 2 nos demais (todos em testes de datas especificos de fuso; ciclos: 0 pulados). Resultado: OK.
- `npm run typecheck` (tsc, src sem testes): sem erros. Testes tipados a parte com shim de tipos do Node (fora do repo): sem erros.
- Cobertura dos casos pedidos: criacao (valida, data invalida, id invalido, ids distintos, nasce aberto, segundo aberto), fechamento (valido, mesmo dia, antes do inicio, data invalida, ja fechado, preserva id, remove estado aberto, nao cria outro), duracao (0, 1, varios dias, virada de mes e ano, bissexto, exemplo oficial 102 dias / 3 meses e 10 dias, aberto com referencia explicita: 46 dias, aberto iniciado "hoje"), edicao (inicio, fim, ambos, aberto -> fechado, datas invalidas, fim antes do inicio, preserva id, atomica), exclusao (fechado, aberto, inexistente, sem corromper os demais), historico (vazio, um, varios, fechados, aberto, dois abertos rejeitados, fora de ordem, busca por id, remocao, edicao), bordas (31/01->01/02, 31/01->01/03, 29/02, 28/02->01/03, 31/12->01/01).
- Invariantes 1-7 verificados apos CADA passo de 300 sequencias aleatorias de 60 operacoes (gerador com semente, sem Math.random e sem relogio), com minimos assertivos de cobertura por tipo de operacao; ordem independente da insercao verificada em todas as 5040 permutacoes de 7 ciclos (adicao e historyFromCycles) e em 200 conjuntos aleatorios x 20 embaralhamentos; ida e volta listCycles -> JSON -> historyFromCycles.
- Isolamento (teste automatico): o modulo nao usa Date, Intl, process, crypto, Math.random, timers, rede, DOM, armazenamento nem node:*; so importa arquivos proprios e ../dates/index.ts; nao reimplementa conta de dias.
- Verificacao da propria suite: 6 erros injetados em copias descartaveis (aceitar 2o aberto; permitir fim antes do inicio; duracao +1 dia; sem ordenar; fechar criando novo ciclo; sem desempate fechado/aberto) foram todos detectados (4, 4, 24, 11, 5 e 4 testes falharam). O original nao foi alterado.

### Validado
O dominio de ciclos atende aos requisitos da etapa, dentro do que foi executado acima. Isto NAO inclui persistencia, UI, Android ou integracao.

### Nao implementado
Estatisticas, previsao, notificacoes, persistencia (SQLite ou outra), exportacao/importacao, geracao real de ids, UI, React, Vite, Capacitor, Android, GitHub Actions.

### Problemas conhecidos
- Nao ha repositorio Git: checkpoint feito SEM commit. GitHub continua sem conta vinculada.
- Na primeira execucao, 4 testes falharam por erro meu de expectativa (comparavam por referencia com o objeto de entrada, mas addToHistory guarda uma copia validada e congelada). Diagnostico confirmado lendo as mensagens (mesma estrutura, referencia diferente); a implementacao nao mudou, os 4 testes passaram a comparar com o historico anterior.
- Na revisao antes de rodar, removi codigo ruim que eu mesmo escrevi (ramo hacky em closeInHistory, funcao interna chamada require, variavel morta, asserções sem sentido nos testes).
- Decisoes de produto pendentes: PD-001 (sobreposicao/consistencia historica e importacao: hoje tudo aceito) e PD-002 (reabrir ciclo fechado: nao suportado).
- Interpretei o campo conceitual "status" do ARCHITECTURE.md como derivado de endDate (D016); ARCHITECTURE.md nao foi editado.
- Escolhas de engenharia revisaveis: id inexistente lanca erro (nao e no-op); cycleDuration de ciclo fechado ignora a referencia; desempates da ordem.
- Testes tipados apenas com shim (nao ha @types/node); testes de fuso dependem da tzdata do sistema; nenhuma dependencia instalada (npm bloqueado).

### Proximo passo
Aguardar sua revisao deste relatorio e a decisao sobre PD-001/PD-002. Nao avancei para outra etapa.

---

## CHECKPOINT 02 - Etapa 1a: dominio de datas (2026-10-07)

### Resumo
Modulo de datas implementado e testado. Nada alem de datas foi implementado.

### Implementado
- src/core/domain/dates/: calendar.ts (isValidDate, parseDate, formatDate, compareDates, daysBetween, toEpochDay interno), duration.ts (calendarDuration), errors.ts (InvalidDateError, InvalidDateRangeError), index.ts (API publica), README.md (regra de meses + dias).
- package.json (sem dependencias), tsconfig.json, scripts/test-tz.mjs (roda a suite em 8 fusos).
- Ciclo aberto: suportado por design (quem chama passa "hoje" como fim); o modulo nao le o relogio. Nao ha tipo de ciclo.

### Testado (executado)
Comandos, na pasta do projeto:
- `npm test` (= node --test "src/**/*.test.ts"), com TZ=America/Sao_Paulo: 77 testes, 76 aprovados, 0 reprovados, 1 pulado (o pulado e o teste que so vale em UTC).
- `npm run test:tz`, 8 fusos (UTC, America/Sao_Paulo, America/New_York, Europe/London, Asia/Kolkata, Pacific/Kiritimati, Pacific/Pago_Pago, Pacific/Auckland): 77 testes em cada; 0 reprovados em todos; pulados: 1 em UTC e Sao_Paulo, 2 nos demais (testes especificos de fuso). Resultado: OK.
- `npm run typecheck` (tsc, src sem testes): sem erros. Testes tipados separadamente com um shim de tipos do Node fora do repositorio: sem erros (nao ha @types/node aqui).
- Cobertura: todos os casos obrigatorios (mesma data, 1 dia, varios dias, ordem invertida, datas/mes/dia/ano/formato invalidos, meses de 28/29/30/31 dias, 31/01->01/02, 31/01->01/03, 30/04->30/05, 31/05->30/06, virada de ano, bissexto, 2024-02-28->02-29, 2024-02-29->03-01, 2023-02-28->03-01), exemplo oficial (102 dias; 3 meses e 10 dias) e borda (29 dias, nao "1 mes e 1 dia").
- Regressao 2018-10-31 -> 2018-11-10: 10 dias em todos os fusos; em America/Sao_Paulo o teste tambem reproduz o calculo ingenuo (9) para provar que o ambiente reproduz o bug.
- Oraculo independente (Date UTC): numero do dia confere em todos os 3.652.059 dias de 0001-01-01 a 9999-12-31; ida e volta de texto em 1900-2200; ultimo dia valido e +1 invalido em todos os anos 1-9999; mais de 400 mil duracoes (inicio de 2023-2025 x 0-420 dias) conferidas por propriedades.
- Isolamento: teste automatico confirma que o codigo do modulo nao usa Date, Intl, process nem require e so importa arquivos relativos.
- Verificacao da propria suite: dois erros injetados em copias descartaveis (calculo ingenuo com Date local; regra com ajuste de fim de mes) foram detectados com falhas. O original nao foi alterado.
- Um teste falhou durante o desenvolvimento por erro meu na expectativa (7670 em vez de 7669 passos). Corrigi derivando o valor do oraculo; a implementacao nao mudou.

### Validado
O dominio de datas atende aos requisitos da etapa, dentro do que foi executado acima. Isto NAO inclui UI, banco, Android ou integracao.

### Nao implementado
Ciclos, estatisticas, previsao, persistencia, exportacao/importacao, UI, React, Vite, Capacitor, SQLite, notificacoes, Android, GitHub Actions.

### Problemas conhecidos
- Nao ha repositorio Git: checkpoint feito SEM commit.
- Nenhuma dependencia instalada (npm bloqueado neste ambiente); a suite roda so com Node 22.22 e o tsc global.
- Testes tipados apenas com shim, nao com @types/node real.
- Os testes sobre fusos dependem da tzdata do sistema.
- Casos de fim de mes alem dos dois exemplos obrigatorios seguem a regra D014 (escolha de engenharia); ex.: 31/05 -> 30/06 aparece so como 30 dias.
- Pendencias da etapa anterior continuam: GitHub nao vinculado; CI nao verificado.

### Proximo passo
Aguardar sua revisao deste relatorio. Depois, o menor passo seguinte do dominio (ciclos de consumo, sem UI nem banco) ou, em paralelo, vincular o GitHub para verificar o esqueleto Capacitor e o APK no CI.

### Regra de continuidade
Ao retomar: ler este arquivo; executar git status; consultar ultimo commit; inspecionar arquivos reais; executar `npm test` e `npm run test:tz`; separar planejado de funcional; continuar do menor proximo passo.

### Hierarquia de verdade
1. codigo real; 2. testes executados; 3. checkpoint; 4. requisitos; 5. decisoes; 6. memoria da conversa.

---

## CHECKPOINT 01 - Validacao tecnica (2026-10-07)

Validacao tecnica executada; relatorio em TECHNICAL_VALIDATION.md. Sem repositorio Git; npm, Maven, Google e Gradle bloqueados; GitHub sem conta vinculada; sem Android SDK. Spike descartavel: datas em UTC (5 testes ok), calculo ingenuo errou em America/Sao_Paulo (9 em vez de 10), SQLite 3.50.4 com migracoes e constraints (3 testes ok). Nao testados: Capacitor, plugins, Android, APK, Actions. Conclusao: arquitetura aprovada com ajustes.


---

## CHECKPOINT 00 - Preparacao

### Estado

Projeto preparado para validacao tecnica.

Nenhuma funcionalidade do aplicativo foi implementada ou validada.

### Implementado

- documentacao inicial;
- escopo V1;
- arquitetura provisoria;
- decisoes iniciais;
- identidade visual;
- regras de continuidade.

### Testado

Nenhum codigo de produto foi testado.

### Validado

Os requisitos iniciais foram organizados.

A arquitetura ainda precisa de validacao tecnica.

### Nao implementado

- aplicativo Android;
- banco;
- telas;
- notificacoes;
- previsao;
- GitHub Actions funcional;
- APK.

### Proximo passo

Validar tecnicamente a stack e o ambiente antes de implementar o produto.

### Regra de continuidade

Ao retomar:

1. ler este arquivo;
2. executar git status;
3. consultar ultimo commit;
4. inspecionar arquivos reais;
5. executar testes;
6. separar planejado de funcional;
7. continuar do menor proximo passo.

### Hierarquia de verdade

1. codigo real;
2. testes executados;
3. checkpoint;
4. requisitos;
5. decisoes;
6. memoria da conversa.