# Sistema de RH LAMIC — Planejamento

> Documento de planejamento aprovado em 13/07/2026. Substitui integralmente o site de currículos.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Infraestrutura | Reaproveitar Firebase Realtime DB existente (`curriculolamic`), paths novos `rh_*`. Site estático, sem servidor. |
| Login | Usuário+senha próprios (hash SHA-256), cadastrados em Configurações. Primeiro acesso cria admin padrão. |
| Receita | Lançamento mensal manual (valor bruto do mês). |
| Experiência | Aprovação automática: 90 dias sem demissão por término/rescisão de experiência. |
| Multi-unidade | Filtro global "Todas / Unidade X" no topo — afeta Dashboard e Resultados. |
| Encargos | % padrão configurável, valor sugerido automaticamente sobre salário, editável por funcionário/mês. |
| Design | Tema claro premium: sidebar escura, acento índigo, cards com sombra suave, micro-animações, popovers, toasts. |
| Folha | Grade mensal pré-gerada: ao abrir o mês, linha por funcionário ativo com salário do cargo + benefícios + encargos preenchidos; RH ajusta exceções. |
| Benefícios | Custo titular + custo por dependente (ex: plano saúde R$300 + R$180/dep). Total auto na folha. |
| Dados exemplo | ~20 funcionários fictícios + 12 meses de lançamentos para validar KPIs. Botão admin "Limpar dados de exemplo". |

## Módulos (sidebar)

1. **Dashboard** — visão executiva
2. **Funcionários** — fichas + benefícios
3. **Lançamentos** — ausências, demissões, treinamentos, promoções
4. **Folha & Custos** — folha mensal + receita
5. **Resultados** — indicadores consolidados anuais
6. **Configurações** — usuários, cargos, unidades, benefícios, parâmetros (só admin)

## Etapas de construção

### Etapa 0 — Fundação
- Limpar site atual, estrutura SPA (sidebar + roteamento por hash)
- Design system: tokens de cor/tipografia, componentes (card, botão, modal, popover, toast, tabela com busca/filtro/ordenação, drawer, badge, tabs)
- Tela de login + sessão (sessionStorage) + guard de permissões
- Chart.js para gráficos

### Etapa 1 — Configurações
- **Usuários**: nome completo, login, CPF (validação dígitos), senha+confirmação (hash), status ativo/inativo, admin S/N, permissões
- **Permissões** (matriz):
  - `ver_*` por módulo: dashboard, funcionários, lançamentos, folha, resultados
  - `editar_*`: funcionários, lançamentos, folha
  - `ver_financeiro`: sem ela, valores de salário/custo ficam ocultos em todas as telas
  - Configurações inteira = só admin (dados mestres alimentam todos os KPIs)
- **Cargos**: nome, tipo (Operacional / Administrativo / Gestão / Estágio / Diretoria), salário base
- **Primeiro acesso**: sem usuários no banco → tela de criação do primeiro administrador (sem senha padrão)
- **Unidades**: nome, endereço, CNPJ (validação), headcount recomendado → alerta de **equipe incompleta** no dashboard quando ativos < recomendado
- **Benefícios**: nome, tipo, custo titular, custo por dependente
- **Parâmetros**: % encargos padrão, dias de experiência (default 90), salário mínimo vigente
- **Insalubridade**: grau por cargo (0/10/20/40%) × base configurável em Parâmetros (salário do funcionário [padrão] ou salário mínimo) → coluna própria na folha; encargos incidem sobre salário + insalubridade
- **Benefícios — coparticipação**: cada benefício tem % descontado do funcionário (0–100%); folha registra custo total + desconto; custo da empresa = total − desconto
- **Treinamentos**: responsável, custo, data de pagamento e parcelas — custo entra nos relatórios pelo regime de parcelas (mês a mês)
- **Documentos do colaborador**: aba Documentos no drawer (certificados vinculados a treinamentos, contratos, ASO etc.) — metadados prontos; upload aguarda configuração do armazenamento
- **Estrutura**: grade da folha e receitas são lançadas em Lançamentos; a página Folha & Custos é um relatório 100% leitura (visão mensal + anual)

