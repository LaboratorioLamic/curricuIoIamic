// ===== Banco de horas (CLT art. 59, §2º) =====
//
// Arquivo próprio, não dentro de lancamentos.js: aquele arquivo já passa de 1.700 linhas.
// O motor (cicloBhFunc, historicoCiclosBh, passivoBh) vive em utils.js, junto do de férias
// e do de ASO — aqui fica só a interface.
//
// A grade mensal é irmã da folha (mesmo path {ano-mes}/{funcionarioId}, mesma navegação,
// mesma edição inline com salvamento automático). A diferença que muda tudo: a folha FECHA
// no mês, o banco ACUMULA até o fim do ciclo e vira dinheiro se estourar. Por isso a coluna
// "Acumulado no ciclo" acompanha cada linha — sem ela, a grade seria um monte de números
// mensais sem a única leitura que importa.

let bhSub = 'programacao';        // programacao | grade | ciclos | extra
let bhFiltroUnidade = '';
let bhFiltroCargo = '';
const _bhHoje = new Date();
const bhState = {
    ano: _bhHoje.getFullYear(),
    mes: _bhHoje.getMonth(),      // 0–11
    banco: {},                    // rh_banco_horas inteiro: {ano-mes: {fid: linha}}
    fechamentos: [],              // encerramento do ciclo (fim do prazo ou desligamento)
    quitacoes: [],                // pagamento de meses DURANTE o ciclo — não encerra nada
    extras: []                    // rh_extra_banco: HE paga direto, fora do ciclo
};

const bhPassaFiltro = f =>
    (!bhFiltroUnidade || f?.unidadeId === bhFiltroUnidade) &&
    (!bhFiltroCargo || f?.cargoId === bhFiltroCargo);

const bhCargoDoFunc = f => lancState.cargos.find(c => c.id === f?.cargoId) || null;

// Saldo colorido. Positivo = a empresa deve horas ao funcionário (vira custo se não
// compensar); negativo = o funcionário deve horas. Nenhum dos dois é "erro", então nem
// vermelho nem verde: são duas direções da mesma conta, e a cor serve para varrer a coluna
// de olho, não para julgar.
const bhSaldoHtml = (min, cls = '') => {
    const n = Number(min) || 0;
    const tom = n > 0 ? 'bh-pos' : n < 0 ? 'bh-neg' : 'muted';
    return `<span class="${tom}${cls ? ' ' + cls : ''}">${fmtHHMM(n)}</span>`;
};

// ---- Filtros compartilhados pelas sub-abas (mesmo padrão de asoFiltrosHtml) ----
function bhFiltrosHtml(idUni, idCargo) {
    const un = lancState.unidades.find(u => u.id === bhFiltroUnidade);
    const cg = lancState.cargos.find(c => c.id === bhFiltroCargo);
    return `
        <button class="btn btn-secondary btn-filter${bhFiltroUnidade ? ' active' : ''}" id="${idUni}">${icon('building')} ${escapeHtml(un?.nome || 'Todas as unidades')}</button>
        <button class="btn btn-secondary btn-filter${bhFiltroCargo ? ' active' : ''}" id="${idCargo}">${icon('briefcase')} ${escapeHtml(cg?.nome || 'Todos os cargos')}</button>`;
}

function bhBindFiltros(idUni, idCargo, rerender) {
    const unis = lancState.unidades.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    const cargos = lancState.cargos.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    const bUni = document.getElementById(idUni);
    if (bUni) bUni.onclick = () => openFilterPopover(bUni, {
        allLabel: 'Todas as unidades',
        options: unis.map(u => ({ value: u.id, label: u.nome })),
        value: bhFiltroUnidade,
        searchable: unis.length > 6,
        onPick: v => { bhFiltroUnidade = v; rerender(); }
    });
    const bCargo = document.getElementById(idCargo);
    if (bCargo) bCargo.onclick = () => openFilterPopover(bCargo, {
        allLabel: 'Todos os cargos',
        options: cargos.map(c => ({ value: c.id, label: c.nome })),
        value: bhFiltroCargo,
        searchable: cargos.length > 6,
        onPick: v => { bhFiltroCargo = v; rerender(); }
    });
}

// ============ SHELL DA ABA ============
async function renderBancoHoras() {
    // A base da folha traz params (insalubridade, salário mínimo) e cargos — o cálculo do
    // valor de hora extra depende deles em todas as sub-abas, não só na grade.
    const [banco, fechamentos, quitacoes, extras] = await Promise.all([
        DB.getObj(PATHS.bancoHoras),
        DB.getAll(PATHS.bancoHorasFechamentos),
        DB.getAll(PATHS.bancoHorasQuitacoes),
        DB.getAll(PATHS.extraBanco),
        loadFolhaBase()
    ]);
    bhState.banco = banco || {};
    bhState.fechamentos = fechamentos;
    bhState.quitacoes = quitacoes;
    bhState.extras = extras;

    const cont = document.getElementById('lancContent');

    // Contador de urgência: vencidos = ciclo fechado com saldo não liquidado (vira passivo)
    const urgentes = lancState.funcionarios
        .map(f => cicloBhFunc(f, bhState.banco, fechamentos, null, quitacoes))
        .filter(s => s && s.status === 'vencido').length;

    cont.innerHTML = `
        <div class="flex-between" style="margin-bottom:14px">
            <div class="tabs tabs-sub" id="bhSubs" style="max-width:740px">
                <div class="tab" data-sub="programacao">${icon('alert')} Programação${urgentes ? `<span class="tab-count tab-count-alert">${urgentes}</span>` : ''}</div>
                <div class="tab" data-sub="grade">${icon('table')} Grade mensal</div>
                <div class="tab" data-sub="ciclos">${icon('refresh')} Ciclos</div>
                <div class="tab" data-sub="quitacoes" title="Pagamentos de horas durante o ciclo">${icon('check')} Quitações${quitacoes.length ? `<span class="tab-count">${quitacoes.length}</span>` : ''}</div>
                <div class="tab" data-sub="extra" title="Hora extra paga direto, fora do banco de horas">${icon('money')} Extra Banco</div>
            </div>
            <span class="badge badge-neutral" title="Prazo máximo para compensar o saldo. Configurável em Configurações → Parâmetros.">${icon('clock')} Ciclo de ${bhParams.cicloMeses} meses</span>
        </div>
        <div id="bhBody"></div>`;

    const subs = cont.querySelectorAll('#bhSubs .tab');
    const setSub = id => {
        bhSub = id;
        subs.forEach(t => t.classList.toggle('active', t.dataset.sub === id));
        ({ programacao: bhProgramacao, grade: bhGrade, ciclos: bhCiclos, quitacoes: bhQuitacoes, extra: bhExtra })[id]();
    };
    subs.forEach(t => t.onclick = () => setSub(t.dataset.sub));
    setSub(bhSub);
}

// Recarrega só o banco e redesenha a sub-aba corrente — evita refazer a página inteira
// depois de um save pontual.
async function bhReload() {
    const [banco, fechamentos, quitacoes, extras] = await Promise.all([
        DB.getObj(PATHS.bancoHoras),
        DB.getAll(PATHS.bancoHorasFechamentos),
        DB.getAll(PATHS.bancoHorasQuitacoes),
        DB.getAll(PATHS.extraBanco)
    ]);
    bhState.banco = banco || {};
    bhState.fechamentos = fechamentos;
    bhState.quitacoes = quitacoes;
    bhState.extras = extras;
    // A folha lê fechamentos/extras do folhaState para a coluna derivada — invalidar aqui
    // evita que a grade da folha mostre um total defasado depois de um fechamento.
    folhaState.carregado = false;
    // Os forms de fechamento/quitação também abrem a partir da ficha do funcionário
    // (aba Horas), fora da página de Lançamentos — lá #lancContent não existe no DOM, e
    // renderLancTab() quebraria em cima de um innerHTML de elemento nulo.
    if (document.getElementById('lancContent')) renderLancTab();
    // Mesma ideia do lado da ficha: se a aba Horas estiver aberta no drawer, redesenha com
    // os dados frescos em vez de deixar o saldo antigo na tela até o usuário trocar de aba.
    const fdCont = document.getElementById('fdContent');
    if (fdCont?.dataset.fdTab === 'horas' && fdHorasRefresh) fdHorasRefresh();
}

// ============ SUB-ABA: PROGRAMAÇÃO ============
// Fila derivada, nada gravado — igual à de férias e à de ASO. Quem fecha primeiro (ou já
// fechou devendo) aparece primeiro.
function bhProgramacao() {
    const box = document.getElementById('bhBody');
    const podeEditar = can('editar_lancamentos');
    const fin = can('ver_financeiro');

    const todos = lancState.funcionarios
        .map(f => ({ f, sit: cicloBhFunc(f, bhState.banco, bhState.fechamentos, null, bhState.quitacoes) }))
        .filter(x => x.sit && x.sit.status !== 'sem_ciclo');

    const linhas = todos
        .filter(x => bhPassaFiltro(x.f))
        .sort((a, b) => (BH_ORDEM[a.sit.status] - BH_ORDEM[b.sit.status]) || ((a.sit.dias ?? 0) - (b.sit.dias ?? 0)));

    const n = st => linhas.filter(x => x.sit.status === st).length;
    // Passivo só do que está em aberto: ciclo fechado já foi liquidado, não é mais dívida.
    const passivoTotal = linhas
        .filter(x => !x.sit.fechado && x.sit.acumuladoMin > 0)
        .reduce((s, x) => s + passivoBh(x.sit.acumuladoMin, salarioDoFunc(x.f), jornadaDe(x.f)), 0);

    box.innerHTML = `
        <div class="prog-resumo">
            ${[
                ['vencido', 'Ciclos vencidos — saldo não liquidado'],
                ['critico', `Fecham em até ${bhParams.alertaDias} dias`],
                ['atencao', 'Saldo acima da capacidade de compensar'],
                ['em_dia', 'Em dia']
            ].map(([st, txt]) => `
                <div class="prog-kpi prog-${st === 'vencido' ? 'vencida' : (st === 'critico' || st === 'atencao') ? 'critica' : 'aquisitivo'}">
                    <span class="prog-n">${n(st)}</span>
                    <span class="prog-lbl">${txt}</span>
                </div>`).join('')}
        </div>
        ${fin && passivoTotal > 0 ? `
        <div class="bh-passivo-aviso">
            ${icon('money')}
            <span>Passivo estimado dos ciclos em aberto: <strong>${fmtBRL(passivoTotal)}</strong>
            <span class="muted">— saldo positivo × valor-hora × adicional de ${bhParams.adicionalPct}%. Estimativa para dimensionar o risco; não lança na folha.</span></span>
        </div>` : ''}
        <div class="table-wrap">
            <div class="table-toolbar">
                <div class="search-box">${icon('search')}<input class="input" id="lancSearch" placeholder="Buscar por funcionário..."></div>
                ${bhFiltrosHtml('bhProgUni', 'bhProgCargo')}
                <div class="grow"></div>
            </div>
            <div class="table-scroll">
                <table class="table">
                    <thead><tr>
                        <th>Funcionário</th><th>Unidade</th>
                        <th title="Situação do ciclo de compensação em aberto">Situação</th>
                        <th class="num" title="Soma dos saldos mensais do ciclo corrente">Saldo do ciclo</th>
                        <th title="O ciclo começa no primeiro mês publicado para o funcionário">Ciclo</th>
                        <th title="Último dia para compensar. Depois disso, o saldo positivo é devido como hora extra">Fecha em</th>
                        ${fin ? '<th class="num" title="Estimativa do custo se o saldo não for compensado">Passivo est.</th>' : ''}
                        <th style="width:150px"></th>
                    </tr></thead>
                    <tbody id="lancTbody">${linhas.map(({ f, sit }) => {
                        const s = BH_STATUS[sit.status];
                        const passivo = passivoBh(sit.acumuladoMin, salarioDoFunc(f), jornadaDe(f));
                        return `
                        <tr data-id="${f.id}" data-search="${escapeHtml((f.nome + ' ' + unidadeNomeDe(f.unidadeId)).toLowerCase())}">
                            <td>
                                <div class="flex" style="gap:8px;align-items:center">
                                    ${avatarHtml(f)}
                                    <span class="prog-dot ${s.dot}"></span>
                                    <strong>${escapeHtml(f.nome)}</strong>
                                    ${f.demissao ? `<span class="badge badge-danger" title="Desligado em ${fmtDate(f.demissao)} — a rescisão exige a liquidação do saldo (art. 59, §3º)">Desligado</span>` : ''}
                                </div>
                                <div class="prog-aq">${escapeHtml(bhCargoDoFunc(f)?.nome || 'Sem cargo')}</div>
                            </td>
                            <td class="text-2">${escapeHtml(unidadeNomeDe(f.unidadeId))}</td>
                            <td><span class="badge ${s.cls}" title="${escapeHtml(sit.desc)}">${escapeHtml(sit.label)}</span></td>
                            <td class="num"><strong>${bhSaldoHtml(sit.acumuladoMin)}</strong>
                                <div class="bh-decomp">${fmtHHMM(sit.extraMin)} extra · ${fmtHHMM(sit.atrasoMin)} atraso</div>
                                ${sit.quitacoes.length ? `<div class="bh-decomp bh-quit-mini">${icon('check')} ${fmtHHMM(sit.quitadoMin)} já quitado</div>` : ''}</td>
                            <td class="text-2">${mesLabel(sit.inicio)} → ${mesLabel(sit.fimMes)}
                                <div class="prog-aq">${sit.lancados} ${sit.lancados === 1 ? 'mês lançado' : 'meses lançados'}</div></td>
                            <td class="text-2">${fmtDate(sit.fim)}
                                ${sit.dias != null ? `<div class="prog-dias ${sit.dias < 0 ? 'txt-danger' : ''}">${sit.dias < 0 ? '−' : ''}${fmtNum(Math.abs(sit.dias))} dias</div>` : ''}</td>
                            ${fin ? `<td class="num text-2">${passivo > 0 ? fmtBRL(passivo) : '—'}</td>` : ''}
                            <td>${sit.fechado
                                ? `<span class="muted">${icon('check')} liquidado</span>`
                                : podeEditar && sit.acumuladoMin !== 0
                                    // Fechar só no fim do prazo ou no desligamento. Antes disso, o
                                    // caminho para pagar horas é a quitação — o ciclo segue correndo.
                                    ? (sit.podeFechar
                                        ? `<button class="btn btn-sm ${sit.status === 'vencido' ? 'btn-primary' : 'btn-secondary'}" data-fechar>${icon('check')} Fechar ciclo</button>`
                                        : `<button class="btn btn-sm btn-secondary" data-quitar>${icon('money')} Quitar horas</button>`)
                                    : ''}</td>
                        </tr>`;
                    }).join('')}</tbody>
                </table>
            </div>
        </div>`;

    if (!linhas.length) {
        document.getElementById('lancTbody').innerHTML =
            `<tr><td colspan="10"><div class="table-empty">${icon('check')}<span>Nenhum funcionário com banco de horas. O ciclo nasce no primeiro saldo publicado na Grade mensal.</span></div></td></tr>`;
    }
    document.getElementById('lancSearch').addEventListener('input', () => lancAplicaFiltros());
    bindAvatarFotos(box);
    bhBindFiltros('bhProgUni', 'bhProgCargo', bhProgramacao);

    box.querySelectorAll('#lancTbody tr[data-id]').forEach(tr => {
        const item = linhas.find(x => x.f.id === tr.dataset.id);
        tr.classList.add('row-clickable');
        tr.onclick = () => detalheCicloBh(item.f, item.sit);
        const bFechar = tr.querySelector('[data-fechar]');
        if (bFechar) bFechar.onclick = e => { e.stopPropagation(); formFechamentoBh(item.f, item.sit); };
        const bQuitar = tr.querySelector('[data-quitar]');
        if (bQuitar) bQuitar.onclick = e => { e.stopPropagation(); formQuitacaoBh(item.f, item.sit); };
    });
}

