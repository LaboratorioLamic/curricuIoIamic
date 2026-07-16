// ===== Funcionários: fichas, benefícios e histórico =====

const ESCOLARIDADES = ['Fundamental incompleto', 'Fundamental completo', 'Médio incompleto', 'Médio completo', 'Técnico', 'Superior incompleto', 'Superior completo', 'Pós-graduação', 'Mestrado', 'Doutorado'];
const SEXOS = ['Masculino', 'Feminino', 'Outro'];
const VESTIMENTAS = ['PP', 'P', 'M', 'G', 'GG'];

const funcState = {
    funcionarios: [], cargos: [], unidades: [], beneficios: [], treinamentos: [], ausencias: [],
    filtro: { q: '', unidade: '', cargo: '', status: 'ativos' }
};

// Tipos de documento = as sub-abas de Documentos. Cada aba publica no seu próprio tipo,
// então o tipo não é mais um campo do formulário — é o contexto de onde você clicou.
//
// ASO NÃO está aqui: deixou de ser "um documento com tipo ASO" solto na ficha e passou a
// ser a aba própria, lida de rh_asos (o mesmo registro da aba ASO em Lançamentos). Ter os
// dois seria duas verdades sobre o mesmo exame — a ficha diria uma coisa, a fila de
// vencimento diria outra.
const TIPOS_DOCUMENTO = ['Certificado de treinamento', 'Contrato de trabalho', 'Documento pessoal', 'Documento escolar', 'Outro'];

// Rótulo curto de cada aba. O drawer é estreito e as 6 abas dividem uma linha só: o nome
// por extenso empurrava "Outro" para fora da borda. O tipo completo continua no título do
// formulário e no dado gravado — encurta-se o rótulo, não o registro.
const FD_DOC_LABEL = {
    'Certificado de treinamento': 'Certificado',
    'Contrato de trabalho': 'Contrato',
    'Documento pessoal': 'Doc. pessoal',
    'Documento escolar': 'Doc. escolar',
    'Outro': 'Outro'
};

// Abas da seção Documentos: os tipos acima + ASO (que vem de outra fonte)
const FD_DOC_ABAS = [
    { id: 'aso', label: 'ASO', aso: true },
    ...TIPOS_DOCUMENTO.map(t => ({ id: t, label: FD_DOC_LABEL[t] || t }))
];
let fdDocAba = 'aso';

// Tipo gravado antes de o ASO virar aba própria (lia-se de f.documentos, não de rh_asos).
// Sem isto o registro existiria no banco sem nenhuma aba que o exibisse — sumiria da tela
// sem ninguém apagar nada. Cai em "Outro", que é onde o usuário vai procurar o que sobrou.
const FD_DOC_TIPO_ASO_LEGADO = 'ASO (exame ocupacional)';
const fdDocTipoDe = doc => {
    const t = doc?.tipo;
    if (!t || t === FD_DOC_TIPO_ASO_LEGADO) return 'Outro';
    return TIPOS_DOCUMENTO.includes(t) ? t : 'Outro';
};

const cargoDe = f => funcState.cargos.find(c => c.id === f.cargoId);
// Salário efetivo: individual (definido na ficha ou por promoção/ajuste) ou base do cargo
const salarioDe = (f, cargos) => f.salario ?? (cargos || funcState.cargos).find(c => c.id === f.cargoId)?.salario ?? 0;
const unidadeDe = f => funcState.unidades.find(u => u.id === f.unidadeId);
const funcAtivo = f => !f.demissao;

registerPage({
    id: 'funcionarios',
    title: 'Funcionários',
    icon: 'users',
    order: 2,
    perm: 'ver_funcionarios',
    async render(el) {
        el.innerHTML = '<div class="loading-center"><div class="spinner-dark"></div></div>';
        const [funcionarios, cargos, unidades, beneficios, treinamentos, ausencias] = await Promise.all([
            DB.getAll(PATHS.funcionarios), DB.getAll(PATHS.cargos),
            DB.getAll(PATHS.unidades), DB.getAll(PATHS.beneficios), DB.getAll(PATHS.treinamentos),
            DB.getAll(PATHS.ausencias)
        ]);
        Object.assign(funcState, { funcionarios, cargos, unidades, beneficios, treinamentos, ausencias });

        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Funcionários</h2>
                    <div class="page-sub" id="funcCount"></div>
                </div>
                <div class="actions">
                    ${can('editar_funcionarios') ? `<button class="btn btn-primary" id="funcNew">${icon('plus')} Novo funcionário</button>` : ''}
                </div>
            </div>
            <div class="filters-bar">
                <div class="search-box">${icon('search')}<input class="input" id="funcSearch" placeholder="Buscar por nome..." value="${escapeHtml(funcState.filtro.q)}"></div>
                <button class="filter-btn" id="funcFUnidade" data-icon="building"></button>
                <button class="filter-btn" id="funcFCargo" data-icon="briefcase"></button>
                <button class="filter-btn" id="funcFStatus" data-icon="user"></button>
            </div>
            <div id="funcGrid"></div>`;

        const btnNew = el.querySelector('#funcNew');
        if (btnNew) btnNew.onclick = () => formFuncionario(null);
        el.querySelector('#funcSearch').addEventListener('input', e => { funcState.filtro.q = e.target.value; renderFuncGrid(); });

        // Filtros em popover (no lugar dos selects nativos)
        const STATUS = [
            { value: 'ativos', label: 'Ativos' },
            { value: 'ferias', label: 'De férias' },
            { value: 'ferias_vencendo', label: 'Férias vencendo' },
            { value: 'ferias_vencidas', label: 'Férias vencidas' },
            { value: 'desligados', label: 'Desligados' },
            { value: '', label: 'Todos' }
        ];
        const bindFilter = (id, icone, campo, options, allLabel, isDefault) => {
            const btn = el.querySelector(`#${id}`);
            const sync = () => {
                const sel = options.find(o => o.value === funcState.filtro[campo]);
                const ativo = !isDefault(funcState.filtro[campo]);
                btn.innerHTML = `${icon(icone)}<span>${escapeHtml(ativo && sel ? sel.label : allLabel)}</span>${icon('chevronDown')}`;
                btn.classList.toggle('active', ativo);
            };
            btn.onclick = () => openFilterPopover(btn, {
                options, value: funcState.filtro[campo], searchable: options.length > 6,
                onPick: v => { funcState.filtro[campo] = v; sync(); renderFuncGrid(); }
            });
            sync();
        };
        bindFilter('funcFUnidade', 'building', 'unidade',
            [{ value: '', label: 'Todas as unidades' }, ...unidades.map(u => ({ value: u.id, label: u.nome }))],
            'Todas as unidades', v => !v);
        bindFilter('funcFCargo', 'briefcase', 'cargo',
            [{ value: '', label: 'Todos os cargos' }, ...cargos.map(c => ({ value: c.id, label: c.nome }))],
            'Todos os cargos', v => !v);
        bindFilter('funcFStatus', 'user', 'status', STATUS, 'Ativos', v => v === 'ativos');
        renderFuncGrid();
    }
});