### Etapa 2 — Funcionários
- Ficha: nome, sexo, nascimento, escolaridade, cargo (select de Cargos), unidade (select), contato, vestimenta (PP–GG), admissão, demissão (auto ao lançar desligamento), tempo de empresa auto, status auto (ativo/desligado)
- Benefícios do funcionário: adesão a benefícios do catálogo + dependentes por benefício
- UI: grid de cards com foto/avatar de iniciais, busca, filtros (unidade, cargo, status), drawer lateral de detalhe com abas (Dados | Benefícios | Histórico)
- Histórico do funcionário: promoções, ausências, treinamentos (alimentado pelos Lançamentos)

### Etapa 3 — Lançamentos
- **Ausências** (férias/faltas/licenças): funcionário, motivo, início, retorno, dias auto-calculados
- **Demissões**: funcionário, data, motivo (lista fixa: pedido de demissão · dispensa sem justa causa · dispensa com justa causa · término de contrato de experiência · rescisão antecipada por empregador · rescisão antecipada por empregado · falecimento · outro), observações → atualiza ficha (data demissão + status)
- **Treinamentos**: nome, tipo, carga horária, início, término, participantes (multi-seleção) → horas totais = carga × participantes
- **Promoções**: funcionário, data, cargo anterior/salário antigo puxados da ficha, cargo novo/salário novo, % de aumento auto → atualiza ficha; folha dos meses seguintes usa salário novo

### Etapa 4 — Folha & Custos
- Grade mensal (mês/ano seletor): linha por funcionário ativo
  - Colunas: salário, bolsa estágio, pró-labore, férias, 13º, encargos (auto %), hora extra, convênios, outros, benefícios (auto do catálogo+dependentes, editável)
  - Pré-preenchimento pelo cargo/benefícios; edição inline
- **Receita**: lançamento mensal simples (mês + valor bruto)

### Etapa 5 — Dashboard
- Filtro global de unidade + seletor de ano
- Rotatividade: gráfico mensal admissões × demissões × turnover %
- Motivos de desligamento (donut)
- Headcount fim de mês (linha)
- Equipe: escolaridade, tipos de cargo, sexo, faixa etária (18–25, 26–35, 36–45, 46–55, 56+), treinamentos
- Financeiro: receita × custos (barras mensais) — respeita `ver_financeiro`
- Alertas: unidade acima do headcount recomendado

### Etapa 6 — Resultados consolidados
Abas com seletor de ano; tabelas mensais Jan–Dez + Média + Total:
- **Geral**: média de permanência, admissões, demissões, total de funcionários, índice de aprovação pós-experiência, turnover; indicadores de treinamento (horas totais, média por treinado, nº treinados); custos (hora extra, folha total, % treinamento/folha, custo médio por treinado, % benefícios/folha, custo benefícios, custo médio benefícios/funcionário, receita por funcionário, custo médio folha/funcionário)
- **Rotatividade**: resumo mensal (contratações, desligamentos, variação, início/fim do mês, turnover %) + detalhamento por motivo de desligamento
- **Perfil da equipe**: escolaridade, tipo de cargo, sexo
- **Eventos RH**: promoções (mensal), férias/faltas/licenças (mensal)
- **Receitas & Custos**: receitas brutas, receita média/funcionário, custo médio/funcionário, folha, benefícios, promoções, encargos, outros, diferença receita−custo + detalhamento mensal por benefício cadastrado

### Etapa 7 — Revisão e validação
- Seed de dados de exemplo (20 funcionários, 12 meses)
- Conferência cruzada de cada KPI contra cálculo manual
- Teste de permissões por perfil
- Botão "Limpar dados de exemplo"

## Fórmulas-chave

- **Turnover mensal** = ((admissões + demissões) / 2) ÷ headcount médio do mês × 100
- **Headcount fim do mês** = ativos com admissão ≤ fim do mês e (sem demissão ou demissão > fim do mês)
- **Média de permanência** = média de (demissão ou hoje − admissão) dos funcionários do ano
- **Aprovação experiência** = admitidos há ≥90 dias sem desligamento por motivo de experiência ÷ admitidos há ≥90 dias
- **Custo benefício do funcionário** = custo titular + (nº dependentes × custo por dependente)
- **% aumento promoção** = (salário novo − antigo) ÷ antigo × 100

