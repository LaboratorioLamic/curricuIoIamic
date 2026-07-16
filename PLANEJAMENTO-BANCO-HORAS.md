# Aba de Banco de Horas — Planejamento

> Complementa `PLANEJAMENTO.md`. Escopo: lançamento mensal de saldo em HH:MM · ciclos de 6 meses
> individuais por funcionário · aba de relatório em Resultados.
>
> **STATUS: implementado (etapas 1–7).**
> Arquivos: `js/bancohoras.js` (aba em Lançamentos), motor em `js/utils.js` (bloco
> `BANCO DE HORAS (CLT art. 59, §2º)`), relatório em `js/resultados.js` (`resBancoHoras`),
> parâmetros em `js/config.js`, sino em `js/notificacoes.js`, seed em `js/seed.js`,
> CSS em `css/pages.css`.

## Quitação × Fechamento — dois atos diferentes

A primeira versão tratou "fechar ciclo" e "pagar horas" como a mesma coisa. **Está errado**, e o
efeito colateral era grave: cada pagamento encerrava o ciclo e reancorava o próximo no mês
seguinte, então o prazo de 6 meses nunca se cumpria — o ciclo virava um contador que zerava a cada
pagamento.

| | **Quitação** | **Fechamento** |
|---|---|---|
| O que é | Pagamento de meses **durante** o ciclo | Encerramento do ciclo |
| Quando | A qualquer momento | Só no **fim do prazo** ou por **desligamento** |
| Efeito no ciclo | Nenhum — continua correndo com o restante | Encerra; o próximo começa no mês seguinte |
| Efeito nos meses | Saem do saldo em aberto e **travam para edição** | — |
| Path | `rh_banco_horas_quitacoes` | `rh_banco_horas_fechamentos` |

`cicloBhFunc` devolve `podeFechar` + `motivoNaoFechar`, e `formFechamentoBh` valida de novo antes
de abrir — regra de negócio não pode viver só no `disabled` de um botão.

### Quita meses inteiros, não um valor livre

O RH marca **quais meses** está pagando. É o que torna o bloqueio de edição preciso: com um valor
solto ("quitei 10h de 23h"), o sistema teria que adivinhar quais meses travar.

Consequências no motor:
- `acumuladoMin` passa a ser o saldo **em aberto** (mês quitado já virou dinheiro). Somá-lo
  contaria duas vezes: uma como horas devidas, outra como reais pagos
- um ciclo com **todos** os meses quitados não prende mais o "ciclo corrente" — não há o que cobrar
- `abertos` / `quitados` / `quitacoes` / `quitadoMin` / `quitadoValor` acompanham o retorno, para a
  tela mostrar as duas leituras sem refazer a conta

### Bloqueio de edição

Mês quitado não é editável na Grade mensal: as horas viraram pagamento, e mudá-las depois faria a
folha divergir do recibo **sem ninguém perceber**. A célula vira texto com o chip `🔒 quitado`
(clicável → abre a quitação). Para corrigir, exclui-se a quitação — ato explícito, reversível, que
devolve os meses ao saldo em aberto e libera a edição.

### Onde a quitação aparece

- **Aba Quitações** (nova): todas as quitações publicadas, tabeladas — a visão de auditoria
- **Janela de situação do ciclo**: abre pela linha da Programação ou pelo card de Ciclos. Mostra o
  saldo em aberto, a trajetória dos 6 meses (quitados com cadeado), as quitações do ciclo e a ação
  disponível (Quitar ou Fechar, conforme `podeFechar`)
- **Folha**: a quitação soma na coluna `heBanco` do mês do **pagamento** — mesma regra do
  fechamento. Uma quitação de jan+fev paga em maio cai na folha de maio

## Integração com a folha (fechamento → hora extra) e Extra Banco

### A folha recebe uma coluna DERIVADA, não uma soma gravada

`rh_folha` ganha a coluna **`heBanco`** ("HE (banco)"), calculada a cada render por
`heBancoDoMes(fid, mês, fechamentos, extras)`:

```
heBanco(mês, funcionário) = Σ fechamentos com destino "Pago como hora extra" e data no mês
                          + Σ lançamentos de Extra Banco com mesRef no mês
```