// Salário atual do funcionário: ficha primeiro, cargo como fallback — mesma precedência
// que a folha usa no pré-preenchimento.
// Lia `salarioBase` num cargo que só gravava `salario`: nunca achava o valor do cargo, e o
// passivo de quem não tem salário individual saía zerado. `salarioDe` resolve os dois nomes
// e o salário mínimo derivado.
const salarioDoFunc = f => salarioDe(f, bhCargoDoFunc(f), folhaState.params);

// ============ SUB-ABA: GRADE MENSAL ============
// Clona a estrutura da folha (navegação de mês, edição inline, salvamento automático).
// Diferenças deliberadas:
//  • células em HH:MM (parseHHMM), não number — o RH pensa em horas, não em minutos
//  • coluna "Acumulado no ciclo" read-only: é derivada, e célula editável que se sobrescreve
//    sozinha no próximo render é uma mentira para o usuário
//  • sem "gerar grade": lançar banco de horas é exceção, não rotina. Pré-gerar 20 linhas
//    zeradas criaria ciclo para quem não tem acordo de compensação — e o ciclo nasce do
//    primeiro lançamento, então a linha zerada teria efeito colateral silencioso.
async function bhGrade() {
    await loadFolhaBase();
    const box = document.getElementById('bhBody');
    const { ano, mes } = bhState;
    const key = mesKey(ano, mes);
    const podeEditar = can('editar_lancamentos');
    const dados = bhState.banco[key] || {};

    const nav = `
        <div class="month-nav">
            <button id="bhPrev" title="Mês anterior">‹</button>
            <span class="month-label">${MESES_FULL[mes]} ${ano}</span>
            <button id="bhNext" title="Próximo mês">›</button>
        </div>`;

    // Elegível: trabalhou ao menos um dia no mês. Quem já tem linha aparece sempre, mesmo
    // se desligado depois — o saldo lançado não some da grade por causa do desligamento.
    const eleg = elegiveisNoMes(ano, mes)
        .filter(f => bhPassaFiltro(f))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    const extras = Object.keys(dados)
        .filter(id => !eleg.some(f => f.id === id))
        .map(id => lancState.funcionarios.find(f => f.id === id))
        .filter(f => f && bhPassaFiltro(f));
    const todos = [...eleg, ...extras];

    const futuro = key > mesHoje();
    const somaMin = ids => ids.reduce((s, id) => s + bhSaldoLinha(dados[id]), 0);
    const idsComLinha = () => todos.filter(f => dados[f.id]).map(f => f.id);

    box.innerHTML = `
        <div class="flex-between" style="margin-bottom:12px;flex-wrap:wrap;gap:10px">
            ${nav}
            <div class="flex" style="flex-wrap:wrap;gap:8px">
                ${bhFiltrosHtml('bhGradeUni', 'bhGradeCargo')}
                <span class="badge badge-accent" id="bhTotalBadge">Saldo do mês: ${fmtHHMM(somaMin(idsComLinha()))}</span>
            </div>
        </div>
        ${futuro ? `<div class="bh-aviso-futuro">${icon('alert')} <span>${MESES_FULL[mes]} de ${ano} ainda não aconteceu. Lançamentos em mês futuro não entram no ciclo corrente até o mês chegar.</span></div>` : ''}
        <div class="table-wrap">
            <div class="table-scroll">
                <table class="table bh-table">
                    <thead><tr>
                        <th>Funcionário</th>
                        <th class="num" title="Horas trabalhadas além da jornada no mês">Extra</th>
                        <th class="num" title="Atrasos, saídas antecipadas e faltas de horário no mês">Atraso</th>
                        <th class="num" title="Extra − Atraso do mês">Saldo do mês</th>
                        <th class="num" title="Soma dos saldos do ciclo até este mês — derivado, não editável">Acumulado no ciclo</th>
                        <th title="Ciclo corrente do funcionário">Ciclo</th>
                        <th style="width:40px"></th>
                    </tr></thead>
                    <tbody id="bhTbody">${todos.map(f => {
                        const l = dados[f.id];
                        const sit = cicloBhFunc(f, bhState.banco, bhState.fechamentos, null, bhState.quitacoes);
                        // Acumulado ATÉ este mês (não o do ciclo inteiro): a linha responde
                        // "como estava o saldo depois deste mês", que é a leitura da grade.
                        const acum = bhAcumuladoAte(f, key);
                        // Mês quitado é intocável: as horas viraram dinheiro pago. Editar
                        // aqui faria a folha divergir do recibo sem ninguém notar. Para
                        // corrigir, exclui-se a quitação — ato explícito e reversível.
                        const quit = mesBhQuitado(f.id, key, bhState.quitacoes);
                        const editavel = podeEditar && !quit;
                        return `
                        <tr data-fid="${f.id}"${quit ? ' class="bh-row-quitada"' : ''}>
                            <td style="white-space:nowrap">
                                <div class="flex" style="gap:8px;align-items:center">
                                    ${avatarHtml(f)}
                                    <div>
                                        <strong>${escapeHtml(f.nome)}</strong>
                                        ${f.demissao ? `<span class="badge badge-danger" style="margin-left:6px" title="Desligado em ${fmtDate(f.demissao)}">Desligado</span>` : ''}
                                        <div class="prog-aq">${escapeHtml(unidadeNomeDe(f.unidadeId))}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="num">${editavel
                                ? `<input class="input bh-cell" data-col="extraMin" placeholder="–" value="${l ? fmtHHMM(l.extraMin) : ''}">`
                                : (l ? fmtHHMM(l.extraMin) : '—')}</td>
                            <td class="num">${editavel
                                ? `<input class="input bh-cell" data-col="atrasoMin" placeholder="–" value="${l ? fmtHHMM(l.atrasoMin) : ''}">`
                                : (l ? fmtHHMM(l.atrasoMin) : '—')}</td>
                            <td class="num"><strong data-saldo>${l ? bhSaldoHtml(bhSaldoLinha(l)) : '<span class="muted">—</span>'}</strong></td>
                            <td class="num" data-acum>${quit
                                ? `<button class="bh-quit-tag" data-quit="${quit.id}" title="Pago em ${fmtDate(quit.data)}${quit.valor ? ` — ${fmtBRL(quit.valor)}` : ''}. Clique para ver a quitação.">${icon('lock')} quitado</button>`
                                : (l ? bhSaldoHtml(acum) : '<span class="muted">—</span>')}</td>
                            <td class="text-2" data-ciclo>${sit && sit.status !== 'sem_ciclo'
                                ? `${mesLabel(sit.inicio)} → ${mesLabel(sit.fimMes)}<div class="prog-aq">${escapeHtml(sit.label)}</div>`
                                : '<span class="muted">sem ciclo</span>'}</td>
                            <td>${editavel && l ? `<button class="btn-icon btn-icon-sm" data-limpar title="Remover o lançamento deste mês">${icon('trash')}</button>` : ''}</td>
                        </tr>`;
                    }).join('')}</tbody>
                    <tfoot><tr>
                        <td><strong>Total do mês</strong></td>
                        <td class="num"><strong data-tcol="extraMin">${fmtHHMM(idsComLinha().reduce((s, id) => s + (Number(dados[id].extraMin) || 0), 0))}</strong></td>
                        <td class="num"><strong data-tcol="atrasoMin">${fmtHHMM(idsComLinha().reduce((s, id) => s + (Number(dados[id].atrasoMin) || 0), 0))}</strong></td>
                        <td class="num"><strong data-tsaldo>${fmtHHMM(somaMin(idsComLinha()))}</strong></td>
                        <td colspan="3"></td>
                    </tr></tfoot>
                </table>
            </div>
        </div>
        <p class="muted" style="margin-top:10px;font-size:12px">
            Digite em <strong>HH:MM</strong> (aceita também <code>8h30</code>, <code>8,5h</code> ou minutos puros) — o salvamento é automático ao sair da célula.
            Deixe em branco para não lançar nada no mês. O <strong>ciclo de ${bhParams.cicloMeses} meses começa no primeiro mês publicado</strong> para cada funcionário.
            Meses marcados como <strong>quitados</strong> não são editáveis: as horas já viraram pagamento. Para corrigi-los, exclua a quitação na aba Quitações.
        </p>`;

    if (!todos.length) {
        document.getElementById('bhTbody').innerHTML =
            `<tr><td colspan="7"><div class="table-empty">${icon('filter')}<span>Nenhum funcionário elegível neste mês (ou no filtro atual).</span></div></td></tr>`;
    }

    box.querySelector('#bhPrev').onclick = () => {
        bhState.mes--;
        if (bhState.mes < 0) { bhState.mes = 11; bhState.ano--; }
        bhGrade();
    };
    box.querySelector('#bhNext').onclick = () => {
        bhState.mes++;
        if (bhState.mes > 11) { bhState.mes = 0; bhState.ano++; }
        bhGrade();
    };
    bhBindFiltros('bhGradeUni', 'bhGradeCargo', bhGrade);
    bindAvatarFotos(box);
    if (podeEditar) bhBindCelulas(key);

    box.querySelectorAll('[data-quit]').forEach(btn => {
        btn.onclick = () => {
            const q = bhState.quitacoes.find(x => x.id === btn.dataset.quit);
            if (q) detalheQuitacao(q);
        };
    });
}

// Acumulado do ciclo do funcionário ATÉ o mês `ateMes` (inclusive). Reusa o motor para não
// duplicar a regra de qual ciclo é o corrente.
function bhAcumuladoAte(f, ateMes) {
    const sit = cicloBhFunc(f, bhState.banco, bhState.fechamentos, null, bhState.quitacoes);
    if (!sit || sit.status === 'sem_ciclo') return 0;
    // Só os meses EM ABERTO: o acumulado da grade responde "quanto ainda se deve depois
    // deste mês". Somar mês quitado inflaria o saldo com horas que já foram pagas.
    return sit.abertos.filter(m => m.mes <= ateMes).reduce((s, m) => s + m.saldoMin, 0);
}

// Edição inline: salva ao sair da célula (blur), como a folha. O parse é tolerante mas
// nunca silencioso — entrada ilegível volta ao valor anterior com aviso, em vez de virar 0.
function bhBindCelulas(key) {
    const box = document.getElementById('bhBody');

    box.querySelectorAll('.bh-cell').forEach(inp => {
        const tr = inp.closest('tr');
        const fid = tr.dataset.fid;
        const col = inp.dataset.col;
        let anterior = inp.value;

        inp.onfocus = () => { anterior = inp.value; inp.select(); };
        inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = anterior; inp.blur(); } };
        inp.onblur = async () => {
            const bruto = inp.value.trim();
            if (bruto === anterior) return;

            // Vazio nas DUAS colunas = remover o lançamento do mês. Gravar 00:00 criaria
            // ciclo para quem não tem acordo — o ciclo nasce do primeiro lançamento.
            const outraInp = tr.querySelector(`.bh-cell[data-col="${col === 'extraMin' ? 'atrasoMin' : 'extraMin'}"]`);
            const outraVazia = !outraInp || !outraInp.value.trim();
            if (!bruto && outraVazia) {
                await bhRemoverLinha(key, fid);
                return;
            }

            const min = bruto ? parseHHMM(bruto) : 0;
            if (min == null) {
                inp.value = anterior;
                return toast(`"${bruto}" não é um valor de horas válido. Use HH:MM (ex: 8:30).`, 'error');
            }
            if (min < 0) {
                inp.value = anterior;
                return toast('Extra e atraso são quantidades — use valores positivos. O saldo negativo aparece sozinho quando o atraso supera a extra.', 'error');
            }

            inp.value = fmtHHMM(min);                 // normaliza o que o usuário digitou
            anterior = inp.value;

            const linha = { ...(bhState.banco[key]?.[fid] || { extraMin: 0, atrasoMin: 0 }), [col]: min, lancadoEm: hoje() };
            const eraNovo = !bhState.banco[key]?.[fid];

            // Otimista: atualiza o estado local antes do round-trip para o acumulado e o
            // ciclo recalcularem na hora. O save é idempotente; erro reverte com reload.
            bhState.banco[key] = { ...(bhState.banco[key] || {}), [fid]: linha };
            bhAtualizaLinha(tr, fid, key);

            try {
                await DB.save(`${PATHS.bancoHoras}/${key}`, fid, linha);
                // Primeiro lançamento do funcionário pode ter movido a âncora do ciclo — a
                // grade inteira precisa refletir isso, não só esta linha.
                if (eraNovo) bhAvisaAncora(fid, key);
            } catch (e) {
                toast('Erro ao salvar: ' + (e.message || ''), 'error');
                bhReload();
            }
        };
    });

    box.querySelectorAll('[data-limpar]').forEach(btn => {
        const fid = btn.closest('tr').dataset.fid;
        btn.onclick = async () => {
            const f = lancState.funcionarios.find(x => x.id === fid);
            if (!await confirmDialog({
                title: 'Remover lançamento',
                message: `Remover o saldo de ${MESES_FULL[bhState.mes]}/${bhState.ano} de ${f?.nome || 'este funcionário'}? Se for o primeiro mês do banco dele, o início do ciclo passa a ser o mês seguinte que tiver lançamento.`,
                confirmText: 'Remover', danger: true
            })) return;
            await bhRemoverLinha(key, fid);
        };
    });
}