// Férias em curso do funcionário (usa as ausências já carregadas na página)
const funcFerias = f => feriasVigente(f.id, funcState.ausencias);

// Cor do ponto no card, por prioridade: desligado → de férias (azul) → vencida (laranja)
// → vencendo (amarelo) → ativo (verde). Gozo em curso vence o alerta: quem está de férias
// agora está resolvendo o ciclo, não acumulando risco.
function funcStatusDot(f, fer, sit) {
    if (!funcAtivo(f)) return { cls: 'off', txt: 'Desligado' };
    // Antes de qualquer alerta: admissão futura invalida tudo que se deriva dela.
    if (admissaoFutura(f)) return { cls: 'futuro', txt: `Admissão em ${fmtDate(f.admissao)} — data futura` };
    if (fer) return { cls: 'ferias', txt: `De férias até ${fmtDate(fer.retorno)}` };
    if (sit?.status === 'vencida') return { cls: 'vencida', txt: `Férias vencidas — ${sit.label}` };
    if (sit?.status === 'critica') return { cls: 'vencendo', txt: `Férias vencendo — ${sit.label}` };
    return { cls: 'on', txt: 'Ativo' };
}

function funcFiltrados() {
    const { q, unidade, cargo, status } = funcState.filtro;
    const porStatus = f => {
        if (status === '') return true;
        if (status === 'ativos') return funcAtivo(f);
        if (status === 'ferias') return funcAtivo(f) && !!funcFerias(f);   // de férias continua ativo
        // Vencendo = dentro do alerta legal (status 'critica'), ainda no prazo. Quem já
        // está gozando não está "vencendo" — o gozo em curso resolve o ciclo.
        if (status === 'ferias_vencendo') return !funcFerias(f) && situacaoFeriasFunc(f, funcState.ausencias)?.status === 'critica';
        // Vencidas = prazo concessivo estourado (art. 137 CLT, férias em dobro).
        if (status === 'ferias_vencidas') return !funcFerias(f) && situacaoFeriasFunc(f, funcState.ausencias)?.status === 'vencida';
        return !funcAtivo(f);
    };
    return funcState.funcionarios
        .filter(f => !q || (f.nome || '').toLowerCase().includes(q.toLowerCase()))
        .filter(f => !unidade || f.unidadeId === unidade)
        .filter(f => !cargo || f.cargoId === cargo)
        .filter(porStatus)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
}

function renderFuncGrid() {
    const grid = document.getElementById('funcGrid');
    const lista = funcFiltrados();
    const ativos = funcState.funcionarios.filter(funcAtivo).length;
    const nFerias = funcState.funcionarios.filter(f => funcAtivo(f) && funcFerias(f)).length;
    const contaSit = st => funcState.funcionarios.filter(f =>
        !funcFerias(f) && situacaoFeriasFunc(f, funcState.ausencias)?.status === st).length;
    const nVencendo = contaSit('critica');
    const nVencidas = contaSit('vencida');
    document.getElementById('funcCount').innerHTML =
        `${ativos} ativo${ativos !== 1 ? 's' : ''} · ${funcState.funcionarios.length} no total`
        + (nFerias ? ` · <span class="txt-ferias">${nFerias} de férias hoje</span>` : '')
        + (nVencendo ? ` · <span class="txt-warning">${nVencendo} com férias vencendo</span>` : '')
        + (nVencidas ? ` · <span class="txt-danger">${nVencidas} com férias vencidas</span>` : '');

    if (!lista.length) {
        grid.innerHTML = emptyState({
            icon: 'users',
            title: 'Nenhum funcionário encontrado',
            text: funcState.funcionarios.length ? 'Ajuste os filtros de busca.' : 'Cadastre o primeiro funcionário para começar.'
        });
        return;
    }

    grid.innerHTML = `<div class="func-grid">${lista.map(f => {
        const cargo = cargoDe(f), unidade = unidadeDe(f);
        const nTrein = funcState.treinamentos.filter(t => (t.participantes || []).includes(f.id)).length;
        const fer = funcAtivo(f) ? funcFerias(f) : null;
        const sit = situacaoFeriasFunc(f, funcState.ausencias);
        const dot = funcStatusDot(f, fer, sit);
        return `
        <div class="func-card${fer ? ' em-ferias' : ''}" data-id="${f.id}">
            <span class="func-status ${dot.cls}" title="${escapeHtml(dot.txt)}"></span>
            <div class="func-top">
                <div class="avatar lg">${iniciais(f.nome)}</div>
                <div class="grow">
                    <div class="func-nome">${escapeHtml(f.nome)}</div>
                    <div class="func-cargo">${escapeHtml(cargo?.nome || 'Sem cargo')}</div>
                </div>
            </div>
            <div class="func-tags">
                <span class="chip-soft">${icon('building')} ${escapeHtml(unidade?.nome || 'Sem unidade')}</span>
                ${admissaoFutura(f)
                    ? `<span class="chip-soft chip-futuro" title="Tempo de casa, férias e experiência não são calculáveis enquanto a admissão estiver no futuro. Verifique a data.">${icon('alert')} Admissão em ${fmtDate(f.admissao)}</span>`
                    : fer
                    ? `<span class="chip-soft chip-ferias" title="Volta em ${fmtDate(fer.retorno)}">${icon('sun')} Férias · volta em ${diasAteRetorno(fer)}d</span>`
                    : sit ? `<span class="chip-soft chip-prog chip-prog-${sit.status}" title="${escapeHtml(sit.desc)}">${icon(sit.status === 'aquisitivo' ? 'calendar' : 'alert')} ${escapeHtml(sit.label)}</span>` : ''}
            </div>
            <div class="func-meta">
                <span class="flex" style="gap:5px" title="Tempo de empresa">${icon('calendar')} ${tempoEmpresa(f.admissao, f.demissao)}</span>
                <span class="flex" style="gap:5px" title="Treinamentos">${icon('book')} ${nTrein}</span>
            </div>
        </div>`;
    }).join('')}</div>`;

    grid.querySelectorAll('.func-card').forEach(card => {
        card.onclick = () => drawerFuncionario(funcState.funcionarios.find(f => f.id === card.dataset.id));
    });
}