**Por que não somar na célula `horaExtra` existente:** a folha é uma grade editável. Somado o
fechamento no valor digitado, o número vira uma mistura sem origem — e na primeira vez que o RH
corrigir a parte manual, apaga a parte automática junto. O fechamento continua registrado, a folha
não. Coluna própria e read-only torna isso impossível *por construção*: `heBanco` não está em
`FOLHA_COLS`, então nenhuma célula editável o alcança, e o save usa `patch` (só o campo editado),
então o derivado nunca vaza para o banco.

É a mesma decisão do ciclo (`cicloBhFunc`) e da projeção de ASO: **derivado se autocorrige, gravado
apodrece**.

**Mês de referência = data do fechamento, não fim do ciclo.** O ciclo pode fechar em 31/ago e o
pagamento cair na folha de setembro. Quem manda é quando o dinheiro sai.

**Só "Pago como hora extra" vai para a folha.** "Compensado" e "Perdoado" resolveram-se em horas,
não em reais. "Descontado" tem valor mas é saldo *negativo* — desconto é rubrica de desconto, não
hora extra; somá-lo aqui produziria uma folha que "paga" HE negativa.

**Rastreabilidade:** a célula é um botão. Clicar abre a origem item a item (qual ciclo, qual
feriado, quanto cada um). Número sem origem o RH não assina.

### Valor sugerido no fechamento: `calculoHoraExtra`

Antes o fechamento sugeria `passivoBh` (estimativa agregada, ignora insalubridade). Agora usa
`calculoHoraExtra(f, cargo, params, minutos, adicionalPct)`, que devolve **cada parcela separada**
para a tela mostrar a conta:

```
base = salário (ficha › cargo) + insalubridade (grau do cargo × base configurada)
valor-hora = base ÷ jornadaMensal (ficha › 220 padrão)
valor-hora-extra = valor-hora × (1 + adicional%)
total = horas × valor-hora-extra
```

**Jornada mensal é campo da FICHA (`jornadaMensal`), não parâmetro global.** 220h = 44h semanais é
o divisor mais comum, não uma verdade universal: 40h/semana usa 200, 30h usa 150 — e dois
colaboradores da mesma empresa podem ter contratos de jornada diferente. O valor-hora de cada um
sai do contrato dele. Fica na seção **Contrato** do cadastro (ao lado da admissão), não em
Financeiro: jornada é cláusula contratual, não valor financeiro — quem não tem `ver_financeiro`
precisa enxergá-la. Vazio = 220 (`jornadaDe(f)`), e a memória de cálculo marca "(padrão)" para o RH
saber se o divisor veio da ficha ou de uma suposição do sistema.

O impacto é material: R$ 4.000 a 200h dá valor-hora de R$ 20, contra R$ 18,18 a 220h — **~10% de
diferença** em cada hora extra paga. `passivoBh` também recebe a jornada; sem isso, o passivo de um
contrato de 200h sairia subestimado em toda a aba de Resultados.

A insalubridade integra a base da hora extra (parcela salarial, não indenizatória) — `passivoBh`
ignora isso porque estima risco agregado; aqui, onde o número vira pagamento, a base tem que estar
certa. A **memória de cálculo** aparece na tela linha a linha: um total que surge pronto é um
número que o RH não confere e não defende numa reclamatória.

O cálculo é **congelado** no registro (`calculo: {...}`): promoção posterior mudaria o salário, e um
valor recalculado divergiria do que foi efetivamente pago.

### Sub-aba "Extra Banco"

Hora extra paga **direto**, sem passar pelo ciclo — o caso clássico é o feriado a 100% que a empresa
decide pagar em vez de creditar. Path `rh_extra_banco`.

- **Não toca o banco de horas**: não entra em ciclo, não muda saldo, não adia fechamento. Só soma
  na folha do mês de referência
- **Adicional editável por lançamento** (padrão 50%): o motivo (Feriado/Domingo → 100%, comum →
  50%) *sugere* mas não impõe — quem decide é a convenção da empresa. Configuração global não
  serviria: a mesma empresa paga 50% na terça e 100% no feriado
- **Lança em horas, não em reais**: quem registra pensa "o Felipe fez 4h no feriado". O valor é
  derivado e mostrado com a memória de cálculo — não é campo digitável
- **Retroativo é permitido, nunca em silêncio**: se a folha do mês já existe, confirma avisando que
  o custo apurado vai mudar

## Correções feitas durante a implementação

Registradas porque contradizem o que este documento planejou — o texto acima vale, estas notas
explicam onde ele estava errado.