async function bhRemoverLinha(key, fid) {
    try {
        await DB.remove(`${PATHS.bancoHoras}/${key}`, fid);
        if (bhState.banco[key]) delete bhState.banco[key][fid];
        bhGrade();
        toast('Lançamento removido.');
    } catch (e) {
        toast('Erro ao remover: ' + (e.message || ''), 'error');
        bhReload();
    }
}

// Redesenha saldo/acumulado/ciclo de uma linha sem refazer a tabela — a edição inline tem
// que responder na hora, e o acumulado é a razão de ser da grade.
function bhAtualizaLinha(tr, fid, key) {
    const f = lancState.funcionarios.find(x => x.id === fid);
    const l = bhState.banco[key]?.[fid];
    const sit = cicloBhFunc(f, bhState.banco, bhState.fechamentos, null, bhState.quitacoes);

    tr.querySelector('[data-saldo]').innerHTML = l ? bhSaldoHtml(bhSaldoLinha(l)) : '<span class="muted">—</span>';
    tr.querySelector('[data-acum]').innerHTML = l ? bhSaldoHtml(bhAcumuladoAte(f, key)) : '<span class="muted">—</span>';
    tr.querySelector('[data-ciclo]').innerHTML = sit && sit.status !== 'sem_ciclo'
        ? `${mesLabel(sit.inicio)} → ${mesLabel(sit.fimMes)}<div class="prog-aq">${escapeHtml(sit.label)}</div>`
        : '<span class="muted">sem ciclo</span>';

    // Rodapé e badge do mês
    const dados = bhState.banco[key] || {};
    const ids = Object.keys(dados);
    const box = document.getElementById('bhBody');
    ['extraMin', 'atrasoMin'].forEach(c => {
        const el = box.querySelector(`[data-tcol="${c}"]`);
        if (el) el.textContent = fmtHHMM(ids.reduce((s, i) => s + (Number(dados[i][c]) || 0), 0));
    });
    const soma = ids.reduce((s, i) => s + bhSaldoLinha(dados[i]), 0);
    const ts = box.querySelector('[data-tsaldo]');
    if (ts) ts.textContent = fmtHHMM(soma);
    const badge = box.querySelector('#bhTotalBadge');
    if (badge) badge.textContent = `Saldo do mês: ${fmtHHMM(soma)}`;
}

// Lançamento retroativo anterior ao início do ciclo reancora o ciclo inteiro. É o
// comportamento correto (o ciclo começa no primeiro lançamento que EXISTE), mas é
// surpreendente — avisar é o que separa "o sistema se corrigiu" de "o sistema mudou meu
// prazo sem falar nada".
function bhAvisaAncora(fid, key) {
    const f = lancState.funcionarios.find(x => x.id === fid);
    const sit = cicloBhFunc(f, bhState.banco, bhState.fechamentos, null, bhState.quitacoes);
    if (!sit || sit.status === 'sem_ciclo') return;
    if (sit.ancora !== key) return;      // não é o primeiro lançamento dele: nada mudou
    toast(`Ciclo de ${f?.nome?.split(' ')[0] || 'funcionário'} ancorado em ${mesLabel(key)} — fecha em ${fmtDate(sit.fim)}.`, 'info', 5000);
    bhGrade();
}

// ============ SUB-ABA: CICLOS ============
// Um card por funcionário com banco: barra de progresso do ciclo corrente + histórico.
// É a tela que responde "onde esse ciclo está e o que aconteceu nos anteriores" — que a
// grade mensal, por ser mês a mês, não consegue mostrar.
function bhCiclos() {
    const box = document.getElementById('bhBody');
    const fin = can('ver_financeiro');
    const podeEditar = can('editar_lancamentos');

    const itens = lancState.funcionarios
        .filter(f => bhPassaFiltro(f))
        .map(f => ({ f, sit: cicloBhFunc(f, bhState.banco, bhState.fechamentos, null, bhState.quitacoes), hist: historicoCiclosBh(f, bhState.banco, bhState.fechamentos, null, bhState.quitacoes) }))
        .filter(x => x.sit && x.sit.status !== 'sem_ciclo')
        .sort((a, b) => (BH_ORDEM[a.sit.status] - BH_ORDEM[b.sit.status]) || ((a.sit.dias ?? 0) - (b.sit.dias ?? 0)));

    box.innerHTML = `
        <div class="table-toolbar" style="margin-bottom:14px">
            <div class="search-box">${icon('search')}<input class="input" id="bhCicloSearch" placeholder="Buscar por funcionário..."></div>
            ${bhFiltrosHtml('bhCicloUni', 'bhCicloCargo')}
            <div class="grow"></div>
        </div>
        <div class="bh-ciclos-grid" id="bhCiclosGrid">
            ${itens.map(({ f, sit, hist }) => {
                const s = BH_STATUS[sit.status];
                const decorridos = Math.min(bhParams.cicloMeses, mesDiff(sit.inicio, mesHoje()) + 1);
                const pct = Math.max(0, Math.min(100, decorridos / bhParams.cicloMeses * 100));
                const passivo = passivoBh(sit.acumuladoMin, salarioDoFunc(f), jornadaDe(f));
                const anteriores = hist.filter(c => !c.corrente).reverse();
                return `
                <div class="bh-ciclo-card row-clickable" data-card="${f.id}" data-search="${escapeHtml(f.nome.toLowerCase())}">
                    <div class="bh-ciclo-head">
                        <div class="flex" style="gap:8px;align-items:center">
                            ${avatarHtml(f)}
                            <div>
                                <div class="flex" style="gap:8px">
                                    <span class="prog-dot ${s.dot}"></span>
                                    <strong>${escapeHtml(f.nome)}</strong>
                                </div>
                                <div class="prog-aq">${escapeHtml(unidadeNomeDe(f.unidadeId))} · ${escapeHtml(bhCargoDoFunc(f)?.nome || 'Sem cargo')}</div>
                            </div>
                        </div>
                        <span class="badge ${s.cls}" title="${escapeHtml(sit.desc)}">${escapeHtml(sit.label)}</span>
                    </div>

                    <div class="bh-ciclo-saldo">
                        <div class="bh-saldo-big">${bhSaldoHtml(sit.acumuladoMin)}</div>
                        <div class="bh-saldo-comp">
                            <span class="bh-pos">${fmtHHMM(sit.extraMin)}</span> extra
                            <span class="bh-sep">·</span>
                            <span class="bh-neg">${fmtHHMM(sit.atrasoMin)}</span> atraso
                            ${fin && passivo > 0 ? `<span class="bh-sep">·</span> <span title="Estimativa se não for compensado">${fmtBRL(passivo)}</span>` : ''}
                        </div>
                        ${sit.quitacoes.length ? `
                        <div class="bh-quit-resumo" title="Meses já pagos — não entram no saldo em aberto">
                            ${icon('check')} <strong>${fmtHHMM(sit.quitadoMin)}</strong> quitados em ${sit.quitacoes.length} ${sit.quitacoes.length === 1 ? 'pagamento' : 'pagamentos'}${fin && sit.quitadoValor ? ` · ${fmtBRL(sit.quitadoValor)}` : ''}
                        </div>` : ''}
                    </div>

                    <div class="bh-prog-wrap" title="${decorridos} de ${bhParams.cicloMeses} meses do ciclo">
                        <div class="bh-prog-bar ${sit.status === 'vencido' ? 'is-estourado' : ''}"><div class="bh-prog-fill ${sit.status === 'vencido' ? 'is-vencido' : sit.status === 'critico' || sit.status === 'atencao' ? 'is-critico' : ''}" style="width:${pct}%"></div></div>
                        <div class="bh-prog-meses">
                            ${Array.from({ length: bhParams.cicloMeses }, (_, i) => {
                                const mk = mesAdd(sit.inicio, i);
                                const lanc = sit.meses.find(m => m.mes === mk);
                                const q = sit.quitados.some(x => x.mes === mk);
                                // Mês quitado tem marca própria: já saiu do saldo em aberto,
                                // então colori-lo como crédito/débito seria contar duas vezes.
                                const cls = q ? 'is-quitado' : !lanc ? 'is-vazio' : lanc.saldoMin > 0 ? 'is-pos' : lanc.saldoMin < 0 ? 'is-neg' : 'is-zero';
                                return `<span class="bh-mes-dot ${cls}" title="${mesLabel(mk)}: ${lanc ? fmtHHMM(lanc.saldoMin) : 'sem lançamento'}${q ? ' — quitado' : ''}"></span>`;
                            }).join('')}
                        </div>
                        <div class="bh-ciclo-datas">
                            <span>${mesLabel(sit.inicio)}</span>
                            <span class="${sit.dias != null && sit.dias < 0 ? 'txt-danger' : ''}">${sit.dias == null ? '' : sit.dias < 0 ? `venceu há ${prazoTexto(sit.dias)}` : `${prazoTexto(sit.dias)} restantes`}</span>
                            <span>${fmtDate(sit.fim)}</span>
                        </div>
                    </div>

                    ${!anteriores.length ? `
                    <div class="bh-hist bh-hist-vazio">
                        <div class="bh-hist-tit">Ciclos anteriores</div>
                        <span class="muted">Primeiro ciclo — nenhum anterior.</span>
                    </div>` : `
                    <div class="bh-hist">
                        <div class="bh-hist-tit">Ciclos anteriores</div>
                        ${anteriores.map(c => `
                            <div class="bh-hist-row">
                                <span class="text-2">${mesLabel(c.inicio)} → ${mesLabel(c.fimMes)}</span>
                                <span class="num">${bhSaldoHtml(c.acumuladoMin)}</span>
                                <span>${c.fechamento
                                    ? `<span class="badge badge-success" title="${escapeHtml(`${fmtDate(c.fechamento.data)}${c.fechamento.valor ? ' · ' + fmtBRL(c.fechamento.valor) : ''}${c.fechamento.obs ? ' — ' + c.fechamento.obs : ''}`)}">${escapeHtml(c.fechamento.destino)}</span>`
                                    : c.acumuladoMin === 0
                                        ? '<span class="muted">encerrado zerado</span>'
                                        : '<span class="badge badge-danger">não liquidado</span>'}</span>
                            </div>`).join('')}
                    </div>`}

                    ${podeEditar && !sit.fechado && sit.acumuladoMin !== 0 ? (sit.podeFechar
                        ? `<button class="btn btn-secondary btn-sm mt-8" data-fechar="${f.id}">${icon('check')} Fechar ciclo corrente</button>`
                        : `<button class="btn btn-secondary btn-sm mt-8" data-quitar="${f.id}">${icon('money')} Quitar horas do ciclo</button>`) : ''}
                </div>`;
            }).join('')}
        </div>`;

    if (!itens.length) {
        document.getElementById('bhCiclosGrid').outerHTML = emptyState({
            icon: 'clock', title: 'Nenhum ciclo em andamento',
            text: 'O ciclo de cada funcionário nasce no primeiro saldo publicado na Grade mensal.'
        });
        return;
    }

    document.getElementById('bhCicloSearch').addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        box.querySelectorAll('.bh-ciclo-card').forEach(c => {
            c.style.display = c.dataset.search.includes(q) ? '' : 'none';
        });
    });
    bhBindFiltros('bhCicloUni', 'bhCicloCargo', bhCiclos);
    bindAvatarFotos(box);

    box.querySelectorAll('[data-card]').forEach(card => {
        card.onclick = () => {
            const item = itens.find(x => x.f.id === card.dataset.card);
            if (item) detalheCicloBh(item.f, item.sit);
        };
    });
    box.querySelectorAll('[data-fechar]').forEach(btn => {
        btn.onclick = e => {
            e.stopPropagation();
            const item = itens.find(x => x.f.id === btn.dataset.fechar);
            formFechamentoBh(item.f, item.sit);
        };
    });
    box.querySelectorAll('[data-quitar]').forEach(btn => {
        btn.onclick = e => {
            e.stopPropagation();
            const item = itens.find(x => x.f.id === btn.dataset.quitar);
            formQuitacaoBh(item.f, item.sit);
        };
    });
}