## Mapa de conexões

```
Cargos ──salário base──▶ Folha (pré-preenchimento)
Benefícios ──custo──▶ Funcionário (adesão+dependentes) ──▶ Folha (coluna auto) ──▶ Resultados
Demissão ──▶ Ficha (status/data) ──▶ Turnover, Motivos, Headcount, Permanência
Promoção ──▶ Ficha (cargo/salário) ──▶ Folha meses seguintes + Custo promoções
Treinamento ──▶ Histórico funcionário + KPIs de treinamento + % sobre folha
Ausências ──▶ Histórico + Eventos RH mensal
Receita + Folha ──▶ Dashboard financeiro + Receitas & Custos
Unidade ──▶ filtro global de tudo
```

## Estrutura Firebase (paths)

```
rh_usuarios/ rh_funcionarios/ rh_cargos/ rh_unidades/ rh_beneficios/
rh_ausencias/ rh_asos/ rh_demissoes/ rh_treinamentos/ rh_promocoes/
rh_folha/{ano-mes}/{funcionarioId}  rh_receitas/{ano-mes}  rh_parametros/
rh_banco_horas/{ano-mes}/{funcionarioId}  rh_banco_horas_fechamentos/
```

## ASO — Atestado de Saúde Ocupacional (NR-7)

Aba própria em Lançamentos. Planejamento detalhado em `PLANEJAMENTO-ASO.md`.

- **Periodicidade** por cargo (`asoPeriodicidadeMeses`: 6/12/24) — critério médico (PCMSO),
  independente do grau de insalubridade, que é critério trabalhista
- **Projeção derivada, nunca gravada**: `último ASO + periodicidade`, recalculada a cada render.
  Lembrete gravado apodrece quando o exame antecipa ou o cargo muda; fórmula se autocorrige
- **5 tipos**: Admissional e Periódico reiniciam o ciclo; Demissional, Retorno ao trabalho e
  Mudança de risco são pontuais e disparados por eventos já registrados no módulo
- **`ver_medico`** (grupo Sensível): sem ela, prazos e fila continuam visíveis, conteúdo
  clínico não — dado de saúde é categoria especial na LGPD (art. 11)

## Férias (CF art. 7º XVII, CLT arts. 129-145)

- **A competência fecha por DIAS, não por número de lançamentos**. `situacaoFeriasFunc` contava
  `gozadas.length`: 15+15 avançava **dois** ciclos aquisitivos (a pessoa "gozava" 2 anos com 30 dias),
  e um único período de 15 dias encerrava a competência com metade em aberto — apagando da tela o
  risco de dobra que ainda existia. Agora cada lançamento despeja dias na competência aberta mais
  antiga; ela só fecha em `diasPorCiclo`, e o excedente transborda para a seguinte
- **Fracionar divide o direito, não o multiplica** (art. 134 §1º): com a competência pela metade, o
  prazo legal continua correndo sobre o que falta — `concessivoFim` de quem gozou 15 dias é idêntico
  ao de quem não gozou nada
- **Abono conta para a competência** (art. 143): quem vende 10 dias não os goza, mas eles saem do
  direito do mesmo jeito. Ignorá-los deixaria a competência eternamente incompleta para quem vendeu
- **Gozo antecipado não cria ciclo aquisitivo**: `Math.min(completas, ciclosCompletos)` — o tempo de
  casa é que gera o direito
- **Retorno = dias corridos, nunca `addMeses(inicio, 1)`** (art. 130): um mês de calendário dá 28
  dias em fevereiro (o funcionário perde 2 e a competência nunca fecha) e 31 em julho
- **Teto do lançamento = direito em aberto** (`tetoDiasFerias`): 30 dias, salvo competências
  atrasadas acumuladas — aí são 30 × competências em aberto (art. 137, o empregador que não concedeu
  no prazo deve). Passar de 30 sem atraso é quase sempre erro de digitação na data de retorno