**1. O ciclo corrente é o mais antigo EM ABERTO, não o do calendário.** O plano dizia
`cicloIndice(mês) = floor(mesesEntre(cicloInicio, mês) / 6)`. Está errado: pular direto para o
bloco de hoje esconde ciclo vencido e não liquidado — exatamente o que vira passivo. Um
funcionário com saldo devido desde 2025 aparecia como **"em dia"**. Um ciclo só sai de cena
quando é fechado (ato explícito) ou quando encerrou zerado. Quatro testes falhando expuseram isso.

**2. `editar_banco_horas` foi descartada.** Banco de horas é lançamento: `ver_lancamentos` /
`editar_lancamentos` já cobrem, e o passivo em R$ cai sob `ver_financeiro`. Seria a única
permissão por-aba do sistema, quebrando o padrão sem ganho.

**3. Sem "gerar grade do mês"** (a folha tem). Pré-gerar linhas zeradas criaria ciclo para quem
não tem acordo de compensação — o ciclo nasce do primeiro lançamento, então a linha zerada teria
efeito colateral silencioso. Pelo mesmo motivo, apagar as duas células remove o registro em vez
de gravar `00:00`, e o placeholder da célula vazia é `–`, não `00:00`.

**4. Cor do saldo:** nem verde/vermelho. Positivo (índigo) = a empresa deve horas; negativo
(âmbar) = o funcionário deve. São direções da mesma conta, não certo e errado. O vermelho ficou
reservado ao que é de fato problema: ciclo vencido sem liquidar.

**5. Barra do ciclo vencido é hachurada,** não sólida — barra cheia lia como "concluído", o
oposto do que significa. Achado na revisão visual, não nos testes.

**6. `null` ≠ zero nas séries mensais (Resultados).** Mês futuro não é "00:00 de hora extra" nem
"0% de compensação" — é ausência de dado. Três consequências:
- `fmtVal(null)` devolve `—`; a linha do acumulado **para** no mês corrente em vez de projetar
  uma reta até dezembro;
- mês sem hora extra não desenha barra de 0% na taxa (acusaria o RH de não compensar o que nunca
  existiu);
- a média da `tabelaMensal` passou a dividir pelos meses **com dado**, não por 12 fixo. Afeta todas
  as abas, mas nenhuma outra passa `null` — comportamento idêntico para elas.

**7. Taxa de compensação do ano = razão dos totais**, não média das taxas mensais: um mês com 2h de
extra não pode pesar igual a um com 200h. No seed de teste a diferença era 24,6% (ponderada) contra
46,0% (aritmética) — a segunda contaria uma história bem mais otimista que a realidade.

**8. Ranking por saldo não reusa `pintarRankingHorizontal`:** ela filtra `val > 0` (o que apagaria
quem *deve* horas — informação real) e rotula "% do total", que não significa nada numa soma de
sinais opostos.

**9. Seed: cenários construídos, não sorteados.** A primeira versão sorteava os valores e confiava
que "extra alta com atraso baixo" produziria um ciclo vencido. Rodando repetidas vezes, execuções
saíam sem o cenário devedor ou sem o vencido — a tela abria toda verde e a aba parecia não fazer
nada. Foram **três causas distintas**, e só a repetição (10 execuções) separou uma da outra:

1. **Valores na média, não por construção.** `extra=rnd(0,60)` contra `atraso=rnd(90,300)` *quase
   sempre* dá negativo. "Quase sempre" não é garantia. Agora cada mês faz `atraso = extra + rnd(…)`
   — negativo isoladamente, não na média. O vencido é o espelho.
2. **A fatia colidia com as demissões.** As demissões do seed consomem os 5 *primeiros*
   funcionários com admissão antiga — exatamente a fatia que o `slice()` do banco de horas pegava.
   O cenário caía num demitido, `cicloBhFunc` devolvia `null` e ele sumia. Corrigido usando a lista
   `ativos` (pós-demissões).
3. **A base de elegíveis variava de 2 a 6.** As datas de admissão são sorteadas; quando sobravam 2
   candidatos "antigos", os índices 2 e 3 do plano não existiam. O filtro de admissão virou
   *preferência* (completa com os demais ativos) em vez de requisito.

**E uma quarta causa que era do teste, não do código:** o stub de `DB.save` fazia *replace* onde o
Firebase real faz `update()` (merge). `DB.save(funcionarios, id, {demissao})` apagava nome e
admissão do registro, e `cicloBhFunc` devolvia `null` por falta de admissão — o teste acusava
cenário ausente que na verdade existia. Um harness que não espelha a semântica do banco produz
falha fantasma e manda consertar o que não está quebrado.