// ============ JANELA: SITUAÇÃO DO CICLO ============
// Abre pela linha da Programação ou pelo card de Ciclos. Responde as três perguntas que o
// RH faz antes de agir: como está o ciclo agora, o que já foi pago, e o que ainda falta.
function detalheCicloBh(f, sit) {
    const fin = can('ver_financeiro');
    const podeEditar = can('editar_lancamentos');
    const s = BH_STATUS[sit.status];
    const passivo = passivoBh(sit.acumuladoMin, salarioDoFunc(f), jornadaDe(f));
    const decorridos = Math.min(bhParams.cicloMeses, Math.max(0, mesDiff(sit.inicio, mesHoje()) + 1));
    const pct = Math.max(0, Math.min(100, decorridos / bhParams.cicloMeses * 100));

    // Histórico completo: a régua derivada já contém todos os ciclos do funcionário desde a
    // âncora. Ninguém lia esse dado — a janela mostrava só o ciclo corrente, e o RH não tinha
    // onde ver o que foi fechado antes nem por quanto.
    const hist = historicoCiclosBh(f, bhState.banco, bhState.fechamentos, null, bhState.quitacoes)
        .slice().reverse();                      // mais recente primeiro: é o que se procura

    const m = openModal({
        titleHtml: dhFuncCardHtml(f),
        size: 'md',
        body: `
            <div class="dc-tabs" role="tablist">
                <button class="dc-tab is-active" data-dctab="situacao" role="tab">${icon('refresh')} Situação atual</button>
                <button class="dc-tab" data-dctab="historico" role="tab">${icon('clock')} Histórico
                    ${hist.length ? `<span class="dc-tab-badge">${hist.length}</span>` : ''}</button>
            </div>

            <div data-dcpane="situacao">
            <div class="dc-hero ${sit.status === 'vencido' ? 'is-vencido' : sit.status === 'critico' || sit.status === 'atencao' ? 'is-critico' : 'is-ok'}">
                <div class="dc-hero-top">
                    <div>
                        <span class="dc-lbl">Saldo em aberto</span>
                        <div class="dc-saldo">${fmtHHMM(sit.acumuladoMin)}</div>
                        <div class="dc-decomp">
                            <span class="bh-pos">${fmtHHMM(sit.extraMin)}</span> extra
                            <span class="bh-sep">·</span>
                            <span class="bh-neg">${fmtHHMM(sit.atrasoMin)}</span> atraso
                        </div>
                    </div>
                    <div class="dc-hero-right">
                        <span class="badge ${s.cls}">${escapeHtml(sit.label)}</span>
                        ${fin && passivo > 0 ? `<div class="dc-passivo" title="Estimativa: saldo × valor-hora × adicional de ${bhParams.adicionalPct}%">${fmtBRL(passivo)}<span>se não compensar</span></div>` : ''}
                    </div>
                </div>
                <p class="dc-desc">${escapeHtml(sit.desc)}</p>
            </div>

            <div class="dc-sec">
                <div class="dc-sec-tit">${icon('refresh')} Ciclo ${mesLabel(sit.inicio)} → ${mesLabel(sit.fimMes)}</div>
                <div class="bh-prog-bar ${sit.status === 'vencido' ? 'is-estourado' : ''}" style="margin-bottom:8px">
                    <div class="bh-prog-fill ${sit.status === 'vencido' ? 'is-vencido' : sit.status === 'critico' || sit.status === 'atencao' ? 'is-critico' : ''}" style="width:${pct}%"></div>
                </div>
                <div class="dc-meses">
                    ${Array.from({ length: bhParams.cicloMeses }, (_, i) => {
                        const mk = mesAdd(sit.inicio, i);
                        const lanc = sit.meses.find(x => x.mes === mk);
                        const q = sit.quitados.some(x => x.mes === mk);
                        const cls = q ? 'is-quitado' : !lanc ? 'is-vazio' : lanc.saldoMin > 0 ? 'is-pos' : lanc.saldoMin < 0 ? 'is-neg' : 'is-zero';
                        return `
                        <div class="dc-mes ${cls}">
                            <span class="dc-mes-lbl">${mesLabel(mk).split('/')[0]}</span>
                            <span class="dc-mes-val">${lanc ? fmtHHMM(lanc.saldoMin) : '–'}</span>
                            ${q ? `<span class="dc-mes-tag">${icon('lock')}</span>` : ''}
                        </div>`;
                    }).join('')}
                </div>
                <div class="dc-datas">
                    <span>Início ${fmtDate(sit.inicio + '-01')}</span>
                    <span class="${sit.dias != null && sit.dias < 0 ? 'txt-danger' : ''}">${sit.dias == null ? '' : sit.dias < 0 ? `venceu há ${prazoTexto(sit.dias)}` : `${prazoTexto(sit.dias)} restantes`}</span>
                    <span>Fecha ${fmtDate(sit.fim)}</span>
                </div>
            </div>

            <div class="dc-sec">
                <div class="dc-sec-tit">${icon('money')} Quitações deste ciclo
                    ${sit.quitacoes.length ? `<span class="dc-sec-badge">${fmtHHMM(sit.quitadoMin)}${fin && sit.quitadoValor ? ` · ${fmtBRL(sit.quitadoValor)}` : ''}</span>` : ''}
                </div>
                ${sit.quitacoes.length ? `
                <div class="dc-quits">
                    ${sit.quitacoes.map(q => `
                        <div class="dc-quit" data-q="${q.id}">
                            <span class="dc-quit-ico">${icon('check')}</span>
                            <div class="grow">
                                <strong>${fmtHHMM(q.minutos)}</strong> — ${(q.meses || []).map(mesLabel).join(', ')}
                                <div class="muted">${fmtDate(q.data)} · ${escapeHtml(destinoQuitacao(q))}${q.obs ? ` · ${escapeHtml(q.obs)}` : ''}</div>
                            </div>
                            ${fin ? `<strong class="num">${fmtBRL(q.valor)}</strong>` : ''}
                            ${icon('chevronRight')}
                        </div>`).join('')}
                </div>` : `
                <div class="dc-vazio">${icon('info')} Nenhuma hora quitada neste ciclo. O saldo em aberto ainda pode ser compensado com folgas até ${fmtDate(sit.fim)}.</div>`}
            </div>

            ${sit.fechado ? `
            <div class="dc-fech">
                ${icon('check')}
                <div class="grow">
                    <strong>Ciclo fechado em ${fmtDate(sit.fechado.data)}</strong>
                    <div class="muted">${escapeHtml(sit.fechado.destino)}${fin && sit.fechado.valor ? ` · ${fmtBRL(sit.fechado.valor)}` : ''}${sit.fechado.obs ? ` — ${escapeHtml(sit.fechado.obs)}` : ''}</div>
                </div>
            </div>` : sit.motivoNaoFechar ? `
            <div class="dc-nota">${icon('info')} <span>${escapeHtml(sit.motivoNaoFechar)}</span></div>` : ''}
            </div>

            <div data-dcpane="historico" hidden>
                ${hist.length ? `
                <div class="dc-hist-resumo">
                    <div><span>Ciclos</span><strong>${hist.length}</strong></div>
                    <div><span>Fechados</span><strong>${hist.filter(c => c.fechamento).length}</strong></div>
                    ${fin ? `<div><span>Total pago</span><strong>${fmtBRL(
                        hist.reduce((s, c) => s + c.quitadoValor
                            + (c.fechamento?.destino === BH_DESTINO_PAGO ? Number(c.fechamento.valor) || 0 : 0), 0)
                    )}</strong></div>` : ''}
                </div>
                <div class="dc-hist">
                    ${hist.map(c => {
                        const fech = c.fechamento;
                        const pagoFech = fech?.destino === BH_DESTINO_PAGO ? Number(fech.valor) || 0 : 0;
                        // Um ciclo passado sem fechamento e com saldo é dinheiro parado: é o
                        // que o mapa de ciclos existe para não deixar sumir.
                        const estado = fech ? 'fechado'
                            : c.corrente ? 'corrente'
                            : c.acumuladoMin !== 0 ? 'aberto' : 'zerado';
                        const rot = { fechado: 'Fechado', corrente: 'Em curso', aberto: 'Em aberto', zerado: 'Encerrado sem saldo' }[estado];
                        return `
                        <div class="dc-hist-item is-${estado}" ${fech ? `data-fech="${fech.id}"` : ''}>
                            <div class="dc-hist-per">
                                <strong>${mesLabel(c.inicio)} → ${mesLabel(c.fimMes)}</strong>
                                <span class="badge ${estado === 'fechado' ? 'badge-success' : estado === 'aberto' ? 'badge-danger' : estado === 'corrente' ? 'badge-accent' : ''}">${rot}</span>
                            </div>
                            <div class="dc-hist-nums">
                                <div><span>Saldo${fech ? ' no fechamento' : ' em aberto'}</span>
                                    <strong class="${(fech ? Number(fech.saldoMin) || 0 : c.acumuladoMin) > 0 ? 'bh-pos' : (fech ? Number(fech.saldoMin) || 0 : c.acumuladoMin) < 0 ? 'bh-neg' : ''}">${fmtHHMM(fech ? Number(fech.saldoMin) || 0 : c.acumuladoMin)}</strong></div>
                                <div><span>Meses lançados</span><strong>${c.meses.length}</strong></div>
                                <div><span>Quitações</span><strong>${c.quitacoes.length || '—'}</strong></div>
                                ${fin ? `<div><span>Pago</span><strong>${(c.quitadoValor + pagoFech) ? fmtBRL(c.quitadoValor + pagoFech) : '—'}</strong></div>` : ''}
                            </div>
                            ${fech ? `
                            <div class="dc-hist-fech">
                                ${icon('check')} <span>Fechado em <strong>${fmtDate(fech.data)}</strong> — ${escapeHtml(fech.destino)}${fin && pagoFech ? ` · ${fmtBRL(pagoFech)}` : ''}${fech.obs ? ` — ${escapeHtml(fech.obs)}` : ''}</span>
                                ${podeEditar ? `<button class="btn btn-ghost btn-sm" data-reabrir="${fech.id}">${icon('refresh')} Reabrir</button>` : ''}
                            </div>` : ''}
                        </div>`;
                    }).join('')}
                </div>` : `
                <div class="dc-vazio">${icon('info')} Nenhum ciclo registrado ainda.</div>`}
            </div>`,
        footer: `
            <button class="btn btn-secondary" data-cancel>Fechar</button>
            ${podeEditar && !sit.fechado && sit.acumuladoMin !== 0 ? (sit.podeFechar
                ? `<button class="btn btn-primary" data-acao-fechar>${icon('check')} Fechar ciclo</button>`
                : `<button class="btn btn-primary" data-acao-quitar>${icon('money')} Quitar horas</button>`) : ''}`
    });

    bindAvatarFotos(m.el);
    const funcCard = m.el.querySelector('.dh-func-card');
    if (funcCard) funcCard.onclick = () => { m.close(); abrirFichaFuncionario(f.id); };

    m.footer.querySelector('[data-cancel]').onclick = m.close;
    const bf = m.footer.querySelector('[data-acao-fechar]');
    if (bf) bf.onclick = () => { m.close(); formFechamentoBh(f, sit); };
    const bq = m.footer.querySelector('[data-acao-quitar]');
    if (bq) bq.onclick = () => { m.close(); formQuitacaoBh(f, sit); };

    // Abas da janela. As ações do rodapé são do ciclo corrente: no histórico elas não fazem
    // sentido e sumir com elas evita fechar o ciclo errado por engano.
    const acoes = [...m.footer.querySelectorAll('[data-acao-fechar],[data-acao-quitar]')];
    m.body.querySelectorAll('[data-dctab]').forEach(tab => {
        tab.onclick = () => {
            const alvo = tab.dataset.dctab;
            m.body.querySelectorAll('[data-dctab]').forEach(t => t.classList.toggle('is-active', t === tab));
            m.body.querySelectorAll('[data-dcpane]').forEach(p => p.hidden = p.dataset.dcpane !== alvo);
            acoes.forEach(b => b.hidden = alvo !== 'situacao');
        };
    });

    m.body.querySelectorAll('[data-q]').forEach(el => {
        el.onclick = () => {
            const q = bhState.quitacoes.find(x => x.id === el.dataset.q);
            if (q) { m.close(); detalheQuitacao(q); }
        };
    });

    // ---- Reabrir ciclo (retificação de erro) ----
    m.body.querySelectorAll('[data-reabrir]').forEach(btn => {
        btn.onclick = async e => {
            e.stopPropagation();
            const fech = bhState.fechamentos.find(x => x.id === btn.dataset.reabrir);
            if (!fech) return toast('Fechamento não encontrado.', 'error');

            const r = podeReabrirCicloBh(f, fech, bhState.banco);
            if (!r.pode) return toast(r.motivo, 'error');

            const pago = fech.destino === BH_DESTINO_PAGO ? Number(fech.valor) || 0 : 0;
            if (!await confirmDialog({
                title: 'Reabrir ciclo',
                message: `Reabrir o ciclo <strong>${mesLabel(fech.cicloInicio)} → ${mesLabel(fech.cicloFim)}</strong> de ${escapeHtml(f.nome)}?<br><br>
                    O fechamento de ${fmtDate(fech.data)} será <strong>excluído</strong> e o ciclo volta a correr com o saldo em aberto.
                    ${pago ? `<br><br>${fmtBRL(pago)} <strong>deixa de somar</strong> na coluna HE (banco) da folha de <strong>${mesLabel(mesDe(fech.data))}</strong>.` : ''}
                    ${(fech.anexos || []).length ? '<br><br>A documentação anexada ao fechamento será removida junto.' : ''}
                    <br><br>As quitações feitas durante o ciclo <strong>não são afetadas</strong> — aqueles meses foram pagos de verdade e seguem travados.`,
                confirmText: 'Reabrir ciclo', danger: true
            })) return;

            try {
                await excluirAnexoRemoto(fech.anexos || []);
                await DB.remove(PATHS.bancoHorasFechamentos, fech.id);
                toast(pago
                    ? `Ciclo reaberto — ${fmtBRL(pago)} removido da folha de ${mesLabel(mesDe(fech.data))}.`
                    : 'Ciclo reaberto — voltou a correr com o saldo em aberto.');
                m.close();
                bhReload();
            } catch (err) { toast(err.message || 'Erro ao reabrir o ciclo.', 'error'); }
        };
    });
}