// ---- Drawer de detalhe ----
function drawerFuncionario(f, abaInicial = 'dados') {
    const cargo = cargoDe(f), unidade = unidadeDe(f);
    const podeEditar = can('editar_funcionarios');
    const fer = funcAtivo(f) ? funcFerias(f) : null;
    const sitF = situacaoFeriasFunc(f, funcState.ausencias);
    const d = openDrawer({
        headerHtml: `
            <div class="drawer-title-row">
                <div class="avatar xl">${iniciais(f.nome)}</div>
                <div class="grow">
                    <h3>${escapeHtml(f.nome)}</h3>
                    <div class="drawer-sub">${escapeHtml(cargo?.nome || 'Sem cargo')}</div>
                    <div class="drawer-tags">
                        <span class="badge ${funcAtivo(f) ? 'badge-success' : 'badge-danger'}">${funcAtivo(f) ? 'Ativo' : 'Desligado'}</span>
                        ${fer ? `<span class="badge badge-ferias" title="De ${fmtDate(fer.inicio)} a ${fmtDate(fer.retorno)}">${icon('sun')} De férias · volta em ${diasAteRetorno(fer)}d</span>` : ''}
                        ${sitF && !fer && sitF.status !== 'aquisitivo' ? `<span class="badge ${FERIAS_STATUS[sitF.status].cls}" title="${escapeHtml(sitF.desc)}">${icon('alert')} Férias: ${escapeHtml(sitF.label)}</span>` : ''}
                        <span class="badge badge-neutral">${icon('building')} ${escapeHtml(unidade?.nome || 'Sem unidade')}</span>
                    </div>
                </div>
                ${podeEditar ? `<button class="btn btn-secondary btn-sm" id="fdEdit">${icon('edit')} Editar</button>` : ''}
            </div>`
    });

    d.body.innerHTML = `
        <div class="tabs tabs-full" id="fdTabs">
            <div class="tab" data-tab="dados">Dados</div>
            <div class="tab" data-tab="beneficios">Benefícios</div>
            <div class="tab" data-tab="documentos">Documentos</div>
            <div class="tab" data-tab="historico">Histórico</div>
        </div>
        <div class="mt-16" id="fdContent"></div>`;

    const btnEdit = d.el.querySelector('#fdEdit');
    if (btnEdit) btnEdit.onclick = () => { d.close(); formFuncionario(f); };

    const tabs = d.body.querySelectorAll('#fdTabs .tab');
    const setTab = id => {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === id));
        ({ dados: fdDados, beneficios: fdBeneficios, documentos: fdDocumentos, historico: fdHistorico })[id](f, d.body.querySelector('#fdContent'));
    };
    tabs.forEach(t => t.onclick = () => setTab(t.dataset.tab));
    setTab(abaInicial);
}

function fdDados(f, cont) {
    const cargo = cargoDe(f);
    const idadeF = idade(f.nascimento);
    const fin = can('ver_financeiro');

    // Agrupado em seções temáticas em vez de um grid chapado
    const secoes = [
        { titulo: 'Dados pessoais', icon: 'user', itens: [
            ['Sexo', f.sexo || '—'],
            ['Nascimento', `${fmtDate(f.nascimento)}${idadeF != null ? ` · ${idadeF} anos` : ''}`],
            ['Escolaridade', f.escolaridade || '—'],
            ['Vestimenta', f.vestimenta || '—']
        ]},
        { titulo: 'Contato', icon: 'user', itens: [
            ['Telefone', f.telefone || '—'],
            ['E-mail', f.email || '—']
        ]},
        { titulo: 'Contrato', icon: 'briefcase', itens: [
            ['Admissão', fmtDate(f.admissao)],
            ['Demissão', f.demissao ? fmtDate(f.demissao) : '—'],
            ['Tempo de empresa', tempoEmpresa(f.admissao, f.demissao)],
            ...(cargo?.insalubridade ? [['Insalubridade', `Grau ${cargo.insalubridade}%`]] : [])
        ]}
    ];
    if (fin) secoes.push({ titulo: 'Financeiro', icon: 'money', itens: [
        ['Salário', `${fmtBRL(salarioDe(f))}${f.salario == null ? ' · base do cargo' : ''}`]
    ]});

    cont.innerHTML = secoes.map(s => `
        <div class="fd-section">
            <div class="fd-section-head">${icon(s.icon)}<span>${s.titulo}</span></div>
            <div class="fd-section-body">${s.itens.map(([l, v]) => `
                <div class="fd-row"><span class="fd-k">${l}</span><span class="fd-v">${escapeHtml(v)}</span></div>`).join('')}</div>
        </div>`).join('');
}

// ---- Benefícios do funcionário ----
function custoBeneficioFunc(fb) {
    const b = funcState.beneficios.find(x => x.id === fb.beneficioId);
    if (!b) return 0;
    return (Number(b.custoTitular) || 0) + (fb.dependentes || []).length * (Number(b.custoDependente) || 0);
}

function fdBeneficios(f, cont) {
    const adesoes = f.beneficios || [];
    const podeEditar = can('editar_funcionarios');
    const total = adesoes.reduce((s, fb) => s + custoBeneficioFunc(fb), 0);
    const descontoDe = fb => {
        const b = funcState.beneficios.find(x => x.id === fb.beneficioId);
        return custoBeneficioFunc(fb) * (Number(b?.descontoPct) || 0) / 100;
    };
    const descontoTotal = adesoes.reduce((s, fb) => s + descontoDe(fb), 0);

    cont.innerHTML = `
        ${podeEditar ? `<button class="btn btn-secondary btn-sm" id="fbAdd" style="margin-bottom:12px">${icon('plus')} Adicionar benefício</button>` : ''}
        ${adesoes.length ? adesoes.map((fb, i) => {
            const b = funcState.beneficios.find(x => x.id === fb.beneficioId);
            const deps = fb.dependentes || [];
            return `
            <div class="benef-item">
                <div class="benef-top">
                    <span style="color:var(--accent)">${icon('gift')}</span>
                    <div class="benef-nome">${escapeHtml(b?.nome || 'Benefício removido')}<div class="muted" style="font-size:11.5px;font-weight:500">${escapeHtml(b?.tipo || '')}${b?.descontoPct ? ` · funcionário paga ${b.descontoPct}%` : ' · empresa paga 100%'}</div></div>
                    ${can('ver_financeiro') ? `<strong>${fmtBRL(custoBeneficioFunc(fb))}/mês${descontoDe(fb) ? `<div class="muted" style="font-size:11px;font-weight:500;text-align:right">− ${fmtBRL(descontoDe(fb))} desc.</div>` : ''}</strong>` : ''}
                    ${podeEditar ? `<button class="btn-icon" data-edit="${i}">${icon('edit')}</button><button class="btn-icon danger" data-del="${i}">${icon('trash')}</button>` : ''}
                </div>
                ${deps.length ? `<div class="benef-deps">${deps.map(dp => `<span class="badge badge-neutral">${icon('user')} ${escapeHtml(dp)}</span>`).join('')}</div>` : ''}
            </div>`;
        }).join('') : `<p class="muted">Nenhum benefício cadastrado para este funcionário.</p>`}
        ${adesoes.length && can('ver_financeiro') ? `
        <div class="mt-16" style="border-top:1px solid var(--border);padding-top:12px">
            <div class="flex-between"><span class="text-2">Custo total do pacote</span><strong>${fmtBRL(total)}</strong></div>
            <div class="flex-between"><span class="text-2">Desconto do funcionário (coparticipação)</span><strong style="color:var(--danger)">− ${fmtBRL(descontoTotal)}</strong></div>
            <div class="flex-between"><strong>Custo da empresa</strong><strong style="color:var(--accent)">${fmtBRL(total - descontoTotal)}</strong></div>
        </div>` : ''}`;

    if (podeEditar) {
        const btnAdd = cont.querySelector('#fbAdd');
        if (btnAdd) btnAdd.onclick = () => formBeneficioFunc(f, null);
        cont.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => formBeneficioFunc(f, Number(b.dataset.edit)));
        cont.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
            const i = Number(b.dataset.del);
            const ben = funcState.beneficios.find(x => x.id === adesoes[i].beneficioId);
            if (await confirmDialog({ title: 'Remover benefício', message: `Remover <strong>${escapeHtml(ben?.nome || 'benefício')}</strong> de ${escapeHtml(f.nome)}?`, confirmText: 'Remover', danger: true })) {
                const novos = adesoes.filter((_, idx) => idx !== i);
                await DB.save(PATHS.funcionarios, f.id, { beneficios: novos });
                f.beneficios = novos;
                toast('Benefício removido.');
                fdBeneficios(f, cont);
            }
        });
    }
}

