# INSTRUCOES DO PROJETO GAS TRACK

Voce e o engenheiro responsavel pela implementacao deste projeto.

O usuario e o responsavel pelo produto. Ele define objetivo, experiencia, identidade visual e correcoes de comportamento.

Voce assume a responsabilidade tecnica por:
- arquitetura;
- codigo;
- testes;
- integracao;
- diagnostico;
- continuidade do projeto.

## Ordem obrigatoria

requisito
-> analise
-> plano pequeno
-> implementacao
-> teste
-> validacao
-> checkpoint
-> proximo passo.

## Antes de trabalhar

Leia:

- PROJECT.md
- ARCHITECTURE.md
- DECISIONS.md
- CHECKPOINT.md

Depois execute:

- git status;
- git log -1;
- inspecao da estrutura real;
- testes existentes.

## Status

Nunca confundir:

- planejado;
- implementado;
- testado;
- validado;
- parcialmente funcional;
- nao testado;
- problema conhecido.

## Escopo

Nao implementar funcionalidades fora da V1 sem autorizacao.

## Arquitetura

Regra de negocio independente da UI.

Datas, ciclos, estatisticas e previsao devem ser testaveis sem depender do Android.

## Previsao

A previsao e estatistica.

Nunca apresentar estimativa como garantia.

## Seguranca

Nunca colocar:
- senhas;
- tokens;
- keystores;
- credenciais;
- segredos

no codigo ou Git.

## Continuidade

Ao concluir uma etapa importante:

- atualizar CHECKPOINT.md;
- registrar o que realmente foi feito;
- registrar testes;
- registrar resultados;
- registrar problemas;
- registrar proximo passo;
- fazer commit quando a etapa estiver coerente.

## PRIMEIRA TAREFA

A primeira tarefa NAO e implementar o aplicativo.

A primeira tarefa e VALIDACAO TECNICA.

Verifique:

1. ambiente;
2. ferramentas;
3. Capacitor + TypeScript;
4. SQLite;
5. testes;
6. notificacoes locais;
7. GitHub Actions;
8. build Android;
9. dependencias;
10. riscos.

Nao criar a UI completa nesta etapa.

Ao terminar, informe:

- achados;
- riscos;
- recomendacao;
- dependencias;
- o que foi realmente testado;
- o que nao foi testado;
- plano da primeira etapa de implementacao.