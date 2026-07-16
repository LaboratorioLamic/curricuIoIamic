# Graph Report - .  (2026-07-13)

## Corpus Check
- Corpus is ~21,734 words - fits in a single context window. You may not need a graph.

## Summary
- 260 nodes · 472 edges · 19 communities (16 shown, 3 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.67)
- Token cost: 62,847 input · 0 output

## Community Hubs (Navigation)
- App Shell & Planning Overview
- Payroll Domain Concepts
- Lancamentos (Entries) Module
- Funcionarios (Employees) Module
- Utility Functions
- Configuracoes (Settings) Module
- Anexos (Attachments) Module
- Folha and Custos (Payroll Calc) Module
- Resultados (Results) Module
- Auth and Session
- Dashboard Module
- UI Primitives (Modals, Drawers, Toasts)
- Seed Data Generator
- Router and Navigation
- Benefit Cost Formula
- Design Theme
- Headcount Formula

## God Nodes (most connected - your core abstractions)
1. `db` - 39 edges
2. `index.html (RH LAMIC app shell)` - 23 edges
3. `Etapa 1 — Configurações` - 13 edges
4. `renderCfgTab()` - 12 edges
5. `renderLancTab()` - 12 edges
6. `Mapa de conexões (diagrama)` - 12 edges
7. `drawerFuncionario()` - 10 edges
8. `renderDashBody()` - 8 edges
9. `relFolhaMensal()` - 8 edges
10. `renderFuncGrid()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `js/config.js` --conceptually_related_to--> `Etapa 1 — Configurações`  [INFERRED]
  index.html → PLANEJAMENTO.md
- `js/lancamentos.js` --conceptually_related_to--> `Etapa 3 — Lançamentos`  [INFERRED]
  index.html → PLANEJAMENTO.md
- `js/folha.js` --conceptually_related_to--> `Etapa 4 — Folha & Custos`  [INFERRED]
  index.html → PLANEJAMENTO.md
- `js/dashboard.js` --conceptually_related_to--> `Etapa 5 — Dashboard`  [INFERRED]
  index.html → PLANEJAMENTO.md
- `js/resultados.js` --conceptually_related_to--> `Etapa 6 — Resultados consolidados`  [INFERRED]
  index.html → PLANEJAMENTO.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Etapas de construção do Sistema RH LAMIC (0-7)** — planejamento_etapa0_fundacao, planejamento_etapa1_configuracoes, planejamento_etapa2_funcionarios, planejamento_etapa3_lancamentos, planejamento_etapa4_folha_custos, planejamento_etapa5_dashboard, planejamento_etapa6_resultados, planejamento_etapa7_revisao [EXTRACTED 1.00]
- **JS modules loaded by index.html forming the SPA** — js_firebase_config_js, js_utils_js, js_ui_js, js_auth_js, js_router_js, js_anexos_js, js_pages_js, js_config_js, js_funcionarios_js, js_lancamentos_js, js_folha_js, js_dashboard_js, js_resultados_js, js_seed_js, js_app_js [EXTRACTED 1.00]
- **Entities feeding into Folha (payroll) calculation** — planejamento_cargos, planejamento_beneficios_catalogo, planejamento_encargos_percentual, planejamento_insalubridade, planejamento_beneficios_coparticipacao, planejamento_folha_grade_mensal [INFERRED 0.85]

## Communities (19 total, 3 thin omitted)

### Community 0 - "App Shell & Planning Overview"
Cohesion: 0.07
Nodes (36): css/base.css, css/components.css, css/layout.css, css/pages.css, App shell (#app: sidebar + main), Chart.js CDN (4.4.3), index.html (RH LAMIC app shell), Firebase JS SDK (compat 9.22.1) (+28 more)

### Community 1 - "Payroll Domain Concepts"
Cohesion: 0.10
Nodes (34): js/config.js, js/folha.js, js/funcionarios.js, js/lancamentos.js, Aprovação automática de experiência (90 dias), Ausências (férias/faltas/licenças), Benefícios (catálogo: nome, tipo, custo titular, custo dependente), Benefícios — coparticipação (% descontado) (+26 more)

### Community 2 - "Lancamentos (Entries) Module"
Cohesion: 0.19
Nodes (25): db, firebaseConfig, PATHS, formAusencia(), formDemissao(), formPromocao(), formTreinamento(), LANC_TABS (+17 more)

### Community 3 - "Funcionarios (Employees) Module"
Cohesion: 0.20
Nodes (20): cargoDe(), custoBeneficioFunc(), drawerFuncionario(), fdBeneficios(), fdDados(), fdDocumentos(), fdHistorico(), formBeneficioFunc() (+12 more)

### Community 4 - "Utility Functions"
Cohesion: 0.10
Nodes (6): diasEntre(), hoje(), ICONS, MESES, MESES_FULL, tempoEmpresa()

### Community 5 - "Configuracoes (Settings) Module"
Cohesion: 0.26
Nodes (17): CFG_TABS, cfgList(), cfgLoading(), cfgRowActions(), formBeneficio(), formCargo(), formUnidade(), formUsuario() (+9 more)

### Community 6 - "Anexos (Attachments) Module"
Cohesion: 0.20
Nodes (15): abrirAnexo(), ANEXO_FORMATOS, anexoChip(), anexoIcone(), bindAnexoChips(), comprimirImagem(), detectaFormato(), excluirAnexoRemoto() (+7 more)

### Community 7 - "Folha and Custos (Payroll Calc) Module"
Cohesion: 0.25
Nodes (15): beneficiosDoFunc(), bindFrNav(), brutoLinha(), custoTreinoNoMes(), descontoLinha(), FOLHA_COLS, folhaState, _hj (+7 more)

### Community 8 - "Resultados (Results) Module"
Cohesion: 0.32
Nodes (13): fmtVal(), render(), renderResTab(), RES_TABS, resBase(), resEventos(), resFinanceiro(), resGeral() (+5 more)

### Community 9 - "Auth and Session"
Cohesion: 0.29
Nodes (9): clearSession(), doLogin(), doLogout(), handleLoginSubmit(), PERMISSOES, renderFirstAdminSetup(), setSession(), showApp() (+1 more)

### Community 10 - "Dashboard Module"
Cohesion: 0.27
Nodes (11): dashCharts, dashState, DV, DV_SLOTS, dvBase(), dvChart(), dvEscala(), fimDoMes() (+3 more)

### Community 11 - "UI Primitives (Modals, Drawers, Toasts)"
Cohesion: 0.27
Nodes (7): closeDrawer(), closePopover(), confirmDialog(), _modalStack, openDrawer(), openModal(), openPopover()

### Community 12 - "Seed Data Generator"
Cohesion: 0.39
Nodes (7): ESCOLARIDADES, _dataIso(), gerarDadosExemplo(), limparDadosExemplo(), _pick(), _rnd(), SEED_NOMES

### Community 13 - "Router and Navigation"
Cohesion: 0.48
Nodes (6): initRouter(), navigate(), PAGES, registerPage(), renderSidebar(), visiblePages()

## Knowledge Gaps
- **50 isolated node(s):** `ANEXO_FORMATOS`, `IMG_CACHE`, `TIPOS_CARGO`, `TIPOS_BENEFICIO`, `CFG_TABS` (+45 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db` connect `Lancamentos (Entries) Module` to `Funcionarios (Employees) Module`, `Configuracoes (Settings) Module`, `Anexos (Attachments) Module`, `Folha and Custos (Payroll Calc) Module`, `Resultados (Results) Module`, `Auth and Session`, `Dashboard Module`, `Seed Data Generator`?**
  _High betweenness centrality (0.266) - this node is a cross-community bridge._
- **Why does `obterImagem()` connect `Anexos (Attachments) Module` to `Lancamentos (Entries) Module`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `render()` connect `Dashboard Module` to `Lancamentos (Entries) Module`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `renderCfgTab()` (e.g. with `renderCfgBeneficios()` and `renderCfgCargos()`) actually correct?**
  _`renderCfgTab()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `renderLancTab()` (e.g. with `renderAusencias()` and `renderDemissoes()`) actually correct?**
  _`renderLancTab()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ANEXO_FORMATOS`, `IMG_CACHE`, `TIPOS_CARGO` to the rest of the system?**
  _51 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Shell & Planning Overview` be split into smaller, more focused modules?**
  _Cohesion score 0.06825396825396825 - nodes in this community are weakly interconnected._