function formBeneficioFunc(f, idx) {
    const isEdit = idx !== null;
    const adesoes = f.beneficios || [];
    const fb = isEdit ? adesoes[idx] : null;
    const disponiveis = funcState.beneficios.filter(b =>
        isEdit ? true : !adesoes.some(a => a.beneficioId === b.id));

    if (!disponiveis.length) return toast('Nenhum benefício disponível. Cadastre em Configurações → Benefícios.', 'info');

    const m = openModal({
        title: isEdit ? 'Editar benefício do funcionário' : 'Adicionar benefício',
        body: `
            <div class="field"><label>Benefício <span class="req">*</span></label>
                <select class="select" id="fbfBen" ${isEdit ? 'disabled' : ''}>
                    ${disponiveis.map(b => `<option value="${b.id}" ${fb?.beneficioId === b.id ? 'selected' : ''}>${escapeHtml(b.nome)} (${escapeHtml(b.tipo || '')})</option>`).join('')}
                </select>
            </div>
            <div class="field"><label>Dependentes</label>
                <textarea class="input" id="fbfDeps" rows="3" placeholder="Um nome por linha (deixe vazio se não houver)">${(fb?.dependentes || []).join('\n')}</textarea>
                <div class="field-hint" id="fbfCusto"></div>
            </div>`,
        footer: ''
    });

    const sel = m.body.querySelector('#fbfBen');
    const depsEl = m.body.querySelector('#fbfDeps');
    const custoEl = m.body.querySelector('#fbfCusto');
    const atualizaCusto = () => {
        const b = funcState.beneficios.find(x => x.id === sel.value);
        const nDeps = depsEl.value.split('\n').map(s => s.trim()).filter(Boolean).length;
        if (b && can('ver_financeiro')) {
            const total = (Number(b.custoTitular) || 0) + nDeps * (Number(b.custoDependente) || 0);
            custoEl.textContent = `Custo mensal: ${fmtBRL(b.custoTitular)} titular${nDeps ? ` + ${nDeps} × ${fmtBRL(b.custoDependente)} dependente(s)` : ''} = ${fmtBRL(total)}`;
        } else custoEl.textContent = '';
    };
    sel.onchange = atualizaCusto;
    depsEl.addEventListener('input', atualizaCusto);
    atualizaCusto();

    m.footer.innerHTML = `
        <button class="btn btn-secondary" data-cancel>Cancelar</button>
        <button class="btn btn-primary" data-save>${isEdit ? 'Salvar' : 'Adicionar'}</button>`;
    m.footer.querySelector('[data-cancel]').onclick = m.close;
    m.footer.querySelector('[data-save]').onclick = async () => {
        const dependentes = depsEl.value.split('\n').map(s => s.trim()).filter(Boolean);
        const novo = { beneficioId: sel.value, dependentes };
        const novos = isEdit ? adesoes.map((a, i) => i === idx ? novo : a) : [...adesoes, novo];
        await DB.save(PATHS.funcionarios, f.id, { beneficios: novos });
        f.beneficios = novos;
        toast(isEdit ? 'Benefício atualizado.' : 'Benefício adicionado.');
        m.close();
        const cont = document.querySelector('#fdContent');
        if (cont) fdBeneficios(f, cont);
    };
}

// Reabre a ficha em Documentos, na mesma sub-aba — o drawer é único, então detalhes
// abertos a partir daqui precisam devolver o usuário ao contexto de onde saiu.
function fdVoltarDocumentos(f, aba) {
    fdDocAba = aba;
    drawerFuncionario(f, 'documentos');
}

// ---- Documentos: uma sub-aba por tipo ----
// O tipo deixou de ser campo do formulário: cada aba publica no seu próprio tipo. Escolher
// "Contrato" num select depois de já ter clicado em "Contrato" era pedir a mesma informação
// duas vezes — e permitia divergir (estar na aba X e salvar como Y).
async function fdDocumentos(f, cont) {
    cont.innerHTML = '<div class="loading-center"><div class="spinner-dark"></div></div>';
    // ASO vem de rh_asos (fonte única, compartilhada com Lançamentos → ASO)
    const asos = (await DB.getAll(PATHS.asos))
        .filter(a => a.funcionarioId === f.id)
        .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    const docs = f.documentos || [];
    const contaDe = ab => ab.aso ? asos.length : docs.filter(d => fdDocTipoDe(d) === ab.id).length;

    cont.innerHTML = `
        <div class="tabs tabs-sub" id="fdDocSubs">${FD_DOC_ABAS.map(ab => `
            <div class="tab" data-sub="${escapeHtml(ab.id)}">${escapeHtml(ab.label)}${contaDe(ab) ? ` <span class="tab-count">${contaDe(ab)}</span>` : ''}</div>`).join('')}
        </div>
        <div class="mt-12" id="fdDocBody"></div>`;

    const box = cont.querySelector('#fdDocBody');
    const subs = cont.querySelectorAll('#fdDocSubs .tab');
    const setSub = id => {
        fdDocAba = id;
        subs.forEach(t => t.classList.toggle('active', t.dataset.sub === id));
        const ab = FD_DOC_ABAS.find(x => x.id === id);
        (ab?.aso ? fdDocAso : fdDocLista)(f, box, id, asos);
    };
    subs.forEach(t => t.onclick = () => setSub(t.dataset.sub));
    setSub(FD_DOC_ABAS.some(a => a.id === fdDocAba) ? fdDocAba : 'aso');
}

