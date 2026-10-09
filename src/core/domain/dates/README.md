# Dominio de datas

Datas de consumo sao texto `YYYY-MM-DD` (ano 0001-9999), sem horario e sem fuso.
Nao ha `Date`, `Intl`, relogio nem variavel de ambiente neste modulo: a conta e feita com inteiros (dias desde 1970-01-01, calendario gregoriano). O resultado nao depende do fuso do processo.

## API (importar so de `index.ts`)

| Funcao | O que faz |
|---|---|
| `isValidDate(v)` | `true` se `v` e uma data real no formato exato |
| `parseDate(v)` | `{year, month, day}`; lanca `InvalidDateError` |
| `formatDate(c)` | componentes -> `YYYY-MM-DD`; lanca `InvalidDateError` |
| `compareDates(a, b)` | `-1`, `0` ou `1` |
| `daysBetween(inicio, fim)` | total exato de dias, com sinal (negativo se fim < inicio) |
| `calendarDuration(inicio, fim)` | `{totalDays, months, days, representation}`; lanca `InvalidDateRangeError` se fim < inicio |

## Regra de "meses + dias" (representacao humana)

- `totalDays` e a medida fundamental. Estatisticas e previsao usam so ele.
- Nunca se usa "1 mes = 30 dias" e nunca se ajusta um dia inexistente (31 de fevereiro).
- Aniversario mensal = a mesma data (mesmo dia) em um mes posterior. Mes completo = aniversario que existe no calendario.
- **Inicio nos dias 1 a 28:** o aniversario existe em todo mes. `months` = aniversarios ja alcancados; `days` = dias restantes. Sem nenhum mes completo, `representation = 'days-only'`.
- **Inicio nos dias 29, 30 ou 31:** so ha `'months-days'` quando o fim cai exatamente em um aniversario (mesmo dia, mes posterior), resultando em "N meses e 0 dias". Em qualquer outro caso, `'days-only'`.
- `'days-only'`: `months = 0`, `days = totalDays`; a UI deve mostrar so o total de dias.
- `months` pode passar de 11 (nao ha anos). 12 meses = "12 meses".
- Fim anterior ao inicio: `calendarDuration` lanca erro; `daysBetween` devolve negativo.

### Exemplos (cobertos por testes)

| Inicio -> Fim | Total | Representacao |
|---|---|---|
| 2026-10-05 -> 2027-01-15 | 102 dias | 3 meses e 10 dias |
| 2026-01-31 -> 2026-03-01 | 29 dias | so dias (nunca "1 mes e 1 dia") |
| 2026-01-31 -> 2026-03-31 | 59 dias | 2 meses e 0 dias |
| 2026-04-30 -> 2026-05-30 | 30 dias | 1 mes e 0 dias |
| 2026-05-31 -> 2026-06-30 | 30 dias | so dias |
| 2026-02-01 -> 2026-03-01 | 28 dias | 1 mes e 0 dias |
| 2026-04-01 -> 2026-05-01 | 30 dias | 1 mes e 0 dias |
| 2026-01-01 -> 2026-02-01 | 31 dias | 1 mes e 0 dias |
| 2023-02-28 -> 2023-03-01 | 1 dia | so dias |
| 2026-12-20 -> 2027-01-10 | 21 dias | so dias |

## Ciclo aberto

O modulo nao le o relogio. Para um ciclo aberto, quem chama passa a data de "hoje" (no calendario local do aparelho, ja em `YYYY-MM-DD`) como `fim`. Converter o relogio em data e responsabilidade da camada de aplicacao, fora deste modulo.