## O problema, e por que ele não é a folha mensal

Banco de horas parece um lançamento mensal como a folha — mês, funcionário, valor. Não é.
A folha **fecha no mês**: dezembro não deve nada a janeiro. O banco de horas **acumula até um
prazo legal** e, se estourar, vira dinheiro: o saldo positivo não compensado é pago como hora
extra com adicional (CLT art. 59, §2º — acordo de compensação com prazo máximo de 6 meses;
por acordo coletivo, até 12).

Consequência: o número que importa não é o saldo do mês, é o **saldo acumulado do ciclo e
quantos dias faltam para ele fechar**. Um mês de +8h é irrelevante sozinho; +8h no quinto mês de
um ciclo que já acumula +40h é uma conta a pagar com data marcada.

### Onde o print de referência erra (e o que herdamos dele)

A imagem anexada organiza tudo em grade **Jan–Dez**. Isso é ano civil, e ano civil não tem nenhuma
relação com o ciclo de banco de horas. Um colaborador cujo ciclo começou em março fecha em agosto —
no gráfico Jan–Dez essa data não existe, é só mais uma barra no meio do eixo. A tela mostra 12
meses de dados e esconde a única data que gera custo.

| Do print, aproveitamos | Descartamos |
|---|---|
| Ranking de colaboradores por saldo (leitura rápida de quem concentra o problema) | Eixo Jan–Dez como espinha dorsal — o eixo correto é o ciclo |
| Barras Extra × Atraso lado a lado (separar crédito de débito, não só o líquido) | Small multiples com 12 rótulos ilegíveis e `0:00` repetido em metade do eixo |
| Filtros de Setor/Unidade no topo | Paginação "Página 5/7" — rolagem com filtro resolve melhor |
| Saldo como série acompanhando as barras | Saldo desenhado na mesma escala das barras mensais (o acumulado tem ordem de grandeza maior) |

O eixo do gráfico de cada pessoa passa a ser **M1..M6 do ciclo dela**, com a data de fechamento
marcada. Quando o RH precisa da leitura calendário, a aba tem alternância — mas o padrão é o ciclo,
porque é o ciclo que vence.

## Decisão de arquitetura: o ciclo é derivado, o saldo é lançado

Segue o padrão já firmado em ASO (`PLANEJAMENTO-ASO.md`) e em Férias (`lancamentos.js:527`):

> *"Nada é gravado: a fila deriva de admissão + férias já lançadas, então nunca diverge da realidade."*

**O que é gravado:** um registro por funcionário/mês com o saldo do mês em minutos.
**O que nunca é gravado:** o ciclo, o acumulado, o vencimento, o status.

O ciclo se calcula assim, a cada render:

```
cicloInicio(funcionário) = mês do primeiro lançamento dele          ← definição do usuário
cicloIndice(mês)         = floor(mesesEntre(cicloInicio, mês) / 6)
cicloFim(n)              = addMeses(cicloInicio, (n+1) * 6) - 1 dia
acumulado(ciclo)         = soma dos saldos dos meses daquele ciclo
```

Por que derivar em vez de gravar um `cicloId` em cada lançamento: se o RH corrigir o primeiro mês
lançado (erro de digitação, lançamento retroativo de um mês anterior), um `cicloId` gravado passa
a apontar para um ciclo que não existe mais, e ninguém percebe até o fechamento. A fórmula se
recalcula sozinha e **nunca mente**. É a mesma razão pela qual o ASO não grava lembrete.

**A âncora é o primeiro lançamento, não a admissão.** Foi o que o escopo pediu, e está certo:
banco de horas nasce de um acordo de compensação, não do contrato. Quem nunca gerou saldo não
tem ciclo — e não deve aparecer como pendência, ao contrário do ASO (lá, quem nunca fez exame é
o caso mais grave; aqui, quem nunca gerou hora extra é o caso ideal).

### Ciclos encadeados

Ao fechar, o ciclo **não zera sozinho**: o saldo restante precisa ser resolvido explicitamente
(compensado, pago ou perdoado) e isso é uma decisão humana, com dinheiro envolvido. O sistema
apura e cobra; não escritura sozinho.