// ---- Sub-aba ASO: mesma fonte e mesmo formulário da aba ASO em Lançamentos ----
function fdDocAso(f, box, _id, asos) {
    // editar_lancamentos (não editar_funcionarios): o ASO é um lançamento, e quem pode
    // lançá-lo na aba ASO tem de poder lançá-lo aqui — é o mesmo registro.
    const podeEditar = can('editar_lancamentos');
    const medico = can('ver_medico');
    const cargo = cargoDe(f);
    const sit = situacaoAsoFunc(f, asos, cargo);

    // Cabeçalho de situação: é o que a ficha precisa responder — este colaborador pode
    // exercer a função hoje? Some para desligado/admissão futura (sit = null).
    const cab = sit ? `
        <div class="fd-aso-sit fd-aso-${sit.status}">
            <span class="prog-dot ${ASO_STATUS[sit.status].dot}"></span>
            <div class="grow">
                <strong>${escapeHtml(sit.label)}</strong>
                <div class="muted" style="font-size:11.5px">${escapeHtml(sit.desc)}</div>
            </div>
        </div>` : '';

    box.innerHTML = `
        ${cab}
        ${podeEditar ? `<button class="btn btn-secondary btn-sm" id="asoAdd" style="margin:12px 0">${icon('plus')} Lançar ASO</button>` : ''}
        ${!medico ? `<p class="muted" style="font-size:11.5px;margin-bottom:8px">${icon('lock')} Resultado, restrições e laudo exigem a permissão "Ver dados médicos".</p>` : ''}
        ${asos.length ? `<div class="hist-list">${asos.map((a, i) => `
            <div class="hist-row" data-i="${i}" tabindex="0" role="button">
                <div class="hist-main">
                    <div class="hist-top">
                        <span class="hist-per">${escapeHtml(a.tipo || 'ASO')}</span>
                        <span class="hist-dias">${fmtDate(a.data)}</span>
                    </div>
                    <div class="hist-sub">
                        ${medico && a.resultado
                            ? `<span class="badge ${a.resultado === 'Inapto' ? 'badge-danger' : a.resultado === 'Apto com restrições' ? 'badge-warning' : 'badge-success'}">${escapeHtml(a.resultado)}</span>`
                            : `<span class="muted" style="font-size:11.5px">${icon('lock')} restrito</span>`}
                        ${medico && anexosDe(a).length ? `<span class="hist-clip" title="Laudo anexado">${icon('paperclip')}</span>` : ''}
                    </div>
                </div>
                <span class="hist-go">${icon('chevronRight')}</span>
            </div>`).join('')}</div>`
            : '<p class="muted">Nenhum ASO registrado para este colaborador.</p>'}`;

    const btn = box.querySelector('#asoAdd');
    // Abre o MESMO formulário da aba ASO, já com o funcionário fixado. Ao fechar, devolve
    // à ficha — senão o usuário cairia em Lançamentos, que não é de onde ele veio.
    if (btn) btn.onclick = () => formAso({ funcionarioId: f.id }, sit, () => fdVoltarDocumentos(f, 'aso'));
    box.querySelectorAll('.hist-row').forEach(row => {
        const a = asos[Number(row.dataset.i)];
        const abrir = () => detalheAso(a, () => fdVoltarDocumentos(f, 'aso'));
        row.onclick = abrir;
        row.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } };
    });
}

// ---- Sub-abas de documento comum: lista filtrada pelo tipo da aba ----
function fdDocLista(f, box, tipo) {
    const docs = f.documentos || [];
    const podeEditar = can('editar_funcionarios');
    // Índice no array original: o save/exclusão precisa dele, não do índice do filtro
    const daAba = docs.map((d, i) => ({ d, i })).filter(x => fdDocTipoDe(x.d) === tipo);

    box.innerHTML = `
        ${podeEditar ? `<button class="btn btn-secondary btn-sm" id="docAdd" style="margin-bottom:12px">${icon('plus')} Adicionar ${escapeHtml(tipo.toLowerCase())}</button>` : ''}
        ${daAba.length ? daAba.map(({ d: doc, i }) => {
            const trein = doc.treinamentoId ? funcState.treinamentos.find(t => t.id === doc.treinamentoId) : null;
            return `
            <div class="benef-item">
                <div class="benef-top">
                    ${doc.anexo ? `<span data-doc-open="${i}" class="anexo-chip">${anexoIcone(doc.anexo.formato, 34)}</span>` : anexoIcone('outro', 34)}
                    <div class="benef-nome">
                        ${escapeHtml(doc.nome || 'Documento')}
                        <div class="muted" style="font-size:11.5px;font-weight:500">
                            ${trein ? `${escapeHtml(trein.nome)} · ` : ''}${fmtDate(doc.data)}
                        </div>
                        ${doc.descricao ? `<div class="text-2" style="font-size:12px;font-weight:400;margin-top:2px">${escapeHtml(doc.descricao)}</div>` : ''}
                    </div>
                    ${doc.anexo ? `<button class="btn btn-secondary btn-sm" data-doc-open="${i}">Abrir</button>` : '<span class="muted" style="font-size:11.5px">sem anexo</span>'}
                    ${podeEditar ? `<button class="btn-icon" data-edit="${i}">${icon('edit')}</button><button class="btn-icon danger" data-del="${i}">${icon('trash')}</button>` : ''}
                </div>
            </div>`;
        }).join('') : `<p class="muted">Nenhum documento nesta seção.</p>`}`;

    box.querySelectorAll('[data-doc-open]').forEach(el =>
        el.addEventListener('click', () => abrirAnexo(docs[Number(el.dataset.docOpen)].anexo)));

    if (!podeEditar) return;
    const btnAdd = box.querySelector('#docAdd');
    // O tipo vem da aba, não de um select no form
    if (btnAdd) btnAdd.onclick = () => formDocumento(f, null, tipo);
    box.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => formDocumento(f, Number(b.dataset.edit), tipo));
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        const i = Number(b.dataset.del);
        if (await confirmDialog({ title: 'Excluir documento', message: `Excluir <strong>${escapeHtml(docs[i].nome || 'documento')}</strong>?${docs[i].anexo ? ' O anexo também será excluído.' : ''}`, confirmText: 'Excluir', danger: true })) {
            await excluirAnexoRemoto(docs[i].anexo);
            const novos = docs.filter((_, idx) => idx !== i);
            await DB.save(PATHS.funcionarios, f.id, { documentos: novos });
            f.documentos = novos;
            toast('Documento excluído.');
            const cont = document.querySelector('#fdContent');
            if (cont) fdDocumentos(f, cont);
        }
    });
}

