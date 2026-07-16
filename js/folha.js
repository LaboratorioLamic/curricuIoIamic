// ===== Folha & Custos (RELATÓRIO) + helpers compartilhados de folha =====
// A grade editável é lançada em Lançamentos → Folha mensal.

const FOLHA_COLS = [
    ['salario', 'Salários'],
    ['insalubridade', 'Insalubridade'],
    ['bolsa', 'Bolsa estágio'],
    ['prolabore', 'Pró-labore'],
    ['ferias', 'Férias'],
    ['decimo', '13º salário'],
    ['encargos', 'Encargos'],
    ['outros', 'Outros custos'],
    ['beneficios', 'Benefícios']
];
// Coparticipação: parte do benefício descontada do funcionário (abate do custo da empresa)
const FOLHA_DESC = 'beneficiosDesconto';

// Coluna DERIVADA: hora extra vinda do banco de horas (fechamentos pagos + Extra Banco).
// Não está em FOLHA_COLS porque não é editável nem gravada — é recalculada a cada render
// (ver heBancoDoMes em utils.js). Fica fora do loop de células justamente para que nenhuma
// edição manual consiga sobrescrevê-la.
const FOLHA_HE_BANCO = 'heBanco';

// Coluna LEGADA: a hora extra manual foi aposentada quando o banco de horas passou a cobrir
// as duas origens — HE do ciclo (fechamento/quitação) e HE fora do banco (Extra Banco). Ter
// as duas convidava ao lançamento em dobro: o mesmo dinheiro digitado à mão e postado pelo
// sistema.
//
// O campo continua existindo apenas para LER meses já lançados. Some da grade quando está
// zerado (todo mês novo), aparece read-only quando tem valor — apagá-la do total mudaria
// retroativamente o custo de um mês já fechado, e um relatório anual passaria a divergir de
// si mesmo sem ninguém ter editado nada.
const FOLHA_HE_MANUAL = 'horaExtra';
const folhaTemHeManual = dados =>
    Object.values(dados || {}).some(l => Number(l?.[FOLHA_HE_MANUAL]) > 0);

// Coluna DERIVADA: remuneração de férias dos lançamentos do mês (gozo + 1/3 + abono).
// Fica ao lado da coluna "Férias" manual, que segue editável: convenção coletiva muda o
// cálculo, e o RH precisa de um lugar para o ajuste sem que o próximo render o apague.
const FOLHA_FERIAS_CALC = 'feriasCalc';

// ---- Grupos de colunas (ocultar/mostrar categorias) ----
// cols = chaves de FOLHA_COLS/FOLHA_DESC. "aberto padrão" = Remuneração; Custo empresa é sempre fixo.
const FOLHA_GRUPOS = [
    { id: 'remuneracao', label: 'Remuneração', cols: ['salario', 'insalubridade', 'bolsa', 'prolabore'], def: true },
    { id: 'feriasDecimo', label: 'Férias e 13º', cols: ['ferias', FOLHA_FERIAS_CALC, 'decimo'], def: false },
    { id: 'encargos', label: 'Encargos', cols: ['encargos'], def: false },
    { id: 'beneficios', label: 'Benefícios', cols: ['beneficios', FOLHA_DESC], def: false },
    { id: 'extras', label: 'Extras', cols: [FOLHA_HE_BANCO, FOLHA_HE_MANUAL, 'outros'], def: false }
];
const FOLHA_COL_LABEL = Object.fromEntries([
    ...FOLHA_COLS,
    [FOLHA_DESC, 'Desconto benef.'],
    [FOLHA_HE_BANCO, 'HE (banco)'],
    [FOLHA_HE_MANUAL, 'Hora extra (legado)'],
    [FOLHA_FERIAS_CALC, 'Férias (calc)']
]);
// Estado de grupos visíveis (compartilhado entre folha mensal e detalhamento)
const folhaGruposVis = new Set(FOLHA_GRUPOS.filter(g => g.def).map(g => g.id));
const colVisivel = k => FOLHA_GRUPOS.some(g => folhaGruposVis.has(g.id) && g.cols.includes(k));