O ciclo seguinte começa no mês seguinte ao fechamento, e o resíduo do anterior aparece na tela de
fechamento como **pendência a liquidar**, não como saldo inicial do novo ciclo. Misturar os dois
apagaria a rastreabilidade de quanto foi pago em cada fechamento — que é exatamente o que uma
fiscalização pede.

## Modelo de dados

### Novo path

Espelha `rh_folha/{ano-mes}/{funcionarioId}` — mesma granularidade, mesma navegação mensal,
mesmo padrão de grade pré-gerada. Reaproveita o modelo mental que o RH já tem da folha.

```
rh_banco_horas/{ano-mes}/{funcionarioId}
```
```js
{
  extraMin,     // minutos de crédito no mês (inteiro ≥ 0)
  atrasoMin,    // minutos de débito no mês (inteiro ≥ 0)
  obs,          // texto livre
  lancadoEm     // ISO — auditoria de quando a linha foi publicada
}
// saldoMin = extraMin - atrasoMin  → derivado, nunca gravado
```

### Fechamentos

```
rh_banco_horas_fechamentos/{id}
```
```js
{
  funcionarioId,
  cicloInicio,     // 'AAAA-MM' — identifica o ciclo sem gravar cicloId nos lançamentos
  cicloFim,        // 'AAAA-MM'
  saldoMin,        // saldo apurado no fechamento (positivo ou negativo)
  destino,         // 'Pago como hora extra' | 'Compensado' | 'Perdoado' | 'Descontado'
  valor,           // R$ — obrigatório quando destino = 'Pago como hora extra'
  data, obs,
  anexos: []       // acordo/recibo — anexos.js, zero código novo
}
```

### Alteração em `rh_parametros`

```js
{
  ...,
  bhCicloMeses: 6,        // 6 (CLT art. 59 §2º) | 12 (acordo coletivo) — default 6
  bhAlertaDias: 45,       // alerta de fechamento próximo
  bhTetoMensalMin: 600,   // teto de 2h/dia × ~21 dias ≈ 42h; default 10h (600min) — 0 = sem teto
  bhAdicionalPct: 50      // % do adicional de HE — só para estimar o custo do saldo não compensado
}
```

Ciclo configurável em vez de fixo em 6: a lei permite 12 por acordo coletivo, e um número mágico
espalhado pelo código é o tipo de coisa que ninguém acha quando o sindicato renegocia. Default 6,
como pedido.

## Por que minutos, e não "HH:MM"

O usuário digita e lê `HH:MM`. O banco guarda **minutos inteiros com sinal**.

Guardar `"08:30"` como string obriga a fazer parsing em toda soma, e `"-00:30"` é uma armadilha
clássica: o sinal pertence ao par, não à hora — quem soma `-0 + -30` acerta o sinal por acidente.
Guardar `8.5` em decimal introduz float onde a fiscalização exige exatidão (`0.1 + 0.2`, o de
sempre). Minutos inteiros somam, comparam e ordenam sem cerimônia, e `HH:MM` vira formatação de
apresentação — que é o que ela é.

**Extra e atraso em campos separados**, não um saldo único: o print acerta nisso. `-2:00` de saldo
pode ser "não fez hora extra e atrasou 2h" ou "fez 20h extra e atrasou 22h". São dois problemas
diferentes, com duas conversas diferentes. O saldo líquido some com a informação.

Helpers novos em `utils.js`, ao lado de `fmtBRL`/`fmtNum`:

```js
fmtHHMM(min)      // -510 → "-08:30"   (sinal antes, sempre 2 dígitos)
parseHHMM(str)    // "-8:30" | "-08:30" | "8h30" | "-510" → -510 | null se inválido
fmtHorasDec(min)  // 510 → "8,5 h"     (só para gráficos: eixo em HH:MM é ilegível)
```

## Estrutura da aba em Lançamentos

```
Lançamentos → Banco de horas
 ├── Programação   fila por urgência (ciclo vencido → fecha em ≤N dias → saldo alto → em dia)
 ├── Grade mensal  mês a mês, linha por funcionário, colunas Extra | Atraso | Saldo | Acumulado
 └── Ciclos        um card por funcionário: barra de progresso do ciclo + histórico de fechamentos
```

Espelha `feriasSub`/`asoSub` (`bhSub = 'programacao' | 'grade' | 'ciclos'`), incluindo os filtros
de unidade/cargo compartilhados (`feriasPassaFiltro` → `bhPassaFiltro`) e o contador de urgência
no rótulo da sub-aba.