// `tipo` vem da sub-aba de onde o usuário clicou — não há select de tipo no form.
function formDocumento(f, idx, tipo) {
    const isEdit = idx !== null;
    const docs = f.documentos || [];
    const doc = isEdit ? docs[idx] : null;
    const tipoDoc = tipo || doc?.tipo || 'Outro';
    const ehCertificado = tipoDoc.startsWith('Certificado');
    const treinosDoFunc = funcState.treinamentos.filter(t => (t.participantes || []).includes(f.id));

    const m = openModal({
        title: `${isEdit ? 'Editar' : 'Adicionar'} — ${tipoDoc}`,
        body: `
            <div class="form-row">
                <div class="field"><label>Nome do documento <span class="req">*</span></label>
                    <input class="input" id="fdcNome" placeholder="${ehCertificado ? 'Ex: Certificado NR-35' : 'Ex: Contrato assinado'}" value="${escapeHtml(doc?.nome || '')}">
                </div>
                <div class="field"><label>Data</label><input class="input" id="fdcData" type="date" value="${doc?.data || hoje()}"></div>
            </div>
            ${ehCertificado ? `
            <div class="field"><label>Treinamento vinculado</label>
                <select class="select" id="fdcTreino">
                    <option value="">— Nenhum —</option>
                    ${treinosDoFunc.map(t => `<option value="${t.id}" ${doc?.treinamentoId === t.id ? 'selected' : ''}>${escapeHtml(t.nome)} (${fmtDate(t.inicio)})</option>`).join('')}
                </select>
            </div>` : ''}
            <div class="field"><label>Observação</label><textarea class="input" id="fdcDesc" rows="2">${escapeHtml(doc?.descricao || '')}</textarea></div>
            <div class="field">
                <label>Anexo</label>
                <div id="fdcAnexo"></div>
            </div>`,
        footer: ''
    });

    const anexoCtl = initAnexoField(m.body.querySelector('#fdcAnexo'), doc?.anexo || null);

    m.footer.innerHTML = `
        <button class="btn btn-secondary" data-cancel>Cancelar</button>
        <button class="btn btn-primary" data-save>${isEdit ? 'Salvar' : 'Adicionar'}</button>`;
    m.footer.querySelector('[data-cancel]').onclick = m.close;
    const btnSave = m.footer.querySelector('[data-save]');
    btnSave.onclick = async () => {
        const nome = m.body.querySelector('#fdcNome').value.trim();
        if (!nome) return toast('Informe o nome do documento.', 'error');
        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner"></span> Salvando...';
        try {
            const { anexos, removidos } = await anexoCtl.getAnexos();
            const novo = {
                tipo: tipoDoc,                    // vem da aba, não de um select
                nome,
                data: m.body.querySelector('#fdcData').value || hoje(),
                descricao: m.body.querySelector('#fdcDesc').value.trim(),
                treinamentoId: ehCertificado ? (m.body.querySelector('#fdcTreino').value || null) : null,
                anexo: anexos[0] || null
            };
            const novos = isEdit ? docs.map((d, i) => i === idx ? novo : d) : [...docs, novo];
            await DB.save(PATHS.funcionarios, f.id, { documentos: novos });
            await excluirAnexoRemoto(removidos);
            f.documentos = novos;
            toast(isEdit ? 'Documento atualizado.' : 'Documento adicionado.');
            m.close();
            const cont = document.querySelector('#fdContent');
            if (cont) fdDocumentos(f, cont);
        } catch (e) {
            toast(e.message || 'Erro ao salvar o documento.', 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = isEdit ? 'Salvar' : 'Adicionar';
        }
    };
}

// ---- Histórico (alimentado pelos Lançamentos) ----
// Sub-abas: linha do tempo + recortes por natureza da ausência (CLT) + treinamentos.
// "Atestado" não é tipo de ausência, é o comprovante (campo anexo) — por isso o recorte
// documental aparece como selo de anexo dentro de Afastamentos, não como aba própria.
const FD_HIST_FALTAS = ['Falta justificada', 'Falta injustificada'];
const FD_HIST_AFAST = ['Licença médica', 'Licença maternidade/paternidade', 'Outra licença'];
let fdHistSub = 'timeline';

// Reabre a ficha na aba Histórico, na mesma sub-aba — o drawer é único (openDrawer
// fecha o anterior), então detalhes de item precisam devolver o usuário ao contexto.
function fdVoltarHistorico(f, sub) {
    fdHistSub = sub;
    drawerFuncionario(f, 'historico');
}

async function fdHistorico(f, cont) {
    cont.innerHTML = '<div class="loading-center"><div class="spinner-dark"></div></div>';
    const [ausencias, demissoes, treinamentos, promocoes, transferencias] = await Promise.all([
        DB.getAll(PATHS.ausencias), DB.getAll(PATHS.demissoes),
        DB.getAll(PATHS.treinamentos), DB.getAll(PATHS.promocoes), DB.getAll(PATHS.transferencias)
    ]);

    const ausF = ausencias.filter(a => a.funcionarioId === f.id)
        .sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
    const treF = treinamentos.filter(t => (t.participantes || []).includes(f.id))
        .sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
    const porTipo = tipos => ausF.filter(a => tipos.includes(a.tipo));
    const faltas = porTipo(FD_HIST_FALTAS), afast = porTipo(FD_HIST_AFAST), ferias = porTipo(['Férias']);

    const eventos = [];
    if (f.admissao) eventos.push({ data: f.admissao, tipo: 'success', titulo: 'Admissão', desc: '' });
    ausencias.filter(a => a.funcionarioId === f.id).forEach(a =>
        eventos.push({ data: a.inicio, tipo: 'warning', titulo: a.motivo || 'Ausência', desc: `${fmtDate(a.inicio)} → ${fmtDate(a.retorno)} · ${a.dias || diasEntre(a.inicio, a.retorno)} dia(s)` }));
    promocoes.filter(p => p.funcionarioId === f.id).forEach(p =>
        eventos.push({ data: p.data, tipo: '', titulo: 'Promoção', desc: `${p.cargoAnteriorNome || ''} → ${p.cargoNovoNome || ''}${can('ver_financeiro') && p.pctAumento != null ? ` (+${Number(p.pctAumento).toFixed(1)}%)` : ''}` }));
    transferencias.filter(t => t.funcionarioId === f.id).forEach(t =>
        eventos.push({ data: t.data, tipo: 'info', titulo: 'Transferência de unidade', desc: `${t.unidadeOrigemNome || '—'} → ${t.unidadeDestinoNome || '—'}${t.motivo ? ` · ${t.motivo}` : ''}` }));
    treinamentos.filter(t => (t.participantes || []).includes(f.id)).forEach(t =>
        eventos.push({ data: t.inicio, tipo: '', titulo: `Treinamento: ${t.nome}`, desc: `${t.cargaHoraria || 0}h · ${t.tipo || ''}${t.responsavel ? ` · Resp.: ${t.responsavel}` : ''}` }));
    demissoes.filter(dm => dm.funcionarioId === f.id).forEach(dm =>
        eventos.push({ data: dm.data, tipo: 'danger', titulo: 'Desligamento', desc: dm.motivo || '' }));

    eventos.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    const subs = [
        { id: 'timeline', label: 'Linha do tempo', n: eventos.length },
        { id: 'faltas', label: 'Faltas', n: faltas.length },
        { id: 'afastamentos', label: 'Afastamentos', n: afast.length },
        { id: 'ferias', label: 'Férias', n: ferias.length },
        { id: 'treinamentos', label: 'Treinamentos', n: treF.length }
    ];

    cont.innerHTML = `
        <div class="tabs tabs-sub" id="fdHistSubs">${subs.map(s => `
            <div class="tab" data-sub="${s.id}">${s.label}${s.n ? ` <span class="tab-count">${s.n}</span>` : ''}</div>`).join('')}
        </div>
        <div class="mt-12" id="fdHistBody"></div>`;

    const box = cont.querySelector('#fdHistBody');
    const timelineHtml = () => eventos.length ? `
        <div class="timeline">${eventos.map(e => `
            <div class="tl-item tl-${e.tipo}">
                <div class="tl-date">${fmtDate(e.data)}</div>
                <div class="tl-title">${escapeHtml(e.titulo)}</div>
                ${e.desc ? `<div class="tl-desc">${escapeHtml(e.desc)}</div>` : ''}
            </div>`).join('')}</div>`
        : '<p class="muted">Nenhum evento registrado.</p>';

    // Linha enxuta: período · dias · rótulo · selo de anexo. Clique abre o detalhe completo.
    const listaHtml = (itens, vazio, linha) => itens.length
        ? `<div class="hist-list">${itens.map((it, i) => `
            <div class="hist-row" data-i="${i}" tabindex="0" role="button">${linha(it)}</div>`).join('')}</div>`
        : `<p class="muted">${vazio}</p>`;

    const selo = anexo => anexo ? `<span class="hist-clip" title="Com comprovante anexado">${icon('paperclip')}</span>` : '';
    const seta = `<span class="hist-go">${icon('chevronRight')}</span>`;
    const linhaAus = (a, badgeCls, rotulo) => `
        <div class="hist-main">
            <div class="hist-top">
                <span class="hist-per">${fmtDate(a.inicio)} → ${fmtDate(a.retorno)}</span>
                <span class="hist-dias">${fmtNum(a.dias ?? diasEntre(a.inicio, a.retorno))}d</span>
            </div>
            <div class="hist-sub">
                <span class="badge ${badgeCls}">${escapeHtml(rotulo(a))}</span>${selo(a.anexo)}
            </div>
        </div>
        ${seta}`;

    const views = {
        timeline: () => box.innerHTML = timelineHtml(),

        faltas: () => {
            box.innerHTML = listaHtml(faltas, 'Nenhuma falta registrada.', a =>
                linhaAus(a, 'badge-danger', x => x.tipo || '—'));
            bindLinhas(faltas, a => detalheAusencia(a, null, () => fdVoltarHistorico(f, 'faltas')));
        },

        afastamentos: () => {
            box.innerHTML = listaHtml(afast, 'Nenhum afastamento registrado.', a =>
                linhaAus(a, 'badge-warning', x => x.tipo || '—'));
            bindLinhas(afast, a => detalheAusencia(a, null, () => fdVoltarHistorico(f, 'afastamentos')));
        },

        ferias: () => {
            box.innerHTML = listaHtml(ferias, 'Nenhum período de férias registrado.', a =>
                linhaAus(a, 'badge-info', () => 'Férias'));
            bindLinhas(ferias, a => detalheAusencia(a, null, () => fdVoltarHistorico(f, 'ferias')));
        },

        treinamentos: () => {
            box.innerHTML = listaHtml(treF, 'Nenhum treinamento registrado.', t => `
                <div class="hist-main">
                    <div class="hist-top">
                        <span class="hist-per">${escapeHtml(t.nome || 'Treinamento')}</span>
                        <span class="hist-dias">${fmtNum(t.cargaHoraria)}h</span>
                    </div>
                    <div class="hist-sub">
                        <span class="badge badge-info">${escapeHtml(t.tipo || '—')}</span>
                        <span class="hist-meta">${fmtDate(t.inicio)}${t.termino && t.termino !== t.inicio ? ` → ${fmtDate(t.termino)}` : ''}</span>${selo(t.anexo)}
                    </div>
                </div>
                ${seta}`);
            bindLinhas(treF, t => detalheTreinamento(t, null, () => fdVoltarHistorico(f, 'treinamentos')));
        }
    };

    function bindLinhas(itens, onOpen) {
        box.querySelectorAll('.hist-row').forEach(row => {
            const it = itens[Number(row.dataset.i)];
            const abrir = () => onOpen(it);
            row.onclick = abrir;
            row.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } };
        });
    }

    const subEls = cont.querySelectorAll('#fdHistSubs .tab');
    const setSub = id => {
        fdHistSub = id;
        subEls.forEach(t => t.classList.toggle('active', t.dataset.sub === id));
        views[id]();
    };
    subEls.forEach(t => t.onclick = () => setSub(t.dataset.sub));
    setSub(views[fdHistSub] ? fdHistSub : 'timeline');
}