// Renderiza os chips de grupo; onToggle() é chamado após cada mudança
function gruposChipsHtml() {
    return `<div class="col-groups">
        ${FOLHA_GRUPOS.map(g => `<button class="grp-chip${folhaGruposVis.has(g.id) ? ' on' : ''}" data-grp="${g.id}">
            <span class="grp-dot"></span>${g.label}</button>`).join('')}
        <span class="grp-chip fixed"><span class="grp-dot"></span>Custo empresa</span>
    </div>`;
}
function bindGruposChips(scope, onToggle) {
    scope.querySelectorAll('.grp-chip[data-grp]').forEach(btn => {
        btn.onclick = () => {
            const id = btn.dataset.grp;
            if (folhaGruposVis.has(id)) folhaGruposVis.delete(id); else folhaGruposVis.add(id);
            onToggle();
        };
    });
}

const _hj = new Date();
const folhaState = {
    ano: _hj.getFullYear(),
    mes: _hj.getMonth(),          // 0–11
    visao: 'mensal',
    funcionarios: [], cargos: [], beneficios: [], treinamentos: [], params: {},
    bhFechamentos: [], bhQuitacoes: [], extras: [], carregado: false
};

async function loadFolhaBase(force) {
    if (folhaState.carregado && !force) return;
    const [funcionarios, cargos, beneficios, treinamentos, params, bhFechamentos, bhQuitacoes, extras, ausencias] = await Promise.all([
        DB.getAll(PATHS.funcionarios), DB.getAll(PATHS.cargos),
        DB.getAll(PATHS.beneficios), DB.getAll(PATHS.treinamentos), DB.getObj(PATHS.parametros),
        // Origens da coluna derivada "HE (banco)" — ver folhaComHeBanco
        DB.getAll(PATHS.bancoHorasFechamentos), DB.getAll(PATHS.bancoHorasQuitacoes), DB.getAll(PATHS.extraBanco),
        // Origem da coluna derivada "Férias (calc)" — os lançamentos de férias do mês
        DB.getAll(PATHS.ausencias)
    ]);
    Object.assign(folhaState, { funcionarios, cargos, beneficios, treinamentos, params: params || {}, bhFechamentos, bhQuitacoes, extras, ausencias, carregado: true });
}

// Custo bruto (todas as colunas + a HE derivada do banco) e custo da empresa (bruto −
// desconto do funcionário).
//
// `heBanco` entra no bruto mas NÃO está em FOLHA_COLS: ele chega na linha em memória
// (ver folhaComHeBanco), nunca é gravado, e nenhuma célula editável o alcança. Se um dia
// entrar em FOLHA_COLS, vira coluna editável e a garantia se perde.
// A HE do banco (derivada) e a HE manual legada entram fora do loop de FOLHA_COLS: a
// primeira nunca esteve lá, a segunda saiu quando foi aposentada. Ambas continuam somando —
// o custo de um mês já lançado não pode mudar porque a coluna deixou de ser oferecida.
const brutoLinha = l => FOLHA_COLS.reduce((s, [k]) => s + (Number(l?.[k]) || 0), 0)
    + (Number(l?.[FOLHA_HE_BANCO]) || 0)
    + (Number(l?.[FOLHA_HE_MANUAL]) || 0)
    + (Number(l?.[FOLHA_FERIAS_CALC]) || 0);
const descontoLinha = l => Number(l?.[FOLHA_DESC]) || 0;
const totalLinha = l => brutoLinha(l) - descontoLinha(l);

// Injeta a HE derivada do banco nas linhas de um mês. Recebe o objeto {fid: linha} da folha
// e devolve um NOVO objeto — mutar o original faria o valor derivado vazar para o próximo
// DB.save e virar dado gravado, exatamente o que a coluna existe para evitar.
// Contexto para a coluna derivada de férias. A média de HE (Súmula 45) é resolvida aqui, uma
// vez por funcionário/lançamento, lendo as MESMAS fontes da coluna HE (banco) — se a média
// viesse de outro lugar, o sistema teria duas respostas para "quanto de extra ele recebeu".
const feriasCtx = (o) => ({
    ausencias: o.ausencias || [],
    funcionarios: o.funcionarios || [],
    cargos: o.cargos || [],
    params: o.params || {},
    mediaHe: (f, a) => {
        if (!feriasParams.mediaHe) return 0;
        const sit = situacaoFeriasFunc(f, (o.ausencias || []).filter(x => x.id !== a.id), a.inicio);
        if (!sit) return 0;
        return mediaHeFerias(f.id, sit.aquisitivoIni, sit.aquisitivoFim,
            o.bhFechamentos || [], o.extras || [], o.bhQuitacoes || []).media;
    }
});