- **Ponte com a folha — coluna derivada** (`feriasCalc`), mesma arquitetura do `heBanco`: a coluna
  "Férias" manual continua editável porque convenção coletiva muda o cálculo, e o RH precisa de um
  lugar para o ajuste que o próximo render não apague. Mês de referência = **início** das férias
  (art. 145: pagamento até 2 dias antes) — dividir um período que atravessa o mês entre duas folhas
  divergiria do recibo, que é único
- **Adiantamento do 13º sai na coluna 13º**, não na de férias (Lei 4.749 art. 2º §2º): são rubricas
  distintas no holerite, e juntá-las faria o custo de férias parecer 50% maior do que é
- **Média de HE lê a mesma fonte da folha** (banco de horas + Extra Banco, Súmula 45 TST): se viesse
  de outro lugar, o sistema teria duas respostas para "quanto de extra ele recebeu". Média sobre os
  meses do aquisitivo, não só os meses COM extra — dividir pelos meses com valor inflaria a base.
  **Desligável** (`feriasMediaHe`): é o único item cuja regra varia por convenção coletiva
- **Memória de cálculo congelada** no lançamento: promoção posterior não reescreve o que já foi pago
- **Janela de competências** (clique na linha da Programação): a tabela mostra só a competência
  CORRENTE — as vencidas e não gozadas continuam existindo e devendo. `competenciasFerias` enumera
  todas pela mesma régua derivada (12 em 12 meses desde a admissão), com o estado de cada uma
  (`gozada` / `vencida` / `vigente` / `formacao`) e quais lançamentos a tocaram. Mesma relação de
  `ciclosAbertosBh` com `cicloBhFunc` no banco de horas
- **Fracionada vencida não é "gozada"**: 15 de 30 é competência aberta. E a **dobra do art. 137
  incide sobre o que falta conceder**, não sobre a competência inteira — quem gozou 20 de 30 deve
  10, não 30

## Banco de horas (CLT art. 59, §2º)

Aba própria em Lançamentos + aba de relatório em Resultados. Planejamento detalhado em
`PLANEJAMENTO-BANCO-HORAS.md`.

- **Ciclo de 6 meses individual**, ancorado no **primeiro lançamento** do funcionário (não na
  admissão): o banco nasce do acordo de compensação, não do contrato. Configurável
  (`bhCicloMeses`) — acordo coletivo permite 12
- **Ciclo derivado, nunca gravado**: `mês do 1º lançamento + N meses`, recalculado a cada render.
  `cicloId` gravado apodrece quando um lançamento retroativo reancora o ciclo. Mesma decisão do ASO
- **O ciclo corrente é o mais antigo AINDA EM ABERTO**, não o bloco do calendário de hoje: saltar
  para o bloco atual esconderia um ciclo vencido e não liquidado — que é exatamente o que vira
  passivo. Um ciclo só sai de cena quando é fechado ou quando encerrou zerado
- **Saldo em minutos inteiros com sinal**; `HH:MM` é formatação de apresentação. Extra e atraso em
  campos separados — o saldo líquido esconde qual dos dois problemas existe
- **Quitação ≠ fechamento**: **quitação** paga meses *durante* o ciclo (os meses saem do saldo em
  aberto e travam para edição; o ciclo continua correndo com o restante).
  **Fechamento** encerra o ciclo — e só pode ocorrer no fim do prazo ou por desligamento. Tratar os
  dois como um só fazia cada pagamento reancorar o ciclo, e o prazo de 6 meses nunca se cumpria
- **Mês quitado é imutável**: as horas viraram pagamento; editá-las faria a folha divergir do
  recibo em silêncio. Para corrigir, exclui-se a quitação — e os meses voltam ao saldo em aberto
- **Quitação tem destino, valor pago e valor sugerido**. O *sugerido* é a conta do sistema; o *pago*
  é o que saiu do caixa. São campos separados porque a diferença entre eles é decisão humana — e é
  o que uma auditoria vai querer ver justificado. Digitar o pago congela o campo: recalcular por
  troca de % apagaria o valor negociado