// ---- Formulário da ficha ----
function formFuncionario(f) {
    const isEdit = !!f;
    if (!funcState.cargos.length || !funcState.unidades.length)
        return toast('Cadastre ao menos um cargo e uma unidade em Configurações antes.', 'info');

    const m = openModal({
        title: isEdit ? 'Editar funcionário' : 'Novo funcionário',
        size: 'modal-lg',
        body: `
            <div class="form-section">
                <div class="form-section-title">Dados pessoais</div>
                <div class="field"><label>Nome completo <span class="req">*</span></label><input class="input" id="ffNome" placeholder="Nome e sobrenome" value="${escapeHtml(f?.nome || '')}"></div>
                <div class="form-row">
                    <div class="field"><label>Sexo <span class="req">*</span></label>
                        <select class="select" id="ffSexo">${SEXOS.map(s => `<option ${f?.sexo === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
                    </div>
                    <div class="field"><label>Data de nascimento <span class="req">*</span></label><input class="input" id="ffNasc" type="date" value="${f?.nascimento || ''}"></div>
                </div>
                <div class="form-row" style="margin-bottom:0">
                    <div class="field" style="margin-bottom:0"><label>Escolaridade <span class="req">*</span></label>
                        <select class="select" id="ffEsc">${ESCOLARIDADES.map(e => `<option ${f?.escolaridade === e ? 'selected' : ''}>${e}</option>`).join('')}</select>
                    </div>
                    <div class="field" style="margin-bottom:0"><label>Vestimenta</label>
                        <select class="select" id="ffVest"><option value="">—</option>${VESTIMENTAS.map(v => `<option ${f?.vestimenta === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <div class="form-section-title">Contato</div>
                <div class="form-row" style="margin-bottom:0">
                    <div class="field" style="margin-bottom:0"><label>Telefone</label><input class="input" id="ffFone" inputmode="numeric" placeholder="(00) 00000-0000" value="${escapeHtml(f?.telefone || '')}"></div>
                    <div class="field" style="margin-bottom:0"><label>E-mail</label><input class="input" id="ffEmail" type="email" placeholder="nome@empresa.com" value="${escapeHtml(f?.email || '')}"></div>
                </div>
            </div>

            <div class="form-section" ${can('ver_financeiro') ? '' : 'style="margin-bottom:0"'}>
                <div class="form-section-title">Contrato</div>
                <div class="form-row">
                    <div class="field"><label>Cargo <span class="req">*</span></label>
                        <select class="select" id="ffCargo">${funcState.cargos.map(c => `<option value="${c.id}" ${f?.cargoId === c.id ? 'selected' : ''}>${escapeHtml(c.nome)}</option>`).join('')}</select>
                    </div>
                    <div class="field"><label>Unidade <span class="req">*</span></label>
                        <select class="select" id="ffUnidade">${funcState.unidades.map(u => `<option value="${u.id}" ${f?.unidadeId === u.id ? 'selected' : ''}>${escapeHtml(u.nome)}</option>`).join('')}</select>
                    </div>
                </div>
                <div class="form-row"${isEdit && f.demissao ? '' : ' style="margin-bottom:0"'}>
                    <div class="field" style="margin-bottom:0"><label>Data de admissão <span class="req">*</span></label><input class="input" id="ffAdm" type="date" max="${hoje()}" value="${f?.admissao || ''}"></div>
                    <div class="field" style="margin-bottom:0"><label>Jornada mensal (horas)</label>
                        <input class="input" id="ffJornada" type="number" min="1" max="744" step="1" placeholder="${JORNADA_MENSAL_PADRAO}" value="${f?.jornadaMensal ?? ''}">
                        <div class="field-hint">Divisor do valor-hora no cálculo de hora extra. Vazio = ${JORNADA_MENSAL_PADRAO}h (44h semanais). Jornada de 40h/semana usa 200.</div>
                    </div>
                </div>
                ${isEdit && f.demissao ? `
                <div class="form-row" style="margin-bottom:0">
                    <div class="field" style="margin-bottom:0"><label>Data de demissão</label>
                        <input class="input" id="ffDem" type="date" value="${f.demissao}">
                        <div class="field-hint">Registrada pelo lançamento de demissão. Ajuste apenas para correção.</div>
                    </div>
                    <div></div>
                </div>` : ''}
            </div>

            ${can('ver_financeiro') ? `
            <div class="form-section" style="margin-bottom:0">
                <div class="form-section-title">Financeiro</div>
                <div class="field" style="margin-bottom:0"><label>Salário individual (R$)</label>
                    <input class="input" id="ffSalario" type="number" min="0" step="0.01" placeholder="Base do cargo" value="${f?.salario ?? ''}">
                    <div class="field-hint">Deixe vazio para usar o salário base do cargo. Promoções e ajustes atualizam este valor.</div>
                </div>
            </div>` : ''}`,
        footer: ''
    });

    const foneInput = m.body.querySelector('#ffFone');
    foneInput.addEventListener('input', () => foneInput.value = maskFone(foneInput.value));

    m.footer.innerHTML = `
        ${isEdit && can('editar_funcionarios') ? `<button class="btn btn-ghost" data-delete style="margin-right:auto;color:var(--danger)">${icon('trash')} Excluir</button>` : ''}
        <button class="btn btn-secondary" data-cancel>Cancelar</button>
        <button class="btn btn-primary" data-save>${isEdit ? 'Salvar' : 'Cadastrar'}</button>`;
    m.footer.querySelector('[data-cancel]').onclick = m.close;

    const btnDel = m.footer.querySelector('[data-delete]');
    if (btnDel) btnDel.onclick = async () => {
        const [aus, dem, tre, pro, trf] = await Promise.all([
            DB.getAll(PATHS.ausencias), DB.getAll(PATHS.demissoes),
            DB.getAll(PATHS.treinamentos), DB.getAll(PATHS.promocoes), DB.getAll(PATHS.transferencias)
        ]);
        const temLanc = aus.some(x => x.funcionarioId === f.id) || dem.some(x => x.funcionarioId === f.id) ||
            pro.some(x => x.funcionarioId === f.id) || trf.some(x => x.funcionarioId === f.id) ||
            tre.some(x => (x.participantes || []).includes(f.id));
        if (temLanc) return toast('Funcionário possui lançamentos e não pode ser excluído. Use o desligamento.', 'error');
        if (await confirmDialog({ title: 'Excluir funcionário', message: `Excluir <strong>${escapeHtml(f.nome)}</strong> permanentemente? Documentos e anexos também serão excluídos. Prefira registrar demissão para manter o histórico.`, confirmText: 'Excluir', danger: true })) {
            for (const doc of (f.documentos || [])) await excluirAnexoRemoto(doc.anexo);
            await DB.remove(PATHS.funcionarios, f.id);
            funcState.funcionarios = funcState.funcionarios.filter(x => x.id !== f.id);
            toast('Funcionário excluído.');
            m.close();
            renderFuncGrid();
        }
    };

    m.footer.querySelector('[data-save]').onclick = async () => {
        const nome = m.body.querySelector('#ffNome').value.trim();
        const nascimento = m.body.querySelector('#ffNasc').value;
        const admissao = m.body.querySelector('#ffAdm').value;
        if (!nome || !nascimento || !admissao) return toast('Preencha nome, nascimento e admissão.', 'error');
        if (nascimento >= admissao) return toast('Data de nascimento deve ser anterior à admissão.', 'error');
        // Barra o defeito na entrada: admissão futura zera a base de tempo de casa, férias
        // e experiência. Corrigir aqui é mais barato do que sinalizar em toda tela derivada.
        if (admissao > hoje()) return toast('Data de admissão não pode ser futura.', 'error');

        // Jornada zero dividiria o salário por zero no valor-hora. Vazio é legítimo (usa o
        // padrão); zero não é — barrar aqui evita um Infinity chegando à folha.
        const jornadaRaw = m.body.querySelector('#ffJornada').value;
        const jornada = jornadaRaw === '' ? null : Number(jornadaRaw);
        if (jornada !== null && !(jornada >= 1 && jornada <= 744))
            return toast('Jornada mensal deve ficar entre 1 e 744 horas (o máximo de horas de um mês).', 'error');

        const data = {
            nome,
            sexo: m.body.querySelector('#ffSexo').value,
            nascimento,
            escolaridade: m.body.querySelector('#ffEsc').value,
            cargoId: m.body.querySelector('#ffCargo').value,
            unidadeId: m.body.querySelector('#ffUnidade').value,
            telefone: foneInput.value.trim(),
            email: m.body.querySelector('#ffEmail').value.trim(),
            vestimenta: m.body.querySelector('#ffVest').value,
            admissao,
            jornadaMensal: jornada
        };
        const demInput = m.body.querySelector('#ffDem');
        if (demInput) data.demissao = demInput.value || null;
        const salInput = m.body.querySelector('#ffSalario');
        if (salInput) data.salario = salInput.value === '' ? null : Number(salInput.value);

        const id = await DB.save(PATHS.funcionarios, f?.id || null, data);
        if (isEdit) Object.assign(funcState.funcionarios.find(x => x.id === f.id), data);
        else funcState.funcionarios.push({ id, ...data, beneficios: [] });

        toast(isEdit ? 'Ficha atualizada.' : 'Funcionário cadastrado.');
        m.close();
        renderFuncGrid();
    };
}