function folhaComHeBanco(dados, mesKey, fechamentos, extras, quitacoes, ctx) {
    const c = ctx || {};
    const out = {};
    Object.entries(dados || {}).forEach(([fid, linha]) => {
        const he = heBancoDoMes(fid, mesKey, fechamentos, extras, quitacoes);
        // Férias: mesma regra da HE do banco — derivada, nunca gravada. O adiantamento do 13º
        // soma na coluna "13º salário", não na de férias: são rubricas distintas no holerite,
        // e juntá-las faria o custo de férias parecer 50% maior do que é.
        const fe = c.ausencias
            ? feriasDoMes(fid, mesKey, c.ausencias, c.funcionarios, c.cargos, c.params, c)
            : { total: 0, total13: 0 };
        if (!he.total && !fe.total && !fe.total13) { out[fid] = linha; return; }
        const nova = { ...linha };
        if (he.total) nova[FOLHA_HE_BANCO] = he.total;
        if (fe.total) nova[FOLHA_FERIAS_CALC] = fe.total;
        // O adiantamento entra somando ao 13º já lançado — não substitui: o RH pode ter
        // digitado outra parcela no mesmo mês.
        if (fe.total13) nova.decimo = (Number(linha.decimo) || 0) + fe.total13;
        out[fid] = nova;
    });
    return out;
}
// Custo dos benefícios para a empresa nesta linha (coluna benefícios − coparticipação do funcionário)
const beneficioLinha = l => (Number(l?.beneficios) || 0) - descontoLinha(l);
// Custo do funcionário para a empresa (folha sem os benefícios líquidos)
const funcionarioLinha = l => totalLinha(l) - beneficioLinha(l);

// Elegível no mês: trabalhou ao menos um dia
function elegiveisNoMes(ano, mes) {
    const iniMes = mesKey(ano, mes) + '-01';
    const fimMes = mesKey(ano, mes) + '-31';
    return folhaState.funcionarios.filter(f =>
        f.admissao && f.admissao <= fimMes && (!f.demissao || f.demissao >= iniMes));
}

// Custos do benefício de um funcionário: {total, desconto} (desconto = coparticipação)
function beneficiosDoFunc(f, catalogo) {
    let total = 0, desconto = 0;
    (f.beneficios || []).forEach(fb => {
        const b = (catalogo || folhaState.beneficios).find(x => x.id === fb.beneficioId);
        if (!b) return;
        const custo = (Number(b.custoTitular) || 0) + (fb.dependentes || []).length * (Number(b.custoDependente) || 0);
        total += custo;
        desconto += custo * (Number(b.descontoPct) || 0) / 100;
    });
    return { total: Number(total.toFixed(2)), desconto: Number(desconto.toFixed(2)) };
}

// Pré-preenchimento da linha da folha
function prefillLinha(f) {
    const cargo = folhaState.cargos.find(c => c.id === f.cargoId);
    const sal = f.salario ?? cargo?.salario ?? 0;
    const linha = {};
    FOLHA_COLS.forEach(([k]) => linha[k] = 0);
    linha[FOLHA_DESC] = 0;

    if (cargo?.tipo === 'Estágio') linha.bolsa = sal;
    else if (cargo?.tipo === 'Diretoria') linha.prolabore = sal;
    else {
        linha.salario = sal;
        // Insalubridade: grau do cargo × base configurada (salário do funcionário ou salário mínimo)
        const base = (folhaState.params.insalubridadeBase || 'salario') === 'minimo'
            ? (Number(folhaState.params.salarioMinimo) || 0) : sal;
        linha.insalubridade = Number(((Number(cargo?.insalubridade) || 0) / 100 * base).toFixed(2));
        // Encargos sobre remuneração (salário + insalubridade)
        linha.encargos = Number(((sal + linha.insalubridade) * (Number(folhaState.params.encargosPct) || 0) / 100).toFixed(2));
    }
    const ben = beneficiosDoFunc(f);
    linha.beneficios = ben.total;
    linha[FOLHA_DESC] = ben.desconto;
    return linha;
}

// Custo de treinamento no mês (parcelas a partir da data de pagamento)
function custoTreinoNoMes(t, ano, mes) {
    const custo = Number(t.custo) || 0;
    if (!custo) return 0;
    const inicio = t.dataPagamento || t.inicio;
    if (!inicio) return 0;
    const n = Math.max(1, Number(t.parcelas) || 1);
    const idx = (ano - Number(inicio.slice(0, 4))) * 12 + (mes - (Number(inicio.slice(5, 7)) - 1));
    return idx >= 0 && idx < n ? custo / n : 0;
}

