# GasTrack

## Status
Projeto em fase de preparacao tecnica.

## Objetivo
Criar um aplicativo Android simples para registrar ciclos de uso de botijao de gas, entender o historico de consumo e estimar quando uma nova troca provavelmente se aproxima.

Perguntas principais:
- Quando coloquei o gas atual?
- Ha quanto tempo ele esta durando?
- Quanto duraram meus ultimos ciclos?
- Qual e meu padrao habitual?
- Estou chegando perto do periodo em que normalmente preciso trocar?
- Meu consumo mudou?

## Produto V1

O aplicativo deve:

- registrar o inicio de cada ciclo;
- registrar o fim de cada ciclo;
- manter historico permanente;
- permitir editar e excluir registros;
- calcular duracao real de calendario;
- calcular total de dias;
- apresentar estatisticas;
- estimar uma janela provavel para a proxima troca;
- emitir notificacoes locais;
- funcionar offline.

## Datas

As datas de consumo usam formato interno YYYY-MM-DD.

Nao utilizar horario ou fuso horario como parte da regra de negocio.

Exemplo:

2026-10-05 ate 2027-01-15
= 3 meses e 10 dias
= 102 dias.

Nunca considerar que um mes possui 30 dias.

Testar:
- mesma data;
- dias consecutivos;
- fim de mes;
- inicio de mes;
- fevereiro;
- ano bissexto;
- virada de ano;
- periodos longos;
- datas invalidas.

## Previsao

A previsao V1 sera estatistica e explicavel.

Nao sera IA generativa.

Hipotese inicial:
- minimo de 4 ciclos concluidos;
- maior peso para ciclos recentes;
- mediana como medida central;
- medicao de variabilidade;
- resultado apresentado como janela aproximada;
- nunca apresentar uma previsao como garantia.

Alertas conceituais:
- aproximando-se do periodo habitual;
- chegou ao periodo habitual;
- consumo recente aparentemente menor que o padrao anterior.

Os limiares numericos devem ser testados antes de serem considerados definitivos.

## Notificacoes

- locais;
- opcionais;
- horario configuravel;
- sem spam;
- no maximo uma notificacao de cada estagio por ciclo.

## Privacidade

V1 nao precisa de:
- login;
- servidor;
- conta;
- nuvem;
- publicidade;
- marketplace;
- localizacao.

## Fora do escopo V1

Nao implementar agora:
- outros consumiveis;
- sincronizacao em nuvem;
- recursos sociais;
- assinaturas;
- fornecedores;
- graficos avancados.

A arquitetura pode permitir evolucao futura sem implementar isso agora.

## Identidade visual

Paleta inicial:

#490038
#940000
#FF4500
#16E000

As quatro cores nao devem ser usadas indiscriminadamente.

Direcao:
- simples;
- domestica;
- moderna;
- clara;
- acessivel;
- sem cara de planilha;
- sem cara de dashboard corporativo;
- sem copiar a identidade do Avalon Calculator.

GasTrack e apenas codinome de desenvolvimento. O nome comercial ainda nao foi definido.

## Regra de verdade

Nunca considerar uma funcionalidade concluida apenas porque existe codigo.

Distinguir:
- planejado;
- implementado;
- testado;
- validado;
- parcialmente funcional;
- nao testado;
- problema conhecido.