# Aba de ASO em Lançamentos — Planejamento

> Complementa `PLANEJAMENTO.md`. Escopo aprovado: periodicidade por Cargo · 5 tipos de ASO · espelhar Férias por completo.
>
> **STATUS: implementado (etapas 1–7).** Arquivos: `js/aso.js` (interface), motor em `js/utils.js`
> (bloco `CONTROLE DE ASO (NR-7)`), permissão `ver_medico` em `js/auth.js`, seed em `js/seed.js`.

## Princípio central: reaproveitar o motor de Férias

ASO e Férias são **o mesmo problema**: evento periódico, com prazo legal, que vence, precisa ser
previsto antes de acontecer e lançado quando acontece. A aba de Férias já resolve isso ponta a ponta.

| Conceito | Férias (existe) | ASO (novo) |
|---|---|---|
| O que gera o direito/dever | admissão + 12m | último ASO + periodicidade do cargo |
| Prazo legal | concessivo (art. 137 CLT) | vencimento do periódico (NR-7 / PCMSO) |
| Fila priorizada | `situacaoFeriasFunc` + `FERIAS_ORDEM` | `situacaoAsoFunc` (mesmo formato) |
| Distribuição no tempo | `programacaoEscalonada` | `programacaoAso` — ver nota abaixo |
| Alerta da data prevista | `alertaPrevisto` | reaproveitado sem alteração |
| Timeline anual | `feriasAgenda` | `asoAgenda` (mesma base de cálculo) |
| Documentação | `anexos.js` | reaproveitado sem alteração |
| Lembrete | `refreshNotificacoes` | + uma fonte de alertas |

**Consequência prática:** o custo real está em ~3 funções novas de cálculo e 3 de render. Todo o
resto é composição de peças já testadas em produção.

**Exceção deliberada ao reaproveitamento — `programacaoAso`:** férias são um *intervalo* de ~30
dias e o escalonamento evita dois colegas do mesmo cargo fora juntos. ASO é um *marco pontual*:
o problema não é sobreposição, é capacidade da clínica. Marcar 20 exames no mesmo dia é lista de
desejos, não agenda. Por isso o ASO tem escalonamento próprio (empurra por dia, teto de 3/dia/
unidade) e a agenda usa losango em vez de barra — a forma comunica "evento", não "intervalo".

## Decisão de arquitetura: projeção derivada, nunca gravada

Segue o padrão já estabelecido em `lancamentos.js:527`:

> *"Nada é gravado: a fila deriva de admissão + férias já lançadas, então nunca diverge da realidade."*

O ASO projetado **não é um registro** — é `último ASO + periodicidade do cargo`, calculado a cada render.

Por quê: lembrete gravado apodrece. Se o exame antecipa, se o cargo muda de periodicidade, se o
colaborador é transferido — um registro agendado passa a apontar para a data errada e ninguém
percebe até a fiscalização. Projeção derivada se autocorrige e **nunca mente**.

Isso responde ao "criar uma rotina / lembrete de lançamentos futuros" sem criar entidade nova:
a rotina é a fórmula, não uma linha no banco.

## Modelo de dados

### Novo path
```
rh_asos/{id}
```
```js
{
  funcionarioId,
  tipo,           // Admissional | Periódico | Demissional | Retorno ao trabalho | Mudança de risco
  data,           // data de realização do exame (ISO)
  resultado,      // Apto | Apto com restrições | Inapto
  restricoes,     // texto livre — obrigatório quando resultado = "Apto com restrições"
  medico,         // nome do médico examinador
  crm,
  obs,
  anexos: []      // mesmo formato dos demais lançamentos (anexos.js)
}
```

### Alteração em `rh_cargos`
```js
{ ..., asoPeriodicidadeMeses: 12 }   // 6 | 12 | 24 — default 12
```

Campo próprio, **desacoplado da insalubridade**: insalubridade é critério trabalhista/salarial,
periodicidade de ASO é critério médico-ocupacional (PCMSO). Amarrar um no outro é uma simplificação
que quebra quando o SESMT definir periodicidade diferente do grau de insalubridade.

**Migração:** cargos sem o campo assumem 12 meses (`?? 12`). Zero migração destrutiva.

## Os 5 tipos e seus gatilhos

Só o **Periódico** gera projeção recorrente. Os outros quatro são disparados por eventos que o
módulo **já registra** — a aba de ASO se integra ao que existe em vez de duplicar:

| Tipo | Gatilho | Prazo | Origem do gatilho |
|---|---|---|---|
| Admissional | admissão do colaborador | antes do início das atividades | ficha (`admissao`) |
| **Periódico** | último ASO + periodicidade | 6/12/24 meses | **motor de projeção** |
| Demissional | lançamento de demissão | até 10 dias do desligamento | `rh_demissoes` (existe) |
| Retorno ao trabalho | ausência ≥ 30 dias | antes do retorno | `rh_ausencias` (existe) |
| Mudança de risco | promoção ou transferência | antes da nova função | `rh_promocoes` / `rh_transferencias` (existem) |