// ============ PÁGINA: RELATÓRIO ============
registerPage({
    id: 'folha',
    title: 'Folha & Custos',
    icon: 'money',
    order: 4,
    perm: 'ver_folha',
    wide: true,     // grade de ~12 colunas: usar a tela toda evita scroll horizontal
    async render(el) {
        if (!can('ver_financeiro')) {
            el.innerHTML = emptyState({ icon: 'lock', title: 'Acesso restrito', text: 'Este módulo exige a permissão "Ver valores financeiros". Contate um administrador.' });
            return;
        }
        el.innerHTML = '<div class="loading-center"><div class="spinner-dark"></div></div>';
        await loadFolhaBase(true);

        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Folha & Custos</h2>
                    <div class="page-sub">Relatório — os valores são lançados em Lançamentos → Folha mensal.</div>
                </div>
            </div>
            <div class="tabs" id="frTabs">
                <div class="tab${folhaState.visao === 'mensal' ? ' active' : ''}" data-v="mensal">Visão mensal</div>
                <div class="tab${folhaState.visao === 'anual' ? ' active' : ''}" data-v="anual">Visão anual</div>
            </div>
            <div class="mt-16" id="frContent"></div>`;

        el.querySelectorAll('#frTabs .tab').forEach(tab => {
            tab.onclick = () => {
                folhaState.visao = tab.dataset.v;
                el.querySelectorAll('#frTabs .tab').forEach(t => t.classList.toggle('active', t === tab));
                renderFolhaRel();
            };
        });
        renderFolhaRel();
    }
});

function renderFolhaRel() {
    document.getElementById('frContent').innerHTML = '<div class="loading-center"><div class="spinner-dark"></div></div>';
    (folhaState.visao === 'mensal' ? relFolhaMensal() : relFolhaAnual()).catch(e => {
        console.error(e);
        document.getElementById('frContent').innerHTML = emptyState({ icon: 'alert', title: 'Erro ao carregar', text: e.message || '' });
    });
}

async function relFolhaMensal() {
    const { ano, mes } = folhaState;
    const key = mesKey(ano, mes);
    const dados = (await DB.getObj(`${PATHS.folha}/${key}`)) || null;
    const cont = document.getElementById('frContent');

    const treinosMes = folhaState.treinamentos.reduce((s, t) => s + custoTreinoNoMes(t, ano, mes), 0);

    const nav = `
        <div class="month-nav">
            <button id="frPrev" title="Mês anterior">‹</button>
            <span class="month-label">${MESES_FULL[mes]} ${ano}</span>
            <button id="frNext" title="Próximo mês">›</button>
        </div>`;

    if (!dados) {
        cont.innerHTML = `
            <div class="flex-between" style="margin-bottom:16px">${nav}<div></div></div>
            ${emptyState({ icon: 'money', title: `Folha de ${MESES_FULL[mes]} ${ano} não lançada`, text: 'Gere a folha em Lançamentos → Folha mensal.' })}`;
        bindFrNav(cont);
        return;
    }

    const linhas = Object.entries(dados)
        .map(([id, linha]) => ({ f: folhaState.funcionarios.find(x => x.id === id), linha }))
        .sort((a, b) => (a.f?.nome || '').localeCompare(b.f?.nome || ''));

    const bruto = linhas.reduce((s, l) => s + brutoLinha(l.linha), 0);
    const descontos = linhas.reduce((s, l) => s + descontoLinha(l.linha), 0);
    const custoEmpresa = bruto - descontos;
    const custoBeneficios = linhas.reduce((s, l) => s + beneficioLinha(l.linha), 0);
    const custoFuncionarios = custoEmpresa - custoBeneficios;
    const pctBenef = custoEmpresa ? custoBeneficios / custoEmpresa * 100 : 0;

    cont.innerHTML = `
        <div class="flex-between" style="margin-bottom:16px">${nav}<div></div></div>
        <div class="grid grid-4">
            <div class="kpi"><span class="kpi-label">Custo empresa (folha)</span><span class="kpi-value" style="font-size:20px">${fmtBRL(custoEmpresa)}</span><span class="kpi-delta">bruto ${fmtBRL(bruto)} − ${fmtBRL(descontos)} coparticipação</span></div>
            <div class="kpi"><span class="kpi-label">Custo dos funcionários</span><span class="kpi-value" style="font-size:20px">${fmtBRL(custoFuncionarios)}</span><span class="kpi-delta">remuneração, encargos e demais custos</span></div>
            <div class="kpi"><span class="kpi-label">Custo dos benefícios</span><span class="kpi-value" style="font-size:20px">${fmtBRL(custoBeneficios)}</span><span class="kpi-delta">${fmtPct(pctBenef)} do custo da folha</span></div>
            <div class="kpi"><span class="kpi-label">Treinamentos (parcelas)</span><span class="kpi-value" style="font-size:20px">${fmtBRL(treinosMes)}</span></div>
        </div>
        <div class="table-wrap mt-16">
            <div class="table-toolbar" style="flex-wrap:wrap;gap:10px">
                <strong>Detalhamento por funcionário — ${MESES_FULL[mes]} ${ano}</strong>
                <div class="grow"></div>
                ${gruposChipsHtml()}
            </div>
            <div class="table-scroll">
                <table class="table folha-table">
                    <thead><tr>
                        <th>Funcionário</th>
                        ${FOLHA_COLS.map(([k, l]) => `<th class="num col-${k}">${l}</th>`).join('')}
                        <th class="num col-${FOLHA_DESC}">Desconto benef.</th>
                        <th class="num">Custo empresa</th>
                    </tr></thead>
                    <tbody>
                        ${linhas.map(({ f, linha }) => `
                        <tr>
                            <td style="white-space:nowrap"><strong>${escapeHtml(f?.nome || '(removido)')}</strong></td>
                            ${FOLHA_COLS.map(([k]) => `<td class="num col-${k}">${Number(linha[k]) ? fmtBRL(linha[k]) : '—'}</td>`).join('')}
                            <td class="num col-${FOLHA_DESC}" style="color:var(--danger)">${descontoLinha(linha) ? '− ' + fmtBRL(descontoLinha(linha)) : '—'}</td>
                            <td class="num"><strong>${fmtBRL(totalLinha(linha))}</strong></td>
                        </tr>`).join('')}
                    </tbody>
                    <tfoot><tr>
                        <td><strong>Total</strong></td>
                        ${FOLHA_COLS.map(([k]) => `<td class="num col-${k}"><strong>${fmtBRL(linhas.reduce((s, l) => s + (Number(l.linha[k]) || 0), 0))}</strong></td>`).join('')}
                        <td class="num col-${FOLHA_DESC}" style="color:var(--danger)"><strong>− ${fmtBRL(descontos)}</strong></td>
                        <td class="num"><strong>${fmtBRL(custoEmpresa)}</strong></td>
                    </tr></tfoot>
                </table>
            </div>
        </div>`;
    bindFrNav(cont);

    // Grupos de coluna ocultáveis
    const COLS_DET = [...FOLHA_COLS.map(([k]) => k), FOLHA_DESC];
    const aplicaGruposDet = () => COLS_DET.forEach(k => {
        const vis = colVisivel(k);
        cont.querySelectorAll(`.col-${k}`).forEach(el => el.classList.toggle('hidden', !vis));
    });
    aplicaGruposDet();
    bindGruposChips(cont, () => {
        cont.querySelectorAll('.grp-chip[data-grp]').forEach(b => b.classList.toggle('on', folhaGruposVis.has(b.dataset.grp)));
        aplicaGruposDet();
    });
}

function bindFrNav(cont) {
    const prev = cont.querySelector('#frPrev'), next = cont.querySelector('#frNext');
    if (prev) prev.onclick = () => {
        folhaState.mes--;
        if (folhaState.mes < 0) { folhaState.mes = 11; folhaState.ano--; }
        renderFolhaRel();
    };
    if (next) next.onclick = () => {
        folhaState.mes++;
        if (folhaState.mes > 11) { folhaState.mes = 0; folhaState.ano++; }
        renderFolhaRel();
    };
}

let folhaCharts = [];
function destroyFolhaCharts() { folhaCharts.forEach(c => c.destroy()); folhaCharts = []; }

async function relFolhaAnual() {
    destroyFolhaCharts();
    const ano = folhaState.ano;
    const folhaAll = await DB.getObj(PATHS.folha);
    const cont = document.getElementById('frContent');

    const rows = { bruto: [], descontos: [], empresa: [], funcionarios: [], beneficios: [], treinos: [] };
    for (let m = 0; m < 12; m++) {
        const dados = folhaAll?.[mesKey(ano, m)] || {};
        const linhas = Object.values(dados);
        const bruto = linhas.reduce((s, l) => s + brutoLinha(l), 0);
        const desc = linhas.reduce((s, l) => s + descontoLinha(l), 0);
        const beneficios = linhas.reduce((s, l) => s + beneficioLinha(l), 0);
        const treinos = folhaState.treinamentos.reduce((s, t) => s + custoTreinoNoMes(t, ano, m), 0);
        rows.bruto.push(bruto);
        rows.descontos.push(desc);
        rows.empresa.push(bruto - desc);
        rows.beneficios.push(beneficios);
        rows.funcionarios.push(bruto - desc - beneficios);
        rows.treinos.push(treinos);
    }

    // Métricas → cada uma vira um gráfico de barras com linha de média e total
    const metricas = [
        { id: 'empresa', label: 'Custo empresa (folha)', vals: rows.empresa, cor: DV.s1 },
        { id: 'funcionarios', label: 'Custo dos funcionários', vals: rows.funcionarios, cor: DV.s5 },
        { id: 'beneficios', label: 'Custo dos benefícios', vals: rows.beneficios, cor: DV.s2 },
        { id: 'bruto', label: 'Remuneração bruta (folha)', vals: rows.bruto, cor: DV.s8 },
        { id: 'descontos', label: 'Descontos (coparticipação)', vals: rows.descontos, cor: DV.s6 },
        { id: 'treinos', label: 'Treinamentos (parcelas)', vals: rows.treinos, cor: DV.s3 }
    ];

    cont.innerHTML = `
        <div class="flex-between" style="margin-bottom:16px">
            <div class="month-nav">
                <button id="fraPrev" title="Ano anterior">‹</button>
                <span class="month-label" style="min-width:80px">${ano}</span>
                <button id="fraNext" title="Próximo ano">›</button>
            </div><div></div>
        </div>
        <div class="chart-grid chart-grid-3">
            ${metricas.map(mt => {
                const total = mt.vals.reduce((a, b) => a + b, 0);
                const media = total / 12;
                return `
                <div class="chart-card">
                    <div class="chart-card-head">
                        <div class="chart-card-title">${mt.label}</div>
                        <div class="chart-card-stats">
                            <span class="cc-total">${fmtBRL(total)}</span>
                            <span class="cc-media">média ${fmtBRL(media)}/mês</span>
                        </div>
                    </div>
                    <div class="chart-box"><canvas id="fra_${mt.id}"></canvas></div>
                </div>`;
            }).join('')}
        </div>
        ${tabelaMensal(`Resumo de custos — funcionários × benefícios — ${ano}`, [
            { label: 'Remuneração bruta (folha)', fmt: 'brl', vals: rows.bruto },
            { label: 'Descontos de benefícios (funcionário)', fmt: 'brl', vals: rows.descontos },
            { label: 'Custo empresa (folha)', fmt: 'brl', vals: rows.empresa },
            { label: 'Custo dos funcionários (empresa)', fmt: 'brl', vals: rows.funcionarios },
            { label: 'Custo dos benefícios (empresa)', fmt: 'brl', vals: rows.beneficios },
            { label: 'Treinamentos (parcelas)', fmt: 'brl', vals: rows.treinos }
        ])}`;

    cont.querySelector('#fraPrev').onclick = () => { folhaState.ano--; renderFolhaRel(); };
    cont.querySelector('#fraNext').onclick = () => { folhaState.ano++; renderFolhaRel(); };

    metricas.forEach(mt => {
        const el = document.getElementById(`fra_${mt.id}`);
        if (!el) return;
        const media = mt.vals.reduce((a, b) => a + b, 0) / 12;
        const c = new Chart(el, {
            type: 'bar',
            data: {
                labels: MESES,
                datasets: [
                    {
                        label: mt.label, data: mt.vals,
                        backgroundColor: mt.cor + 'cc', hoverBackgroundColor: mt.cor,
                        borderRadius: 5, maxBarThickness: 34, order: 2
                    },
                    {
                        type: 'line', label: 'Média', data: Array(12).fill(media),
                        borderColor: DV.s6, borderWidth: 1.5, borderDash: [5, 4],
                        pointRadius: 0, tension: 0, order: 1
                    }
                ]
            },
            options: folhaChartOpts()
        });
        folhaCharts.push(c);
    });
}

// Opções base para os gráficos anuais (barras com eixo em R$)
function folhaChartOpts() {
    return {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                padding: 10, backgroundColor: '#23233f', cornerRadius: 8,
                callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtBRL(ctx.parsed.y)}` }
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: DV.ink, font: { size: 10 } } },
            y: {
                beginAtZero: true, grid: { color: DV.grid }, border: { display: false },
                ticks: { color: DV.ink, font: { size: 10 }, callback: v => 'R$ ' + Number(v).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }) }
            }
        }
    };
}