**A Grade mensal reaproveita a folha inteira**: navegação de mês (`nav`), edição inline com
salvamento automático, filtros de unidade/cargo, botão "Gerar mês", "Incluir novos", totais no
rodapé. A diferença é o `parseHHMM` na célula e o fato de que a coluna **Acumulado é read-only**
— é derivada, e uma célula editável que se sobrescreve sozinha no próximo render é uma mentira
para o usuário.

### Status do ciclo (mesmo contrato de `situacaoAsoFunc`)

```js
BH_ORDEM  = { vencido: 0, critico: 1, atencao: 2, em_dia: 3, sem_ciclo: 4 }
BH_STATUS = {
  vencido:   { cls: 'badge-danger',  dot: 'st-vencida', txt: 'Ciclo vencido' },
  critico:   { cls: 'badge-warning', dot: 'st-critica', txt: 'Fecha em breve' },
  atencao:   { cls: 'badge-warning', dot: 'st-critica', txt: 'Saldo alto' },
  em_dia:    { cls: 'badge-neutral', dot: 'st-ok',      txt: 'Em dia' },
  sem_ciclo: { cls: 'badge-neutral', dot: 'st-ok',      txt: 'Sem banco' }
}
```

`sem_ciclo` fica **por último** na ordem, ao contrário de `sem_historico` no ASO, que é o primeiro.
A inversão é deliberada e vale a pena registrar: no ASO, ausência de dado é a pior notícia
possível; aqui, é a melhor. Mesmo motor, semântica oposta.

## Aba de Banco de Horas em Resultados

Nova entrada em `RES_TABS`: `{ id: 'bancohoras', label: 'Banco de horas' }`.

O toggle Gráfico/Tabela existente funciona sem alteração — as linhas são montadas no formato de
`tabelaMensal` (`{label, fmt, vals, total}`) e a ponte tabela↔gráfico consome as mesmas linhas.
`fmt` novo: `'hhmm'`, adicionado a `fmtVal` e a `dvValorFmt`.

### Layout

```
┌─ KPIs (faixa de 4) ──────────────────────────────────────────────┐
│ Saldo líquido    Passivo a pagar    Ciclos vencendo   Taxa de     │
│ da empresa       (est. R$)          em ≤45 dias       compensação │
└──────────────────────────────────────────────────────────────────┘
┌─ Empilhado mensal (Extra × Atraso) ──┬─ Ranking por saldo ────────┐
│ + linha de saldo líquido no eixo Y2  │ maior→menor, HH:MM e %     │
│ botão "Legenda" (popover)            │ acompanha a mesma seleção  │
└──────────────────────────────────────┴────────────────────────────┘
┌─ Mapa de ciclos (o gráfico que o print não tem) ─────────────────┐
│ uma linha por colaborador, barra do início ao fim do ciclo dele,  │
│ cor = saldo, losango = data de fechamento. Ordenado por urgência. │
└──────────────────────────────────────────────────────────────────┘
┌─ Small multiples por colaborador (inspirado no print, corrigido) ─┐
│ eixo = M1..M6 DO CICLO, não Jan–Dez. Fechamento marcado.          │
└──────────────────────────────────────────────────────────────────┘
```

**KPIs — o que cada um responde:**

| KPI | Fórmula | Por que existe |
|---|---|---|
| **Saldo líquido da empresa** | Σ saldos de ciclos abertos | O número de capa: a empresa deve horas ou tem horas a receber? |
| **Passivo estimado** | Σ (saldo positivo ÷ 60 × valor-hora × (1 + adicional%)) | Traduz horas em R$ — é o que faz o financeiro prestar atenção. Respeita `ver_financeiro` |
| **Ciclos vencendo** | ciclos com fechamento ≤ `bhAlertaDias` | A janela de ação: depois disso vira pagamento, não compensação |
| **Taxa de compensação** | horas compensadas ÷ horas extras geradas | Mede se o banco está **funcionando como banco** ou virou hora extra disfarçada. Baixa e sustentada = o acordo não está sendo cumprido |

**Mapa de ciclos** é o gráfico que justifica a aba. Ele responde de uma olhada o que o print não
responde em 7 páginas: *quem fecha primeiro, com quanto, e em que ordem eu ligo para os gestores.*
Reaproveita a estrutura de `feriasAgenda` (barra de período por pessoa) com o losango de marco
de `programacaoAso` — as duas peças já existem e já foram testadas.