- **Só dois destinos na quitação** (`BH_DESTINOS_QUITACAO`): "Pago como hora extra" e "Descontado".
  "Compensado" (virou folga) e "Perdoado" resolvem o saldo em horas — quitar significa pagar, e
  oferecê-los registraria um pagamento que não existiu
- **Só "Pago como hora extra" vira HE na folha**. "Descontado" também move dinheiro, mas no sentido
  oposto: é rubrica de desconto, e somá-lo como HE produziria hora extra negativa. Pelo mesmo
  motivo `quitadoValor` e `quitadoDescontado` são campos distintos — um total único somando os dois
  não responderia nem "quanto saiu do caixa" nem "quanto foi devolvido"
- **Default retroativo** (`destinoQuitacao(q)`): quitação gravada antes do campo `destino` existir é
  pagamento de HE — era o único comportamento possível na época, e o valor já somava na folha. Sem o
  default, toda quitação antiga sairia da folha em silêncio
- **Vencido e vigente coexistem** (`ciclosAbertosBh`): enquanto o RH não liquida o ciclo de trás, o
  funcionário segue lançando no da frente. `cicloBhFunc` devolve UM ciclo (a prioridade de
  cobrança); retornar só ele fazia a tela esconder o outro. Não é ciclo "novo" — a régua derivada já
  os continha; a função só para de escondê-los
- **Bloco vazio da régua não é ciclo**: a régua se estende até hoje, mas um intervalo sem nenhuma
  hora publicada não é acordo de compensação em curso — mostrá-lo anunciaria um ciclo que ninguém
  abriu. Com lançamento, o ciclo do calendário aparece mesmo zerado: é onde as horas de hoje caem
- **Aba Histórico na janela do ciclo**: `historicoCiclosBh` já existia e já era testada, mas nenhuma
  tela a chamava. A aba mostra todos os ciclos do funcionário (fechado / em curso / em aberto /
  encerrado sem saldo) — é onde o ciclo vencido não-fechado fica visível ao lado do vigente
- **Reabrir ciclo = excluir o fechamento** (`podeReabrirCicloBh`), para retificar erro. Só enquanto
  não houver horas lançadas depois do ciclo: elas pertencem ao ciclo seguinte e reabrir criaria dois
  ciclos abertos sobrepostos. Sem essa saída, o RH "corrigiria" criando um fechamento por cima,
  dobrando o valor na folha. O valor sai da folha sozinho (derivado se autocorrige) e as quitações
  do ciclo sobrevivem — aqueles meses foram pagos de verdade; só o fechamento foi o erro
- **Fechamento é ato explícito**: o ciclo não zera sozinho. Saldo não compensado vira pagamento com
  adicional — é dinheiro, exige decisão humana registrada (`rh_banco_horas_fechamentos`)
- **Eixo do ciclo, não Jan–Dez**: ano civil não tem relação com o ciclo. Grade calendário mostra 12
  meses e esconde a data que gera custo
- **Ponte com a folha — coluna derivada, não soma gravada**: fechamentos pagos e lançamentos de
  Extra Banco alimentam a coluna `heBanco` ("HE (banco)"), read-only, recalculada a cada render. A
  célula "Hora extra" manual continua intocada — somar as duas faria a primeira correção manual
  apagar o que o sistema lançou. Mês de referência = data do pagamento, não fim do ciclo
- **Perfil de remuneração do cargo ≠ tipo de cargo**: `tipo` (Operacional/Administrativo/Gestão/…)
  é classificação organizacional e alimenta os gráficos do Dashboard; `perfil`
  (Funcionário/Estagiário/Diretor) decide só QUAIS verbas o cargo tem. Antes existia **um campo
  `salario` que mudava de significado conforme o tipo** — o mesmo número virava bolsa, pró-labore ou
  salário, e por isso um diretor não conseguia ter salário base *e* pró-labore. `perfilCargo` migra
  os cargos antigos pelo tipo (Estágio→estagiario, Diretoria→diretor, resto→funcionario)