// ============ FORM: QUITAÇÃO ============
// Paga o SALDO LÍQUIDO do ciclo em aberto — todos os meses ainda não quitados, extras e
// atrasos somados entre si. Não encerra nada: os meses saem do saldo em aberto, travam para
// edição, e o ciclo continua correndo (sem meses restantes, até o próximo lançamento).
//
// Antes disto pagava-se mês a mês, só os meses com saldo positivo isolado — o que ignorava
// atraso de outros meses do mesmo ciclo e podia pagar hora que o atraso de um mês vizinho já
// tinha coberto. O banco de horas é um saldo ÚNICO por ciclo (CLT art. 59, §2º: compensação
// entre excesso e falta), não uma fila de pagamentos mensais independentes.
function formQuitacaoBh(f, sit) {
    const fin = can('ver_financeiro');
    // Todo o ciclo em aberto quita de uma vez — não há seleção parcial: pagar só o excesso
    // sem descontar o atraso do mesmo ciclo dobraria a conta.
    const disponiveis = sit.abertos;
    const saldo = sit.acumuladoMin;

    if (!disponiveis.length) {
        return toast('Todos os meses deste ciclo já foram quitados.', 'error');
    }
    if (saldo === 0) {
        return toast('O saldo em aberto do ciclo está zerado — extra e atraso se compensam. Nada a quitar.', 'error');
    }

    // O destino depende do SINAL do saldo: positivo é dívida da empresa (só se paga), negativo
    // é dívida do funcionário (só se desconta ou se perdoa) — misturar as duas listas deixaria
    // escolher "Pago como hora extra" para um saldo que a empresa não deve, ou "Descontado"
    // para um saldo que ela já deve como extra.
    const positivo = saldo > 0;
    const destinosDisp = positivo ? [BH_DESTINO_PAGO] : ['Descontado', 'Perdoado'];

    const m = openModal({
        title: `Quitar horas — ${f.nome}`,
        size: 'md',
        body: `
            <p class="muted" style="font-size:12px;margin-bottom:14px">
                A quitação resolve o <strong>saldo líquido do ciclo em aberto</strong> (extra menos atraso de todos os
                meses ainda não quitados) <strong>sem encerrar o ciclo</strong>: os meses saem do saldo em aberto,
                ficam bloqueados para edição e o ciclo ${mesLabel(sit.inicio)} → ${mesLabel(sit.fimMes)} continua correndo.
            </p>
            <div class="bh-fech-resumo">
                <div>
                    <span class="bh-fech-lbl">Meses a quitar</span>
                    <strong>${disponiveis.length} ${disponiveis.length === 1 ? 'mês' : 'meses'}</strong>
                    <div class="prog-aq">${disponiveis.map(mm => mesLabel(mm.mes)).join(', ')}</div>
                </div>
                <div>
                    <span class="bh-fech-lbl">Saldo líquido do ciclo</span>
                    <strong class="bh-saldo-big">${bhSaldoHtml(saldo)}</strong>
                    <div class="prog-aq">${fmtHHMM(sit.extraMin)} extra · ${fmtHHMM(sit.atrasoMin)} atraso</div>
                </div>
            </div>
            <div class="field">
                <label>Destino do saldo <span class="req">*</span></label>
                <select class="select" id="qtDestino">
                    ${destinosDisp.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
                <div class="field-hint">${positivo
                    ? 'Saldo positivo: a empresa deve horas — a quitação paga como hora extra.'
                    : 'Saldo negativo: o funcionário deve horas — descontado abate a folha, perdoado só zera o banco.'}</div>
            </div>
            ${positivo ? `
            <div class="form-row">
                <div class="field">
                    <label>Data do pagamento <span class="req">*</span></label>
                    <input class="input" id="qtData" type="date" value="${hoje()}">
                    <div class="field-hint">Define a folha que recebe o valor.</div>
                </div>
                <div class="field">
                    <label>Adicional (%) <span class="req">*</span></label>
                    <input class="input" id="qtPct" type="number" min="0" max="300" step="1" value="${bhParams.adicionalPct}">
                    <div class="field-hint">Mínimo legal: 50%.</div>
                </div>
            </div>` : `
            <div class="field">
                <label>Data do pagamento <span class="req">*</span></label>
                <input class="input" id="qtData" type="date" value="${hoje()}">
                <div class="field-hint">Define a folha que recebe o valor (quando descontado).</div>
            </div>`}
            <div class="bx-calc" id="qtCalc"></div>
            <div class="field" id="qtValorWrap" ${!fin ? 'hidden' : ''}>
                <label id="qtValorLbl">Valor pago (R$) <span class="req">*</span></label>
                <input class="input" id="qtValor" type="number" min="0" step="0.01">
                <div class="field-hint" id="qtValorHint">Sugerido pelos dados do funcionário — ajuste se a folha divergir.</div>
            </div>
            <div class="bh-fech-folha" id="qtFolhaAviso"></div>
            <div class="field">
                <label>Observações</label>
                <input class="input" id="qtObs" placeholder="Ex: acordo de pagamento parcial com o gestor">
            </div>
            <div class="field">
                <label>Documentação</label>
                <div id="qtAnexos"></div>
                <div class="field-hint">Recibo ou acordo — a prova de que estas horas foram resolvidas.</div>
            </div>`,
        footer: `
            <button class="btn btn-secondary" data-cancel>Cancelar</button>
            <button class="btn btn-primary" data-save>Quitar horas</button>`
    });

    const anexoCtl = initAnexoField(m.body.querySelector('#qtAnexos'), []);
    const calcEl = m.body.querySelector('#qtCalc');
    const pctEl = m.body.querySelector('#qtPct');
    const destEl = m.body.querySelector('#qtDestino');
    const valorEl = m.body.querySelector('#qtValor');
    const valorWrap = m.body.querySelector('#qtValorWrap');
    const valorLbl = m.body.querySelector('#qtValorLbl');
    const valorHint = m.body.querySelector('#qtValorHint');
    const dataEl = m.body.querySelector('#qtData');
    const avisoEl = m.body.querySelector('#qtFolhaAviso');

    // Meses e minutos são fixos (é o ciclo inteiro em aberto) — só o destino (e o % quando
    // pago) mudam o cálculo, então o "sel" de antes vira um valor constante.
    const min = saldo;
    const mesesQuitar = disponiveis.map(mm => mm.mes).sort();

    // Sugerido e pago são campos distintos: o sugerido é a conta do sistema, o pago é o que
    // saiu do caixa. Enquanto o RH não digita, o pago acompanha a sugestão; ao digitar, o
    // campo passa a ser dele e nenhum recálculo o sobrescreve — senão trocar o % apagaria
    // silenciosamente o valor negociado.
    let valorTocado = false;
    let sugerido = 0;

    const recalc = () => {
        const destino = destEl.value;

        // Perdoado não move dinheiro: zera o saldo negativo do banco (os meses marcam
        // quitados do mesmo jeito) sem gerar valor nem tocar a folha.
        if (destino === 'Perdoado') {
            calcEl.innerHTML = `<div class="bx-calc-vazio">${icon('info')} Perdoado: o saldo negativo é zerado no banco de horas, sem valor associado.</div>`;
            sugerido = 0;
            syncAviso();
            return { c: null, min, sel: mesesQuitar };
        }

        // "Descontado" é dívida do funcionário: valor pelo preço-hora simples, SEM o
        // adicional de hora extra — cobrar adicional na cobrança de uma dívida inverteria a
        // lógica do adicional (que remunera o excesso trabalhado, não o que se deve).
        const pct = positivo ? (Number(pctEl.value) || 0) : 0;
        const minutosCalc = positivo ? min : Math.abs(min);
        const c = calculoHoraExtra(f, bhCargoDoFunc(f), folhaState.params, minutosCalc, pct);
        sugerido = c.total;
        if (!valorTocado) valorEl.value = c.total ? c.total.toFixed(2) : '';
        calcEl.innerHTML = `
            <div class="bx-calc-tit">${icon('money')} Como o valor foi sugerido</div>
            <div class="bx-calc-grid">
                <span>Salário base</span><strong>${fmtBRL(c.salario)}</strong>
                ${c.insalubridade ? `<span>+ Insalubridade</span><strong>${fmtBRL(c.insalubridade)}</strong>` : ''}
                <span>= Base de cálculo</span><strong>${fmtBRL(c.base)}</strong>
                <span>÷ Jornada mensal${f.jornadaMensal ? '' : ' <em class="bx-calc-nota">(padrão)</em>'}</span><strong>${c.jornadaMes} h</strong>
                <span>= Valor da hora</span><strong>${fmtBRL(c.valorHora)}</strong>
                ${positivo ? `<span>+ Adicional de ${fmtPct(pct, 0)}</span><strong>${fmtBRL(c.valorHoraExtra)}</strong>` : ''}
                <span>× ${fmtHHMM(minutosCalc)} ${positivo ? '(saldo líquido do ciclo)' : '(saldo devido, sem adicional)'}</span><strong>${c.horas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h</strong>
            </div>
            <div class="bx-calc-total"><span>Valor sugerido</span><strong>${fin ? fmtBRL(c.total) : '—'}</strong></div>`;
        syncAviso();
        return { c, min, sel: mesesQuitar };
    };

    // O RH tem que enxergar, antes de confirmar, em qual folha isto vira custo — e quando o
    // destino não move dinheiro, tem que ver que a folha NÃO muda.
    function syncAviso() {
        const destino = destEl.value;
        const perdoado = destino === 'Perdoado';
        valorWrap.hidden = perdoado || !fin;
        if (perdoado) { avisoEl.hidden = false; avisoEl.innerHTML = `${icon('info')} <span><strong>Perdoado</strong> zera o saldo negativo no banco de horas — os meses travam do mesmo jeito, mas nenhum valor é registrado nem soma na folha.</span>`; return; }

        const v = fin ? (Number(valorEl.value) || 0) : 0;
        const divergiu = valorTocado && sugerido && v && Math.abs(v - sugerido) >= 0.01;

        valorLbl.innerHTML = destino === BH_DESTINO_PAGO
            ? 'Valor pago (R$) <span class="req">*</span>'
            : 'Valor a descontar (R$) <span class="req">*</span>';
        valorHint.innerHTML = divergiu
            ? `${fin ? `Sugerido: <strong>${fmtBRL(sugerido)}</strong> — ` : ''}valor ajustado manualmente. O sugerido fica registrado para auditoria.`
            : 'Sugerido pelos dados do funcionário — ajuste se a folha divergir.';
        valorHint.classList.toggle('bx-hint-warn', !!divergiu);

        const mesRef = mesLabel(mesDe(dataEl.value || hoje()));
        avisoEl.hidden = false;
        avisoEl.innerHTML = destino === BH_DESTINO_PAGO
            ? `${icon('info')} <span>Ao quitar, <strong>${fin ? fmtBRL(v) : 'o valor pago'}</strong> soma automaticamente na coluna <strong>HE (banco)</strong> da folha de <strong>${mesRef}</strong> — definida pela data do pagamento.</span>`
            : `${icon('info')} <span>Ao quitar, <strong>${fin ? fmtBRL(v) : 'o valor descontado'}</strong> é descontado automaticamente na coluna <strong>Desc. Atraso</strong> da folha de <strong>${mesRef}</strong> — definida pela data do pagamento.</span>`;
    }

    if (pctEl) pctEl.oninput = recalc;
    dataEl.onchange = syncAviso;
    destEl.onchange = () => { valorTocado = false; recalc(); };
    recalc();

    m.footer.querySelector('[data-cancel]').onclick = m.close;
    const btnSave = m.footer.querySelector('[data-save]');
    btnSave.onclick = async () => {
        const data = m.body.querySelector('#qtData').value;
        const destino = destEl.value;
        const perdoado = destino === 'Perdoado';
        if (!data) return toast('Informe a data do pagamento.', 'error');
        if (data > hoje()) return toast('A data do pagamento não pode ser futura.', 'error');
        const r = recalc();

        // O que é gravado é o valor pago/descontado, não o sugerido: a quitação é o registro
        // do que efetivamente moveu. Perdoado não move nada — valor fica sempre zero. Sem
        // permissão financeira o campo nem aparece — cai na sugestão.
        const valor = perdoado ? 0 : fin ? (Number(valorEl.value) || 0) : (r.c ? r.c.total : 0);
        if (!perdoado) {
            if (fin && !(valor > 0))
                return toast(destino === BH_DESTINO_PAGO
                    ? 'Informe o valor pago — é o registro do que saiu do caixa nesta quitação.'
                    : 'Informe o valor a descontar.', 'error');
            if (!valor) return toast('O valor calculou zero — confira o salário do funcionário.', 'error');
        }

        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner"></span> Quitando...';
        try {
            const { anexos, removidos } = await anexoCtl.getAnexos();
            await DB.save(PATHS.bancoHorasQuitacoes, null, {
                funcionarioId: f.id,
                cicloInicio: sit.inicio,
                meses: r.sel,
                minutos: r.min,
                adicionalPct: positivo ? (Number(pctEl?.value) || 0) : 0,
                destino,
                valor,
                // Sugerido junto do pago: a diferença entre os dois é a decisão humana, e é
                // exatamente o que uma auditoria vai querer ver justificado.
                valorSugerido: r.c ? r.c.total : 0,
                data,
                // Congelado, como no fechamento: promoção posterior não reescreve o que foi pago.
                calculo: r.c ? { salario: r.c.salario, insalubridade: r.c.insalubridade, base: r.c.base, valorHora: r.c.valorHora, jornadaMes: r.c.jornadaMes } : null,
                obs: m.body.querySelector('#qtObs').value.trim(),
                anexos
            });
            await excluirAnexoRemoto(removidos);
            toast(destino === BH_DESTINO_PAGO
                ? `${fmtHHMM(r.min)} quitados — ${fmtBRL(valor)} na folha de ${mesLabel(mesDe(data))}.`
                : destino === 'Descontado'
                    ? `${fmtHHMM(r.min)} quitados — ${fmtBRL(valor)} descontados na folha de ${mesLabel(mesDe(data))}.`
                    : `${fmtHHMM(r.min)} quitados — perdoados, sem efeito na folha.`);
            m.close();
            bhReload();
        } catch (e) {
            toast(e.message || 'Erro ao quitar.', 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = 'Quitar horas';
        }
    };
}

// ============ JANELA: DETALHE DA QUITAÇÃO ============
function detalheQuitacao(q) {
    const fin = can('ver_financeiro');
    const podeEditar = can('editar_lancamentos');
    const f = lancState.funcionarios.find(x => x.id === q.funcionarioId);
    const c = q.calculo || {};
    const destino = destinoQuitacao(q);
    const pago = destino === BH_DESTINO_PAGO;
    // Só há divergência a mostrar quando o registro guarda uma sugestão: quitações antigas
    // não têm o campo, e inventar "sugerido = pago" fingiria uma conferência que não houve.
    const sug = q.valorSugerido == null ? null : Number(q.valorSugerido);
    const divergiu = sug != null && Math.abs(Number(q.valor) - sug) >= 0.01;

    const m = openModal({
        title: 'Quitação de horas',
        size: 'md',
        body: `
            <div class="dq-head">
                <div class="dh-func-card" ${f ? `title="Abrir ficha de ${escapeHtml(f.nome)}"` : ''}>
                    ${f ? avatarHtml(f) : `<div class="avatar">?</div>`}
                    <div class="grow">
                        <strong class="dh-nome">${escapeHtml(f?.nome || '(removido)')}</strong>
                        <div class="muted">${escapeHtml(unidadeNomeDe(f?.unidadeId))} · pago em ${fmtDate(q.data)}</div>
                    </div>
                </div>
                <div class="dq-valor">
                    <span>${fmtHHMM(q.minutos)}</span>
                    ${fin ? `<strong>${fmtBRL(q.valor)}</strong>` : ''}
                </div>
            </div>

            <div class="dc-sec">
                <div class="dc-sec-tit">${icon('money')} Destino do saldo</div>
                <div class="dq-destino">
                    <span class="badge ${pago ? 'badge-success' : 'badge-warning'}">${escapeHtml(destino)}</span>
                    <span class="muted">${pago
                        ? `Somou <strong>${fin ? fmtBRL(q.valor) : 'o valor pago'}</strong> na coluna HE (banco) da folha de <strong>${mesLabel(mesDe(q.data))}</strong>.`
                        : 'Saldo devido pelo funcionário — não soma na folha como hora extra.'}</span>
                </div>
                ${fin ? `
                <div class="dq-valores">
                    <div class="dq-vitem">
                        <span>Valor sugerido</span>
                        <strong>${sug == null ? '—' : fmtBRL(sug)}</strong>
                        <em>${sug == null ? 'Quitação anterior a este registro' : 'Calculado pelos dados do funcionário'}</em>
                    </div>
                    <div class="dq-vitem ${divergiu ? 'dq-vitem-warn' : ''}">
                        <span>Valor pago</span>
                        <strong>${fmtBRL(q.valor)}</strong>
                        <em>${divergiu
                            ? `Ajustado manualmente — ${Number(q.valor) > sug ? '+' : '−'}${fmtBRL(Math.abs(Number(q.valor) - sug))} sobre o sugerido`
                            : sug == null ? 'O que foi registrado como pago' : 'Igual ao sugerido'}</em>
                    </div>
                </div>` : ''}
            </div>

            <div class="dc-sec">
                <div class="dc-sec-tit">${icon('lock')} Meses quitados</div>
                <div class="dq-meses">
                    ${(q.meses || []).map(mk => `<span class="dq-mes">${mesLabel(mk)}</span>`).join('')}
                </div>
                <div class="field-hint" style="margin-top:8px">Estes meses estão bloqueados para edição na Grade mensal. Excluir esta quitação libera a edição de volta.</div>
            </div>

            ${fin && c.base ? `
            <div class="dc-sec">
                <div class="dc-sec-tit">${icon('money')} Memória de cálculo <span class="dc-sec-badge">congelada</span></div>
                <div class="bx-calc-grid">
                    <span>Salário base</span><strong>${fmtBRL(c.salario)}</strong>
                    ${c.insalubridade ? `<span>+ Insalubridade</span><strong>${fmtBRL(c.insalubridade)}</strong>` : ''}
                    <span>= Base de cálculo</span><strong>${fmtBRL(c.base)}</strong>
                    <span>÷ Jornada mensal</span><strong>${c.jornadaMes} h</strong>
                    <span>= Valor da hora</span><strong>${fmtBRL(c.valorHora)}</strong>
                    <span>+ Adicional de ${fmtPct(q.adicionalPct, 0)}</span><strong>${fmtBRL(c.valorHora * (1 + (q.adicionalPct || 0) / 100))}</strong>
                </div>
                <div class="field-hint" style="margin-top:8px">Valores do momento do pagamento — promoções posteriores não os alteram.</div>
            </div>` : ''}

            ${q.obs ? `<div class="dc-nota">${icon('info')} <span>${escapeHtml(q.obs)}</span></div>` : ''}
            ${(q.anexos || []).length ? `<div class="dc-sec"><div class="dc-sec-tit">${icon('paperclip')} Documentação</div>${anexoChip(q.anexos)}</div>` : ''}`,
        footer: `
            ${podeEditar ? `<button class="btn btn-ghost" data-excluir style="margin-right:auto;color:var(--danger)">${icon('trash')} Excluir quitação</button>` : ''}
            <button class="btn btn-secondary" data-cancel>Fechar</button>`
    });

    bindAnexoChips(m.body, () => q.anexos || []);
    bindAvatarFotos(m.body);
    if (f) {
        const funcCard = m.body.querySelector('.dh-func-card');
        if (funcCard) funcCard.onclick = () => { m.close(); abrirFichaFuncionario(f.id); };
    }
    m.footer.querySelector('[data-cancel]').onclick = m.close;

    const btnDel = m.footer.querySelector('[data-excluir]');
    if (btnDel) btnDel.onclick = async () => {
        if (!await confirmDialog({
            title: 'Excluir quitação',
            message: `Excluir a quitação de <strong>${fmtHHMM(q.minutos)}</strong> (${fmtBRL(q.valor)}) de ${escapeHtml(f?.nome || '')}?<br><br>
                Os meses <strong>${(q.meses || []).map(mesLabel).join(', ')}</strong> voltam para o saldo em aberto e ficam editáveis de novo.
                O valor deixa de somar na folha de ${mesLabel(mesDe(q.data))}.`,
            confirmText: 'Excluir quitação', danger: true
        })) return;
        try {
            await excluirAnexoRemoto(q.anexos || []);
            await DB.remove(PATHS.bancoHorasQuitacoes, q.id);
            toast('Quitação excluída — meses liberados para edição.');
            m.close();
            bhReload();
        } catch (e) { toast(e.message || 'Erro ao excluir.', 'error'); }
    };
}

// ============ SUB-ABA: QUITAÇÕES ============
// Todas as quitações publicadas, tabeladas. É a visão de auditoria: o que foi pago, quando,
// de quais meses e por qual valor — sem precisar abrir funcionário por funcionário.
function bhQuitacoes() {
    const box = document.getElementById('bhBody');
    const fin = can('ver_financeiro');
    const podeEditar = can('editar_lancamentos');

    const linhas = bhState.quitacoes
        .map(q => ({ q, f: lancState.funcionarios.find(x => x.id === q.funcionarioId) }))
        .filter(({ f }) => f && bhPassaFiltro(f))
        .sort((a, b) => (b.q.data || '').localeCompare(a.q.data || ''));

    const totalMin = linhas.reduce((s, { q }) => s + (Number(q.minutos) || 0), 0);
    // Pago e descontado andam em sentidos opostos: um total único somando os dois não
    // responderia a nenhuma pergunta real ("quanto saiu do caixa?" nem "quanto foi devolvido?").
    const pagas = linhas.filter(({ q }) => destinoQuitacao(q) === BH_DESTINO_PAGO);
    const descontadas = linhas.filter(({ q }) => destinoQuitacao(q) !== BH_DESTINO_PAGO);
    const totalVal = pagas.reduce((s, { q }) => s + (Number(q.valor) || 0), 0);
    const totalDesc = descontadas.reduce((s, { q }) => s + (Number(q.valor) || 0), 0);
    // Quitação sem sugestão gravada cai no próprio valor pago: somar zero faria o total
    // sugerido parecer menor que o pago só por causa de registro antigo.
    const totalSug = pagas.reduce((s, { q }) => s + Number(q.valorSugerido ?? q.valor ?? 0), 0);

    box.innerHTML = `
        <div class="bh-extra-nota">
            ${icon('info')}
            <span><strong>Quitação</strong> é o pagamento de meses do banco <strong>durante o ciclo</strong> — as horas saem do saldo em aberto e ficam bloqueadas para edição,
            mas o ciclo continua correndo com o restante. Diferente do <strong>fechamento</strong>, que encerra o ciclo (só no fim do prazo ou no desligamento).</span>
        </div>
        <div class="table-wrap">
            <div class="table-toolbar">
                <div class="search-box">${icon('search')}<input class="input" id="lancSearch" placeholder="Buscar por funcionário..."></div>
                ${bhFiltrosHtml('bqUni', 'bqCargo')}
                <div class="grow"></div>
                <span class="badge badge-accent">${fmtHHMM(totalMin)}${fin ? ` · ${fmtBRL(totalVal)} pagos` : ''}</span>
                ${fin && totalDesc ? `<span class="badge badge-warning">${fmtBRL(totalDesc)} descontados</span>` : ''}
            </div>
            <div class="table-scroll">
                <table class="table">
                    <thead><tr>
                        <th>Funcionário</th>
                        <th>Meses quitados</th>
                        <th>Ciclo</th>
                        <th>Destino</th>
                        <th>Pago em</th>
                        <th class="num">Horas</th>
                        <th class="num">Adicional</th>
                        ${fin ? '<th class="num">Sugerido</th>' : ''}
                        ${fin ? '<th class="num">Pago</th>' : ''}
                        <th style="width:40px"></th>
                    </tr></thead>
                    <tbody id="lancTbody">${linhas.map(({ q, f }) => {
                        const dest = destinoQuitacao(q);
                        const sug = q.valorSugerido == null ? null : Number(q.valorSugerido);
                        const dif = sug != null && Math.abs(Number(q.valor) - sug) >= 0.01;
                        return `
                        <tr data-id="${q.id}" data-search="${escapeHtml((f.nome + ' ' + unidadeNomeDe(f.unidadeId)).toLowerCase())}" class="row-clickable">
                            <td>
                                <div class="flex" style="gap:8px;align-items:center">
                                    ${avatarHtml(f)}
                                    <div>
                                        <strong>${escapeHtml(f.nome)}</strong>
                                        <div class="prog-aq" style="padding-left:0">${escapeHtml(unidadeNomeDe(f.unidadeId))}</div>
                                    </div>
                                </div>
                            </td>
                            <td>${(q.meses || []).map(mk => `<span class="dq-mes dq-mes-sm">${mesLabel(mk)}</span>`).join('')}</td>
                            <td class="text-2">${mesLabel(q.cicloInicio)} → ${mesLabel(mesAdd(q.cicloInicio, bhParams.cicloMeses - 1))}</td>
                            <td><span class="badge ${dest === BH_DESTINO_PAGO ? 'badge-success' : 'badge-warning'}">${escapeHtml(dest)}</span></td>
                            <td class="text-2">${fmtDate(q.data)}</td>
                            <td class="num"><strong class="bh-pos">${fmtHHMM(q.minutos)}</strong></td>
                            <td class="num text-2">${fmtPct(q.adicionalPct, 0)}</td>
                            ${fin ? `<td class="num text-2">${sug == null ? '—' : fmtBRL(sug)}</td>` : ''}
                            ${fin ? `<td class="num"><strong>${fmtBRL(q.valor)}</strong>${dif
                                ? `<span class="dq-dif" title="Ajustado manualmente: sugerido ${fmtBRL(sug)}">${Number(q.valor) > sug ? '+' : '−'}${fmtBRL(Math.abs(Number(q.valor) - sug))}</span>`
                                : ''}</td>` : ''}
                            <td>${podeEditar ? `<button class="btn-icon btn-icon-sm" data-menu title="Ações">${icon('dots')}</button>` : ''}</td>
                        </tr>`; }).join('')}</tbody>
                    ${linhas.length ? `<tfoot>
                        <tr>
                            <td colspan="5"><strong>Total pago</strong>${totalDesc ? ` <span class="text-2">(${pagas.length} de ${linhas.length})</span>` : ''}</td>
                            <td class="num"><strong>${fmtHHMM(totalMin)}</strong></td>
                            <td></td>
                            ${fin ? `<td class="num text-2">${fmtBRL(totalSug)}</td>` : ''}
                            ${fin ? `<td class="num"><strong>${fmtBRL(totalVal)}</strong></td>` : ''}
                            <td></td>
                        </tr>
                        ${fin && totalDesc ? `<tr class="qt-tot-desc">
                            <td colspan="5"><span class="text-2">Descontado (não sai do caixa)</span></td>
                            <td></td><td></td><td></td>
                            <td class="num"><strong>${fmtBRL(totalDesc)}</strong></td>
                            <td></td>
                        </tr>` : ''}
                    </tfoot>` : ''}
                </table>
            </div>
        </div>`;

    if (!linhas.length) {
        document.getElementById('lancTbody').innerHTML =
            `<tr><td colspan="10"><div class="table-empty">${icon('money')}<span>Nenhuma quitação publicada. Quite horas pela Programação ou pelo card do ciclo.</span></div></td></tr>`;
    }
    document.getElementById('lancSearch').addEventListener('input', () => lancAplicaFiltros());
    bindAvatarFotos(box);
    bhBindFiltros('bqUni', 'bqCargo', bhQuitacoes);

    box.querySelectorAll('#lancTbody tr[data-id]').forEach(tr => {
        const item = linhas.find(x => x.q.id === tr.dataset.id);
        tr.onclick = () => detalheQuitacao(item.q);
        const btn = tr.querySelector('[data-menu]');
        if (btn) btn.onclick = e => {
            e.stopPropagation();
            openPopover(btn, [
                { label: 'Ver detalhes', icon: 'eye', onClick: () => detalheQuitacao(item.q) },
                'sep',
                { label: 'Excluir quitação', icon: 'trash', danger: true, onClick: async () => {
                    if (!await confirmDialog({
                        title: 'Excluir quitação',
                        message: `Excluir a quitação de <strong>${fmtHHMM(item.q.minutos)}</strong> de ${escapeHtml(item.f.nome)}? Os meses voltam ao saldo em aberto e ficam editáveis.`,
                        confirmText: 'Excluir', danger: true
                    })) return;
                    await excluirAnexoRemoto(item.q.anexos || []);
                    await DB.remove(PATHS.bancoHorasQuitacoes, item.q.id);
                    toast('Quitação excluída — meses liberados.');
                    bhReload();
                } }
            ]);
        };
    });
}

// ============ SUB-ABA: EXTRA BANCO ============
//
// Hora extra paga DIRETO, sem passar pelo ciclo. O caso clássico é o feriado a 100%: a
// empresa decide pagar em vez de creditar no banco, e essa decisão é por evento — não dá
// para configurar globalmente, porque a mesma empresa paga 50% na terça e 100% no feriado.
//
// Por que fica aqui e não em Lançamentos → Folha: quem lança hora extra pensa em HORAS
// ("o Felipe fez 4h no feriado"), não em reais. A conta para reais é derivada, e mostrar a
// memória de cálculo é o que evita o RH digitar um valor redondo e errado direto na folha.
//
// NÃO toca o banco de horas: não entra em nenhum ciclo, não muda saldo, não adia
// fechamento. Só soma na folha do mês de referência (ver heBancoDoMes).
function bhExtra() {
    const box = document.getElementById('bhBody');
    const podeEditar = can('editar_lancamentos');
    const fin = can('ver_financeiro');
    const { ano, mes } = bhState;
    const key = mesKey(ano, mes);

    const doMes = bhState.extras
        .filter(x => mesDe(x.mesRef || x.data) === key)
        .map(x => ({ x, f: lancState.funcionarios.find(y => y.id === x.funcionarioId) }))
        .filter(({ f }) => f && bhPassaFiltro(f))
        .sort((a, b) => (a.f.nome || '').localeCompare(b.f.nome || ''));

    const totalMes = doMes.reduce((s, { x }) => s + (Number(x.valor) || 0), 0);
    const totalMin = doMes.reduce((s, { x }) => s + (Number(x.minutos) || 0), 0);

    const nav = `
        <div class="month-nav">
            <button id="bxPrev" title="Mês anterior">‹</button>
            <span class="month-label">${MESES_FULL[mes]} ${ano}</span>
            <button id="bxNext" title="Próximo mês">›</button>
        </div>`;

    box.innerHTML = `
        <div class="flex-between" style="margin-bottom:12px;flex-wrap:wrap;gap:10px">
            ${nav}
            <div class="flex" style="flex-wrap:wrap;gap:8px">
                ${bhFiltrosHtml('bxUni', 'bxCargo')}
                <span class="badge badge-accent">${fmtHHMM(totalMin)}${fin ? ` · ${fmtBRL(totalMes)}` : ''}</span>
                ${podeEditar ? `<button class="btn btn-primary btn-sm" id="bxNovo">${icon('plus')} Lançar hora extra</button>` : ''}
            </div>
        </div>
        <div class="bh-extra-nota">
            ${icon('info')}
            <span>Hora extra <strong>paga diretamente</strong>, fora do banco de horas — feriado, domingo, plantão.
            Não entra em nenhum ciclo e não altera saldo: soma na coluna <strong>HE (banco)</strong> da folha de ${MESES_FULL[mes]}.</span>
        </div>
        <div class="table-wrap">
            <div class="table-scroll">
                <table class="table">
                    <thead><tr>
                        <th>Funcionário</th>
                        <th>Motivo</th>
                        <th>Data</th>
                        <th class="num">Horas</th>
                        <th class="num" title="Percentual sobre o valor-hora, editável em cada lançamento">Adicional</th>
                        ${fin ? '<th class="num">Valor</th>' : ''}
                        <th style="width:44px"></th>
                    </tr></thead>
                    <tbody id="bxTbody">${doMes.map(({ x, f }) => `
                        <tr data-id="${x.id}">
                            <td>
                                <div class="flex" style="gap:8px;align-items:center">
                                    ${avatarHtml(f)}
                                    <div>
                                        <strong>${escapeHtml(f.nome)}</strong>
                                        <div class="prog-aq" style="padding-left:0">${escapeHtml(unidadeNomeDe(f.unidadeId))}</div>
                                    </div>
                                </div>
                            </td>
                            <td><span class="badge ${x.adicionalPct >= 100 ? 'badge-warning' : 'badge-neutral'}">${escapeHtml(x.motivo || '—')}</span></td>
                            <td class="text-2">${fmtDate(x.data)}</td>
                            <td class="num"><strong>${fmtHHMM(x.minutos)}</strong></td>
                            <td class="num text-2">${fmtPct(x.adicionalPct, 0)}</td>
                            ${fin ? `<td class="num"><strong>${fmtBRL(x.valor)}</strong></td>` : ''}
                            <td>${podeEditar ? `<button class="btn-icon btn-icon-sm" data-menu title="Ações">${icon('dots')}</button>` : ''}</td>
                        </tr>`).join('')}</tbody>
                    ${doMes.length ? `<tfoot><tr>
                        <td colspan="3"><strong>Total de ${MESES_FULL[mes]}</strong></td>
                        <td class="num"><strong>${fmtHHMM(totalMin)}</strong></td>
                        <td></td>
                        ${fin ? `<td class="num"><strong>${fmtBRL(totalMes)}</strong></td>` : ''}
                        <td></td>
                    </tr></tfoot>` : ''}
                </table>
            </div>
        </div>`;

    if (!doMes.length) {
        document.getElementById('bxTbody').innerHTML =
            `<tr><td colspan="10"><div class="table-empty">${icon('money')}<span>Nenhuma hora extra avulsa em ${MESES_FULL[mes]}/${ano}.</span></div></td></tr>`;
    }

    box.querySelector('#bxPrev').onclick = () => {
        bhState.mes--;
        if (bhState.mes < 0) { bhState.mes = 11; bhState.ano--; }
        bhExtra();
    };
    box.querySelector('#bxNext').onclick = () => {
        bhState.mes++;
        if (bhState.mes > 11) { bhState.mes = 0; bhState.ano++; }
        bhExtra();
    };
    bhBindFiltros('bxUni', 'bxCargo', bhExtra);
    bindAvatarFotos(box);

    const btnNovo = box.querySelector('#bxNovo');
    if (btnNovo) btnNovo.onclick = () => formExtraBanco(null);

    box.querySelectorAll('#bxTbody tr[data-id]').forEach(tr => {
        const item = doMes.find(d => d.x.id === tr.dataset.id);
        const btn = tr.querySelector('[data-menu]');
        if (btn) btn.onclick = e => {
            e.stopPropagation();
            openPopover(btn, [
                { label: 'Editar', icon: 'edit', onClick: () => formExtraBanco(item.x) },
                'sep',
                { label: 'Excluir', icon: 'trash', danger: true, onClick: async () => {
                    if (!await confirmDialog({
                        title: 'Excluir lançamento',
                        message: `Excluir a hora extra de ${escapeHtml(item.f.nome)} (${fmtHHMM(item.x.minutos)} — ${fmtBRL(item.x.valor)})? O valor deixa de somar na folha de ${MESES_FULL[mes]}.`,
                        confirmText: 'Excluir', danger: true
                    })) return;
                    await DB.remove(PATHS.extraBanco, item.x.id);
                    toast('Lançamento excluído.');
                    bhReload();
                } }
            ]);
        };
    });
}

// ============ FORM: EXTRA BANCO ============
function formExtraBanco(x) {
    const isEdit = !!x;
    const fin = can('ver_financeiro');
    const ativos = lancAtivos();
    const { ano, mes } = bhState;

    const m = openModal({
        title: isEdit ? 'Editar hora extra' : 'Lançar hora extra (fora do banco)',
        size: 'md',
        body: `
            <div class="form-row">
                <div class="field">
                    <label>Funcionário <span class="req">*</span></label>
                    <select class="select" id="bxFunc" ${isEdit ? 'disabled' : ''}>
                        <option value="">Selecione...</option>
                        ${ativos.map(f => `<option value="${f.id}" ${x?.funcionarioId === f.id ? 'selected' : ''}>${escapeHtml(f.nome)}</option>`).join('')}
                    </select>
                </div>
                <div class="field">
                    <label>Data da hora extra <span class="req">*</span></label>
                    <input class="input" id="bxData" type="date" value="${x?.data || _dataDoMes(ano, mes)}">
                    <div class="field-hint">Define o mês de folha em que o valor será somado.</div>
                </div>
            </div>
            <div class="form-row">
                <div class="field">
                    <label>Motivo <span class="req">*</span></label>
                    <select class="select" id="bxMotivo">
                        ${EXTRA_MOTIVOS.map(mo => `<option value="${mo.nome}" data-pct="${mo.pct}" ${x?.motivo === mo.nome ? 'selected' : ''}>${mo.nome} (${mo.pct}%)</option>`).join('')}
                    </select>
                    <div class="field-hint">Sugere o adicional; o percentual continua editável ao lado.</div>
                </div>
                <div class="field">
                    <label>Horas trabalhadas <span class="req">*</span></label>
                    <input class="input" id="bxHoras" placeholder="04:00" value="${x ? fmtHHMM(x.minutos) : ''}">
                    <div class="field-hint">Formato HH:MM (aceita 4h30, 4,5h).</div>
                </div>
                <div class="field">
                    <label>Adicional (%) <span class="req">*</span></label>
                    <input class="input" id="bxPct" type="number" min="0" max="300" step="1" value="${x?.adicionalPct ?? 100}">
                    <div class="field-hint">Feriado/domingo: 100%. Dia comum: 50% (mínimo legal).</div>
                </div>
            </div>

            <div class="bx-calc" id="bxCalc"></div>

            <div class="field">
                <label>Observações</label>
                <input class="input" id="bxObs" value="${escapeHtml(x?.obs || '')}" placeholder="Ex: cobertura do feriado de Corpus Christi">
            </div>`,
        footer: `
            <button class="btn btn-secondary" data-cancel>Cancelar</button>
            <button class="btn btn-primary" data-save>${isEdit ? 'Salvar' : 'Lançar'}</button>`
    });

    const el = id => m.body.querySelector(id);
    const funcEl = el('#bxFunc'), dataEl = el('#bxData'), motivoEl = el('#bxMotivo');
    const horasEl = el('#bxHoras'), pctEl = el('#bxPct'), calcEl = el('#bxCalc');

    // Memória de cálculo ao vivo. O valor NÃO é um campo digitável: ele é a conta. Deixar o
    // RH digitar o total abriria espaço para número redondo sem base — e é justamente o
    // valor que uma reclamatória questiona. Mostrar a conta é o que torna a sugestão
    // auditável em vez de mágica.
    const recalc = () => {
        const f = lancState.funcionarios.find(y => y.id === funcEl.value);
        const min = parseHHMM(horasEl.value) ?? 0;
        const pct = Number(pctEl.value) || 0;
        if (!f || min <= 0) {
            calcEl.innerHTML = `<div class="bx-calc-vazio">${icon('info')} Selecione o funcionário e informe as horas para ver o cálculo.</div>`;
            return null;
        }
        const c = calculoHoraExtra(f, bhCargoDoFunc(f), folhaState.params, min, pct);
        calcEl.innerHTML = `
            <div class="bx-calc-tit">${icon('money')} Memória de cálculo</div>
            <div class="bx-calc-grid">
                <span>Salário base</span><strong>${fmtBRL(c.salario)}</strong>
                ${c.insalubridade ? `<span>+ Insalubridade</span><strong>${fmtBRL(c.insalubridade)}</strong>` : ''}
                <span>= Base de cálculo</span><strong>${fmtBRL(c.base)}</strong>
                <span>÷ Jornada mensal${f.jornadaMensal ? '' : ' <em class="bx-calc-nota">(padrão)</em>'}</span><strong>${c.jornadaMes} h</strong>
                <span>= Valor da hora</span><strong>${fmtBRL(c.valorHora)}</strong>
                <span>+ Adicional de ${fmtPct(pct, 0)}</span><strong>${fmtBRL(c.valorHoraExtra)}</strong>
                <span>× ${fmtHHMM(min)}</span><strong>${c.horas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h</strong>
            </div>
            <div class="bx-calc-total">
                <span>Valor a pagar</span>
                <strong>${fin ? fmtBRL(c.total) : '—'}</strong>
            </div>`;
        return c;
    };

    // Motivo sugere o adicional, mas não o impõe: quem decide é o acordo/convenção da
    // empresa, e sobrescrever o que o RH digitou seria arrogante.
    motivoEl.onchange = () => {
        const pctSugerido = motivoEl.selectedOptions[0]?.dataset.pct;
        if (pctSugerido) pctEl.value = pctSugerido;
        recalc();
    };
    [funcEl, horasEl, pctEl].forEach(e => { e.oninput = recalc; e.onchange = recalc; });
    recalc();

    m.footer.querySelector('[data-cancel]').onclick = m.close;
    const btnSave = m.footer.querySelector('[data-save]');
    btnSave.onclick = async () => {
        const fid = funcEl.value;
        const data = dataEl.value;
        const min = parseHHMM(horasEl.value);
        const pct = Number(pctEl.value);

        if (!fid) return toast('Selecione o funcionário.', 'error');
        if (!data) return toast('Informe a data da hora extra.', 'error');
        if (data > hoje()) return toast('A data não pode ser futura — hora extra se lança depois de trabalhada.', 'error');
        if (min == null || min <= 0) return toast('Informe as horas no formato HH:MM (ex: 4:00).', 'error');
        if (!(pct >= 0 && pct <= 300)) return toast('O adicional deve ficar entre 0 e 300%.', 'error');

        const c = recalc();
        if (!c) return toast('Não foi possível calcular o valor. Verifique o salário do funcionário.', 'error');
        if (!c.total) return toast('O valor calculou zero — confira se o funcionário tem salário cadastrado no cargo ou na ficha.', 'error');

        const mesRef = mesDe(data);
        // Retroativo é permitido (feriado esquecido acontece), mas nunca em silêncio: a
        // folha daquele mês pode já ter sido apurada e o custo vai mudar.
        if (mesRef < mesHoje()) {
            const folhaMes = await DB.getObj(`${PATHS.folha}/${mesRef}`);
            if (folhaMes && !await confirmDialog({
                title: 'Lançamento em mês anterior',
                message: `A folha de <strong>${mesLabel(mesRef)}</strong> já está lançada. Este pagamento de <strong>${fmtBRL(c.total)}</strong> vai somar na coluna "HE (banco)" daquele mês, alterando o custo já apurado. Continuar?`,
                confirmText: 'Lançar mesmo assim'
            })) return;
        }

        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner"></span> Salvando...';
        try {
            await DB.save(PATHS.extraBanco, x?.id || null, {
                funcionarioId: fid,
                data,
                mesRef,                          // mês da folha que recebe o valor
                motivo: motivoEl.value,
                minutos: min,
                adicionalPct: pct,
                valor: c.total,
                // Memória de cálculo congelada: o salário muda com promoção, e um valor
                // recalculado depois divergiria do que foi efetivamente pago.
                calculo: { salario: c.salario, insalubridade: c.insalubridade, base: c.base, valorHora: c.valorHora, jornadaMes: c.jornadaMes },
                obs: el('#bxObs').value.trim()
            });
            toast(isEdit ? 'Hora extra atualizada.' : `Hora extra lançada — ${fmtBRL(c.total)} na folha de ${mesLabel(mesRef)}.`);
            m.close();
            bhReload();
        } catch (e) {
            toast(e.message || 'Erro ao salvar.', 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = isEdit ? 'Salvar' : 'Lançar';
        }
    };
}

// Data padrão do form: dia de hoje se o mês navegado for o corrente; senão, o dia 1 daquele
// mês — abrir o form em outubro e sugerir uma data de julho seria só confusão.
const _dataDoMes = (ano, mes) => {
    const k = mesKey(ano, mes);
    return k === mesHoje() ? hoje() : `${k}-01`;
};

// ============ FORM: FECHAMENTO DE CICLO ============
// O ciclo não zera sozinho: o saldo restante é uma decisão com dinheiro atrás (pagar,
// compensar, perdoar, descontar). O sistema apura e cobra; quem escritura é o RH.
function formFechamentoBh(f, sit) {
    // Guarda da regra, não só da UI: fechar um ciclo em curso apuraria um saldo que ainda
    // vai mudar. Quem quer pagar antes do prazo usa a quitação — e é para lá que mandamos.
    if (!sit.podeFechar) {
        toast(sit.motivoNaoFechar || 'Este ciclo ainda não pode ser fechado.', 'error', 6000);
        return;
    }

    const saldo = sit.acumuladoMin;
    const positivo = saldo > 0;
    const fin = can('ver_financeiro');
    // Sugestão pelos dados reais do funcionário (salário + insalubridade ÷ jornada ×
    // adicional), não pela estimativa agregada de passivoBh: aqui o número vira pagamento.
    const calc = positivo
        ? calculoHoraExtra(f, bhCargoDoFunc(f), folhaState.params, saldo, bhParams.adicionalPct)
        : null;
    const sugerido = calc?.total || 0;
    let anexoCtl = null;

    const m = openModal({
        title: `Fechar ciclo — ${f.nome}`,
        size: 'md',
        body: `
            <div class="bh-fech-resumo">
                <div>
                    <span class="bh-fech-lbl">Ciclo</span>
                    <strong>${mesLabel(sit.inicio)} → ${mesLabel(sit.fimMes)}</strong>
                    <div class="prog-aq">fecha em ${fmtDate(sit.fim)}</div>
                </div>
                <div>
                    <span class="bh-fech-lbl">Saldo em aberto</span>
                    <strong class="bh-saldo-big">${bhSaldoHtml(saldo)}</strong>
                    <div class="prog-aq">${fmtHHMM(sit.extraMin)} extra · ${fmtHHMM(sit.atrasoMin)} atraso</div>
                    ${sit.quitacoes.length ? `<div class="prog-aq">${icon('check')} ${fmtHHMM(sit.quitadoMin)} já quitados antes${fin && sit.quitadoValor ? ` (${fmtBRL(sit.quitadoValor)})` : ''}</div>` : ''}
                </div>
            </div>
            <div class="bh-fech-motivo">
                ${icon('info')} <span>${sit.desligado
                    ? `Fechamento por <strong>desligamento</strong> — a rescisão exige a liquidação do saldo (art. 59, §3º).`
                    : `O ciclo atingiu o fim do prazo em <strong>${fmtDate(sit.fim)}</strong>. Fechar encerra este ciclo e o próximo começa em ${mesLabel(mesAdd(sit.fimMes, 1))}.`}</span>
            </div>
            <p class="muted" style="font-size:12px;margin:12px 0 16px">
                ${positivo
                    ? 'Saldo positivo não compensado dentro do ciclo é devido como hora extra, com adicional (CLT art. 59, §2º).'
                    : saldo < 0
                        ? 'Saldo negativo: o funcionário deve horas à empresa. O desconto em folha é decisão jurídica — registre aqui apenas o que foi acordado.'
                        : 'Saldo zerado: nada a pagar ou compensar.'}
            </p>
            <div class="field">
                <label>Destino do saldo <span class="req">*</span></label>
                <select class="select" id="bfDestino">
                    ${BH_DESTINOS.map(d => `<option value="${d}" ${(positivo && d === 'Pago como hora extra') || (!positivo && d === 'Compensado') ? 'selected' : ''}>${d}</option>`).join('')}
                </select>
                <div class="field-hint">Como o saldo restante foi resolvido. Fica registrado no histórico do ciclo.</div>
            </div>
            <div class="form-row">
                <div class="field">
                    <label>Data do fechamento <span class="req">*</span></label>
                    <input class="input" id="bfData" type="date" value="${hoje()}">
                </div>
                <div class="field" id="bfValorWrap" ${!fin ? 'hidden' : ''}>
                    <label>Valor pago (R$)</label>
                    <input class="input" id="bfValor" type="number" min="0" step="0.01" value="${sugerido ? sugerido.toFixed(2) : ''}">
                    <div class="field-hint">Sugerido pelos dados do funcionário — ajuste se a folha divergir.</div>
                </div>
            </div>
            <div class="bx-calc" id="bfCalc"></div>
            <div class="bh-fech-folha" id="bfFolhaAviso"></div>
            <div class="field">
                <label>Observações</label>
                <textarea class="input" id="bfObs" rows="2" placeholder="Ex: acordo assinado em reunião com o gestor"></textarea>
            </div>
            <div class="field">
                <label>Documentação do fechamento</label>
                <div id="bfAnexos"></div>
                <div class="field-hint">Acordo, recibo de pagamento ou espelho de ponto — a prova de que o ciclo foi liquidado.</div>
            </div>`,
        footer: `
            <button class="btn btn-secondary" data-cancel>Cancelar</button>
            <button class="btn btn-primary" data-save>Fechar ciclo</button>`
    });

    anexoCtl = initAnexoField(m.body.querySelector('#bfAnexos'), []);

    // "Pago" é o único destino que move dinheiro — o campo de valor só faz sentido nele.
    const destEl = m.body.querySelector('#bfDestino');
    const valorWrap = m.body.querySelector('#bfValorWrap');
    const calcEl = m.body.querySelector('#bfCalc');
    const avisoEl = m.body.querySelector('#bfFolhaAviso');
    const dataEl = m.body.querySelector('#bfData');

    const syncValor = () => {
        const pagoHE = destEl.value === 'Pago como hora extra';
        const pago = pagoHE || destEl.value === 'Descontado';
        if (fin) valorWrap.hidden = !pago;

        // Memória de cálculo só faz sentido no pagamento de HE: é a conta que justifica o
        // valor sugerido. Nos demais destinos o saldo se resolve em horas, não em reais.
        calcEl.hidden = !(pagoHE && calc && fin);
        if (!calcEl.hidden) {
            calcEl.innerHTML = `
                <div class="bx-calc-tit">${icon('money')} Como o valor foi sugerido</div>
                <div class="bx-calc-grid">
                    <span>Salário base</span><strong>${fmtBRL(calc.salario)}</strong>
                    ${calc.insalubridade ? `<span>+ Insalubridade</span><strong>${fmtBRL(calc.insalubridade)}</strong>` : ''}
                    <span>= Base de cálculo</span><strong>${fmtBRL(calc.base)}</strong>
                    <span>÷ Jornada mensal${f.jornadaMensal ? '' : ' <em class="bx-calc-nota">(padrão)</em>'}</span><strong>${calc.jornadaMes} h</strong>
                    <span>= Valor da hora</span><strong>${fmtBRL(calc.valorHora)}</strong>
                    <span>+ Adicional de ${fmtPct(bhParams.adicionalPct, 0)}</span><strong>${fmtBRL(calc.valorHoraExtra)}</strong>
                    <span>× ${fmtHHMM(saldo)} de saldo</span><strong>${calc.horas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h</strong>
                </div>
                <div class="bx-calc-total"><span>Valor sugerido</span><strong>${fmtBRL(calc.total)}</strong></div>`;
        }

        // O RH precisa saber, ANTES de confirmar, que este fechamento vira custo em uma
        // folha específica. Fechar um ciclo é um ato de RH; alterar a folha de um mês é um
        // ato financeiro — quem clica tem que enxergar os dois.
        const mesRef = mesDe(dataEl.value || hoje());
        avisoEl.hidden = !pagoHE;
        if (pagoHE) {
            const v = Number(m.body.querySelector('#bfValor').value) || 0;
            avisoEl.innerHTML = `${icon('info')} <span>Ao fechar, <strong>${fin ? fmtBRL(v) : 'o valor pago'}</strong> soma automaticamente na coluna <strong>HE (banco)</strong> da folha de <strong>${mesLabel(mesRef)}</strong> — definida pela data do fechamento.</span>`;
        }
    };
    destEl.onchange = syncValor;
    dataEl.onchange = syncValor;
    m.body.querySelector('#bfValor').oninput = syncValor;
    syncValor();

    m.footer.querySelector('[data-cancel]').onclick = m.close;
    const btnSave = m.footer.querySelector('[data-save]');
    btnSave.onclick = async () => {
        const data = m.body.querySelector('#bfData').value;
        const destino = destEl.value;
        if (!data) return toast('Informe a data do fechamento.', 'error');
        if (data > hoje()) return toast('A data do fechamento não pode ser futura.', 'error');

        const valorEl = m.body.querySelector('#bfValor');
        const valor = fin ? (Number(valorEl.value) || 0) : 0;
        if (destino === 'Pago como hora extra' && fin && !(valor > 0))
            return toast('Informe o valor pago — é o registro do que saiu do caixa neste fechamento.', 'error');

        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner"></span> Fechando...';
        try {
            const { anexos, removidos } = await anexoCtl.getAnexos();
            await DB.save(PATHS.bancoHorasFechamentos, null, {
                funcionarioId: f.id,
                cicloInicio: sit.inicio,
                cicloFim: sit.fimMes,
                saldoMin: saldo,
                destino, valor,
                data,
                // Memória congelada: promoção depois do fechamento mudaria o salário e um
                // valor recalculado divergiria do que foi pago. O que aconteceu, aconteceu.
                calculo: calc ? { salario: calc.salario, insalubridade: calc.insalubridade, base: calc.base, valorHora: calc.valorHora, jornadaMes: calc.jornadaMes, adicionalPct: bhParams.adicionalPct } : null,
                obs: m.body.querySelector('#bfObs').value.trim(),
                anexos
            });
            await excluirAnexoRemoto(removidos);
            // O toast diz onde o dinheiro caiu: fechar ciclo e mexer na folha são dois
            // efeitos, e o segundo é o que o RH vai procurar depois.
            toast(destino === 'Pago como hora extra' && valor > 0
                ? `Ciclo de ${f.nome.split(' ')[0]} fechado — ${fmtBRL(valor)} somado na folha de ${mesLabel(mesDe(data))}.`
                : `Ciclo de ${f.nome.split(' ')[0]} fechado — ${destino.toLowerCase()}.`);
            m.close();
            bhReload();
        } catch (e) {
            toast(e.message || 'Erro ao fechar o ciclo.', 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = 'Fechar ciclo';
        }
    };
}