**Small multiples por colaborador**: mantém a ideia do print (comparação rápida entre pessoas),
mas com eixo do ciclo, rótulo de valor só onde o valor existe (o print imprime `0:00` doze vezes),
e limite de 12 cards por vez com filtro — em vez de paginação numérica.

### Filtros popover

Padrão já implementado (`openMultiPopover` em `resultados.js`, `feriasFiltrosHtml` em
`lancamentos.js`):

- **Unidade** e **Cargo** — multi-seleção, espelham os filtros de férias/ASO
- **Status do ciclo** — vencido / crítico / atenção / em dia
- **Faixa de saldo** — positivo / negativo / zerado
- **Legenda** do empilhado — marca/desmarca séries, com restaurar

Todos com contador no botão quando ativos e "Limpar" — como já fazem os existentes.

## Etapas de implementação

### Etapa 1 — Fundação de dados
- `PATHS.bancoHoras = 'rh_banco_horas'` e `PATHS.bancoHorasFechamentos = 'rh_banco_horas_fechamentos'`
- Parâmetros `bhCicloMeses` (6), `bhAlertaDias` (45), `bhTetoMensalMin`, `bhAdicionalPct` em
  Configurações → Parâmetros, ao lado de `asoAlertaDias`
- Permissão `editar_banco_horas`; leitura sob `ver_lancamentos`. Passivo em R$ sob `ver_financeiro`

### Etapa 2 — Motor (`utils.js`)
Bloco novo `============ BANCO DE HORAS (CLT art. 59) ============`:
- `fmtHHMM` / `parseHHMM` / `fmtHorasDec` — helpers de formatação
- `bhParams` / `setBhParams` — espelha `asoParams`
- `cicloBhFunc(f, lancamentos, ref)` → `{ inicio, fim, indice, acumuladoMin, meses[], status, dias, label, desc }`
  — **mesmo contrato de retorno de `situacaoAsoFunc`**, para reusar fila, badges e dots
- `BH_ORDEM` / `BH_STATUS`
- `historicoCiclosBh(f, lancamentos, fechamentos)` → todos os ciclos, fechados e aberto
- `passivoBh(saldoMin, salario, params)` → estimativa em R$

### Etapa 3 — Sub-aba Grade mensal
- `js/bancohoras.js`: `renderLancBh` clonando a estrutura de `renderFolhaGrid`
- Célula com `parseHHMM` + validação de teto (`bhTetoMensalMin`) → aviso, não bloqueio
  (teto excedido acontece de verdade; o sistema informa, o RH decide)
- Coluna Acumulado read-only, recalculada no `input`

### Etapa 4 — Sub-aba Programação
- Fila por `BH_ORDEM`, KPIs no topo (espelha `prog-resumo`)
- Botão "Fechar ciclo" → `formFechamentoBh` com saldo pré-calculado e anexo do acordo

### Etapa 5 — Sub-aba Ciclos
- Card por funcionário: barra de progresso M1..M6, saldo corrente, fechamento previsto
- Histórico de fechamentos com destino e valor pago

### Etapa 6 — Aba em Resultados
- `RES_TABS` + `resBancoHoras(cont)` seguindo `resEventos` como modelo
- `fmt: 'hhmm'` em `fmtVal` e `dvValorFmt`
- Mapa de ciclos (`feriasAgenda` + losango de `programacaoAso`)
- Entradas em `RES_EXPLICACOES` para cada indicador novo — a aba inteira é conceito novo para
  quem lê, e um KPI de banco de horas sem explicação é um número que ninguém confia

### Etapa 7 — Notificações, seed e validação
- `refreshNotificacoes` ganhou `diagnosticoBh` → "N ciclo(s) vencido(s) · N fechando". Fica **após
  o ASO** no sino: ASO vencido impede a pessoa de trabalhar hoje; ciclo vencido custa dinheiro.
  Grave, mas de outra natureza — daí o âmbar em vez do vermelho
- Seed com cenários construídos (vencido, fechado com pagamento, devedor, correntes saudáveis) —
  ver correção nº 9 acima
- Limpeza do seed reusa o mesmo `limpaMensal` da folha: remove só os funcionários de exemplo e
  apaga o mês se ficar vazio, nunca o mês inteiro (pode haver lançamento real do RH ali)