- **`usaSalarioMinimo` grava a intenção, não o valor** (`salarioBaseCargo`): quando o mínimo muda em
  Parâmetros, todo cargo marcado acompanha sozinho. Gravar o número faria cada reajuste exigir
  reabrir e salvar cargo por cargo — e nada avisaria os defasados. Mesmo princípio do `heBanco` e do
  `feriasCalc`: derivado se autocorrige
- **`salarioDe` é o ponto único** de resolução (funcionário → cargo → mínimo). Antes cada arquivo
  resolvia à sua maneira, e **`bancohoras.js` e `resultados.js` liam `cargo.salarioBase` num form que
  só gravava `cargo.salario`** — nunca achavam o valor, e o passivo de quem não tinha salário
  individual saía zerado
- **Bolsa de estágio não gera insalubridade nem encargos** (Lei 11.788: bolsa não é salário).
  **Pró-labore fica fora da base de encargos**: é remuneração de sócio, com regime de contribuição
  próprio — somá-lo inflaria o encargo com uma base que não é dele
- **Coparticipação abate o benefício, não o bruto** (`descontoEfetivoLinha`): o desconto só pode
  reduzir aquilo que ele custeia. `totalLinha = brutoLinha − descontoLinha` criava economia do nada
  — R$ 100 de coparticipação numa linha sem benefício derrubava o custo de 3.000 para 2.900, como se
  o funcionário tivesse pago parte do próprio salário de volta. Ele não pagou: a coparticipação sai
  do líquido dele, e o bruto continua custando o mesmo. O teto é o valor do benefício, e
  `beneficioLinha` tem piso zero (benefício 440 com desconto 600 custa 0, não −160). A coluna
  continua mostrando o **lançado**; um `*` marca a linha onde lançado ≠ efetivo
- **Coluna "Hora extra" manual aposentada**: com HE (banco) cobrindo o ciclo e Extra Banco cobrindo
  o resto, ter as duas convidava ao lançamento em dobro — o mesmo dinheiro digitado à mão e postado
  pelo sistema. O campo (`FOLHA_HE_MANUAL`) sai de `FOLHA_COLS` mas **continua somando** em
  `brutoLinha`: apagá-la do total mudaria retroativamente o custo de um mês já fechado, e um
  relatório anual passaria a divergir de si mesmo sem ninguém ter editado nada. Aparece read-only
  só nos meses que já têm valor. **Cuidado ao mexer**: `heBanco` era posicionado com
  `splice(iHE + 1)` — sem `horaExtra`, o `findIndex` devolve −1 e a coluna derivada pularia para
  antes de "Salários". A âncora agora é "encargos"
- **Resultados injeta as colunas derivadas**: `resultados.js` lia a folha crua — sem `heBanco`, sem
  `feriasCalc` — e nem carregava `extraBanco`. O relatório anual subestimava a hora extra desde que
  a ponte foi criada: a folha mensal e o relatório mostravam números diferentes para a mesma empresa
- **Setters de parâmetros recebem o conjunto inteiro**, não só o card salvo: `setFeriasParams(novos)`
  no card de Parâmetros zerava dias/terço/abono para o padrão até o próximo reload — a mesma classe
  de erro que o spread do `DB.set` evita no path
- **Extra Banco** (sub-aba): hora extra paga direto, fora do ciclo — feriado a 100%, domingo,
  plantão. Adicional editável por lançamento (padrão 50%; motivo sugere, não impõe). Não altera
  saldo nem ciclo; só soma na folha
- **Valor sugerido com memória de cálculo**: `(salário + insalubridade) ÷ jornada × (1 + adicional%)`,
  mostrado parcela a parcela na tela e congelado no registro — promoção posterior não pode
  reescrever o que já foi pago
- **Jornada mensal por funcionário** (`jornadaMensal`, seção Contrato da ficha): divisor do
  valor-hora. Vazio = 220h (44h semanais); 40h/semana usa 200. É cláusula do contrato individual —
  não parâmetro global, nem campo do cargo