**Pendência do Periódico:** o exame Admissional inicia a contagem. Colaborador sem nenhum ASO
lançado e admitido há mais de `periodicidade` → aparece como **pendente desde a admissão** (não
"sem dados"). O sistema não pode ficar em silêncio sobre quem nunca fez exame.

## Estrutura da aba

```
Lançamentos → ASO
 ├── Programação   fila por urgência (vencido → vence em ≤N dias → em dia → sem histórico)
 ├── Tabela        lançados, com anexo do laudo e filtro por tipo
 └── Agenda        timeline anual: lançado (sólido) vs. projetado (hachurado)
```

Espelha `feriasSub = 'programacao' | 'tabela' | 'agenda'`, incluindo os filtros de unidade/cargo
compartilhados (`feriasPassaFiltro` → `asoPassaFiltro`) e o contador de urgência na sub-aba.

## Etapas de implementação

### Etapa 1 — Fundação de dados
- `PATHS.asos = 'rh_asos'` em `firebase-config.js`
- Campo `asoPeriodicidadeMeses` no form de Cargos (`config.js`, ao lado da insalubridade)
- Coluna "Periodicidade ASO" na tabela de Cargos
- Parâmetro global `asoAlertaDias` (default 30) em Parâmetros — espelha `feriasAlertaLegalDias`

### Etapa 2 — Motor de cálculo (`utils.js`)
Bloco novo `============ CONTROLE DE ASO (NR-7) ============`, ao lado do de férias:

- `asoParams` / `setAsoParams` — espelha `feriasParams`
- `situacaoAsoFunc(f, asos, cargo, ref)` → `{ status, dias, ultimo, vencimento, label, desc }`
  - status: `vencido` | `critico` | `em_dia` | `sem_historico`
  - **mesmo contrato de retorno de `situacaoFeriasFunc`** → reusa `FERIAS_ORDEM`/badges por analogia
- `ASO_ORDEM` / `ASO_STATUS` — espelham os equivalentes de férias
- `asosPendentesPorEvento(f, demissoes, ausencias, promocoes, transferencias)` → gatilhos dos 4 tipos não-periódicos

### Etapa 3 — Sub-aba Tabela
- `renderLancAso` + `formAso` (espelha `formAusencia`)
- Anexo do laudo via `anexos.js` — zero código novo
- Validação: `data > hoje()` bloqueado (mesma regra da admissão); `restricoes` obrigatório se "Apto com restrições"
- Filtro por tipo (espelha `ausFiltroTipo`)

### Etapa 4 — Sub-aba Programação
- Fila ordenada por urgência, KPIs no topo (espelha `prog-resumo`)
- Botão "Lançar ASO" pré-preenchido com a data projetada
- `programacaoEscalonada` reaproveitada — evita marcar 20 exames no mesmo dia na mesma unidade

### Etapa 5 — Sub-aba Agenda
- `asoAgenda(asos)` — clona `feriasAgenda`, troca barra de período por **marco pontual** (exame é
  um dia, não um intervalo)
- `asoMostrarPrev` — espelha `feriasMostrarPrev`: lançado sólido, projetado hachurado
- Clique no marco → `detalheAso` (publicado) ou form pré-preenchido (projetado)

### Etapa 6 — Notificações e integração
- `refreshNotificacoes` ganha fonte `diagnosticoAso` → "N ASOs vencidos · N vencendo"
- Drawer do funcionário: ASOs no histórico (aba Documentos já existe)

### Etapa 7 — Seed e validação
- ASOs de exemplo coerentes com a admissão de cada funcionário (respeitando o fix de admissão futura)
- Conferência: projeção × cálculo manual, os 4 gatilhos, `sem_historico`, virada de ano na agenda

## Riscos e decisões em aberto

| Risco | Mitigação |
|---|---|
| `lancamentos.js` já tem 1.743 linhas — maior arquivo do projeto | **Criar `js/aso.js` separado.** Não engordar o arquivo; seguir o padrão de `anexos.js`/`notificacoes.js` |
| Tentação de gravar lembretes agendados | Projeção derivada (decisão acima) |
| Periodicidade mudar depois de ASOs lançados | Projeção usa periodicidade **atual** do cargo — se autocorrige por design |
| ASO ≠ insalubridade | Campo próprio (decisão acima) |
| Permissão | **Resolvido:** `ver_medico`, no grupo "Sensível" que já existia (ao lado de `ver_financeiro`). Sem ela: datas, vencimentos e fila continuam visíveis (é o que evita autuação); resultado, restrições, médico, CRM e laudo ficam ocultos. Editar exige a permissão — senão o save sobrescreveria os campos clínicos com vazio |

## Fórmulas-chave

- **Vencimento do periódico** = `data do último ASO + asoPeriodicidadeMeses do cargo`
- **Sem histórico** = ativo, admitido há > periodicidade, sem nenhum ASO → pendente desde a admissão
- **Crítico** = vencimento ≤ `asoAlertaDias` (default 30)
- **Retorno ao trabalho** = ausência com `dias ≥ 30` e tipo médico/maternidade → ASO antes do retorno