**Pendente:** seção de banco de horas no drawer do funcionário (o histórico individual já está na
sub-aba Ciclos; no drawer seria conveniência, não lacuna).

## Verificação executada

Tudo rodado no Chrome headless contra o código real — não há Node nem Python nesta máquina, e o
projeto é site estático, então o navegador é o ambiente de produção de qualquer forma.

| O que | Como | Resultado |
|---|---|---|
| Motor (`cicloBhFunc`, `parseHHMM`, aritmética de mês, `passivoBh`) | 49 asserções, incluindo virada de ano, fev bissexto, retroativo que reancora, desligado com saldo, mês futuro | **49/49** |
| Aba em Lançamentos (3 sub-abas) | render com 6 funcionários cobrindo todos os status | sem erros; revisão visual dos 3 prints |
| Aba em Resultados (gráfico e tabela) | render nos dois modos + inspeção célula a célula da tabela mensal | sem erros; `—` nos meses futuros confirmado |
| Ponte BH → folha + jornada | 22 asserções: destinos que somam vs. não somam, isolamento por mês, não-mutação do gravado, `calculoHoraExtra`, `jornadaDe` | **22/22** |
| Quitação × fechamento | 28 asserções: `podeFechar` (em curso / vencido / desligado), abate de meses sem encerrar ciclo, bloqueio de edição, ciclo todo quitado não prende o corrente, quitação na folha | **28/28** |
| Seed (gerar + limpar) | **10 execuções** verificando presença dos 3 cenários e ausência de lixo após limpar | **10/10**, 0 registros órfãos |

**Não verificado:** o caminho de escrita contra o Firebase real (salvar célula, fechar ciclo,
lançar Extra Banco, anexar documento) foi exercitado contra stubs em memória, não contra o banco de
produção.

**Suíte de teste:** movida para o scratchpad da sessão (fora do repo). Quatro arquivos —
`bh-test.html` (motor), `bh-folha-test.html` (ponte), `bh-res-test.html` (Resultados),
`bh-seed-test.html` (seed) e `bh-ui-test.html` (abas). Rodam com
`chrome --headless=new --dump-dom <arquivo>`, sem servidor. Valem como suíte permanente se alguém
quiser trazê-los para o repo, em pasta própria.

## Riscos e decisões

| Risco | Mitigação |
|---|---|
| Lançamento retroativo antes do primeiro mês reancora o ciclo inteiro | É o comportamento correto (o ciclo começa no primeiro lançamento *que existe*), mas é surpreendente. Aviso explícito no save: "isso move o início do ciclo de X para Y" |
| `lancamentos.js` já tem ~2.000 linhas | **`js/bancohoras.js` separado**, como `aso.js`/`anexos.js` |
| Funcionário desligado com saldo aberto | Rescisão obriga pagamento do saldo (CLT art. 59 §3º). `cicloBhFunc` retorna status `vencido` na demissão, independente do prazo — aparece na fila até ter fechamento |
| Saldo negativo grande vira desconto em rescisão | Fora de escopo: o sistema apura e sinaliza, o desconto é decisão jurídica. `destino: 'Descontado'` registra o que foi decidido |
| Ciclo de 6 meses é limite do acordo individual | Configurável (`bhCicloMeses`); acordo coletivo permite 12 |
| Mês sem lançamento no meio do ciclo | Conta como zero, não interrompe o ciclo. O ciclo é tempo decorrido, não contagem de lançamentos — mesma lógica do aquisitivo de férias (`utils.js:96`) |

## Fórmulas-chave

- **Início do ciclo** = mês do primeiro lançamento do funcionário (derivado, nunca gravado)
- **Fim do ciclo** = `addMeses(cicloInicio, bhCicloMeses)` − 1 dia
- **Saldo do mês** = `extraMin − atrasoMin`
- **Acumulado do ciclo** = Σ saldos dos meses de `cicloInicio` até o mês corrente
- **Crítico** = fechamento em ≤ `bhAlertaDias` (default 45) **com saldo ≠ 0**
- **Atenção** = saldo positivo > `bhTetoMensalMin × meses restantes` (não dá mais para compensar
  dentro do ciclo, mesmo estourando o teto todo mês → o pagamento já é inevitável)
- **Passivo estimado** = `saldoMin ÷ 60 × (salário ÷ 220) × (1 + bhAdicionalPct/100)`
- **Taxa de compensação** = `Σ atrasoMin ÷ Σ extraMin` no período
