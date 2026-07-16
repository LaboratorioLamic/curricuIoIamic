// ===== Configurações (somente admin): Usuários, Cargos, Unidades, Benefícios, Parâmetros =====

const TIPOS_CARGO = ['Operacional', 'Administrativo', 'Gestão', 'Estágio', 'Diretoria'];
const TIPOS_BENEFICIO = ['Plano de saúde', 'Plano odontológico', 'Vale alimentação', 'Vale refeição', 'Vale transporte', 'Seguro de vida', 'Educação', 'Outro'];

const CFG_TABS = [
    { id: 'usuarios', label: 'Usuários' },
    { id: 'cargos', label: 'Cargos' },
    { id: 'unidades', label: 'Unidades' },
    { id: 'beneficios', label: 'Benefícios' },
    { id: 'parametros', label: 'Parâmetros' }
];
let cfgTab = 'usuarios';

registerPage({
    id: 'config',
    title: 'Configurações',
    icon: 'settings',
    order: 6,
    adminOnly: true,
    render(el) {
        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Configurações</h2>
                    <div class="page-sub">Dados mestres do sistema — alimentam todos os módulos e KPIs.</div>
                </div>
            </div>
            <div class="tabs" id="cfgTabs">
                ${CFG_TABS.map(t => `<div class="tab${t.id === cfgTab ? ' active' : ''}" data-tab="${t.id}">${t.label}</div>`).join('')}
            </div>
            <div class="mt-16" id="cfgContent"></div>`;

        el.querySelectorAll('#cfgTabs .tab').forEach(tab => {
            tab.onclick = () => {
                cfgTab = tab.dataset.tab;
                el.querySelectorAll('#cfgTabs .tab').forEach(t => t.classList.toggle('active', t === tab));
                renderCfgTab();
            };
        });
        renderCfgTab();
    }
});

function cfgLoading() {
    document.getElementById('cfgContent').innerHTML =
        '<div class="loading-center"><div class="spinner-dark"></div></div>';
}

function renderCfgTab() {
    cfgLoading();
    ({
        usuarios: renderCfgUsuarios,
        cargos: renderCfgCargos,
        unidades: renderCfgUnidades,
        beneficios: renderCfgBeneficios,
        parametros: renderCfgParametros
    })[cfgTab]().catch(e => {
        console.error(e);
        document.getElementById('cfgContent').innerHTML =
            emptyState({ icon: 'alert', title: 'Erro ao carregar', text: e.message || 'Tente novamente.' });
    });
}

// Toolbar + tabela genérica com busca
function cfgList({ searchPh, btnLabel, thead, rowsHtml, onNew, emptyText }) {
    const cont = document.getElementById('cfgContent');
    cont.innerHTML = `
        <div class="table-wrap">
            <div class="table-toolbar">
                <div class="search-box">${icon('search')}<input class="input" id="cfgSearch" placeholder="${searchPh}"></div>
                <div class="grow"></div>
                <button class="btn btn-primary" id="cfgNew">${icon('plus')} ${btnLabel}</button>
            </div>
            <div class="table-scroll">
                <table class="table">
                    <thead><tr>${thead}</tr></thead>
                    <tbody id="cfgTbody">${rowsHtml || ''}</tbody>
                </table>
            </div>
        </div>`;
    if (!rowsHtml) {
        document.getElementById('cfgTbody').innerHTML =
            `<tr><td colspan="10"><div class="table-empty">${icon('search')}<span>${emptyText}</span></div></td></tr>`;
    }
    document.getElementById('cfgNew').onclick = onNew;
    document.getElementById('cfgSearch').addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('#cfgTbody tr[data-search]').forEach(tr =>
            tr.style.display = tr.dataset.search.includes(q) ? '' : 'none');
    });
}

function cfgRowActions(tr, items) {
    const btn = tr.querySelector('.btn-icon[data-menu]');
    if (btn) btn.onclick = e => { e.stopPropagation(); openPopover(btn, items); };
}

// ============ USUÁRIOS ============
async function renderCfgUsuarios() {
    const usuarios = (await DB.getAll(PATHS.usuarios)).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    cfgList({
        searchPh: 'Buscar usuário...',
        btnLabel: 'Novo usuário',
        emptyText: 'Nenhum usuário cadastrado.',
        thead: '<th>Usuário</th><th>Login</th><th>CPF</th><th>Perfil</th><th>Status</th><th style="width:48px"></th>',
        rowsHtml: usuarios.map(u => `
            <tr data-id="${u.id}" data-search="${escapeHtml((u.nome + ' ' + u.login).toLowerCase())}">
                <td><div class="flex"><div class="avatar">${iniciais(u.nome)}</div><strong>${escapeHtml(u.nome)}</strong></div></td>
                <td class="text-2">${escapeHtml(u.login)}</td>
                <td class="text-2">${escapeHtml(u.cpf || '—')}</td>
                <td>${u.admin ? '<span class="badge badge-accent">Administrador</span>' : '<span class="badge badge-neutral">Usuário</span>'}</td>
                <td>${u.ativo !== false ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-danger">Inativo</span>'}</td>
                <td><button class="btn-icon" data-menu>${icon('dots')}</button></td>
            </tr>`).join(''),
        onNew: () => formUsuario(null, usuarios)
    });

    document.querySelectorAll('#cfgTbody tr[data-id]').forEach(tr => {
        const u = usuarios.find(x => x.id === tr.dataset.id);
        cfgRowActions(tr, [
            { label: 'Editar', icon: 'edit', onClick: () => formUsuario(u, usuarios) },
            'sep',
            {
                label: 'Excluir', icon: 'trash', danger: true, onClick: async () => {
                    if (u.id === currentUser.id) return toast('Você não pode excluir o próprio usuário.', 'error');
                    const admins = usuarios.filter(x => x.admin && x.ativo !== false);
                    if (u.admin && admins.length <= 1) return toast('Não é possível excluir o único administrador ativo.', 'error');
                    if (await confirmDialog({ title: 'Excluir usuário', message: `Excluir <strong>${escapeHtml(u.nome)}</strong>? Esta ação não pode ser desfeita.`, confirmText: 'Excluir', danger: true })) {
                        await DB.remove(PATHS.usuarios, u.id);
                        toast('Usuário excluído.');
                        renderCfgTab();
                    }
                }
            }
        ]);
    });
}

function formUsuario(u, usuarios) {
    const isEdit = !!u;
    const grupos = [...new Set(PERMISSOES.map(p => p.grupo))];
    const m = openModal({
        title: isEdit ? 'Editar usuário' : 'Novo usuário',
        size: 'modal-lg',
        body: `
            <div class="form-section">
                <div class="form-section-title">Identificação</div>
                <div class="field"><label>Nome completo <span class="req">*</span></label><input class="input" id="fuNome" placeholder="Ex: Maria Silva" value="${escapeHtml(u?.nome || '')}"></div>
                <div class="form-row" style="margin-bottom:0">
                    <div class="field" style="margin-bottom:0"><label>Login <span class="req">*</span></label><input class="input" id="fuLogin" placeholder="Ex: maria.silva" value="${escapeHtml(u?.login || '')}"></div>
                    <div class="field" style="margin-bottom:0"><label>CPF</label><input class="input" id="fuCpf" inputmode="numeric" placeholder="000.000.000-00" value="${escapeHtml(u?.cpf || '')}"></div>
                </div>
            </div>

            <div class="form-section">
                <div class="form-section-title">Senha</div>
                <div class="form-row" style="margin-bottom:0">
                    <div class="field" style="margin-bottom:0"><label>Senha ${isEdit ? '' : '<span class="req">*</span>'}</label><input class="input" id="fuPwd" type="password" autocomplete="new-password" placeholder="${isEdit ? 'Manter atual' : 'Mínimo 6 caracteres'}"></div>
                    <div class="field" style="margin-bottom:0"><label>Confirmar senha</label><input class="input" id="fuPwd2" type="password" autocomplete="new-password" placeholder="Repita a senha"></div>
                </div>
            </div>

            <div class="form-section">
                <div class="form-section-title">Acesso</div>
                <div class="toggle-cards">
                    <label class="toggle-card">
                        <div class="grow"><strong>Ativo</strong><span>Pode entrar no sistema</span></div>
                        <span class="switch"><input type="checkbox" id="fuAtivo" ${u?.ativo !== false ? 'checked' : ''}><span class="track"></span></span>
                    </label>
                    <label class="toggle-card">
                        <div class="grow"><strong>Administrador</strong><span>Acesso total ao sistema</span></div>
                        <span class="switch"><input type="checkbox" id="fuAdmin" ${u?.admin ? 'checked' : ''}><span class="track"></span></span>
                    </label>
                </div>
            </div>

            <div class="form-section" id="fuPermsWrap" style="margin-bottom:0">
                <div class="form-section-title">Permissões</div>
                <div class="perm-groups">
                    ${grupos.map(g => `
                        <div class="perm-group">
                            <div class="perm-group-title">${g}</div>
                            ${PERMISSOES.filter(p => p.grupo === g).map(p => `
                                <label class="perm-check"><input type="checkbox" data-perm="${p.key}" ${u?.perms?.[p.key] ? 'checked' : ''}> ${p.label}</label>`).join('')}
                        </div>`).join('')}
                </div>
                <div class="field-hint" style="margin-top:10px">Administradores possuem acesso total — as permissões acima são ignoradas.</div>
            </div>`,
        footer: ''
    });

    const cpfInput = m.body.querySelector('#fuCpf');
    cpfInput.addEventListener('input', () => cpfInput.value = maskCPF(cpfInput.value));

    const adminChk = m.body.querySelector('#fuAdmin');
    const permsWrap = m.body.querySelector('#fuPermsWrap');
    const syncPerms = () => permsWrap.style.opacity = adminChk.checked ? '.45' : '1';
    adminChk.onchange = syncPerms;
    syncPerms();

    m.footer.innerHTML = `
        <button class="btn btn-secondary" data-cancel>Cancelar</button>
        <button class="btn btn-primary" data-save>${isEdit ? 'Salvar' : 'Criar usuário'}</button>`;
    m.footer.querySelector('[data-cancel]').onclick = m.close;
    m.footer.querySelector('[data-save]').onclick = async () => {
        const nome = m.body.querySelector('#fuNome').value.trim();
        const login = m.body.querySelector('#fuLogin').value.trim();
        const cpf = cpfInput.value.trim();
        const pwd = m.body.querySelector('#fuPwd').value;
        const pwd2 = m.body.querySelector('#fuPwd2').value;
        const admin = adminChk.checked;
        const ativo = m.body.querySelector('#fuAtivo').checked;

        if (!nome || !login) return toast('Preencha nome e login.', 'error');
        if (usuarios.some(x => x.id !== u?.id && (x.login || '').toLowerCase() === login.toLowerCase())) return toast('Este login já está em uso.', 'error');
        if (cpf && !validaCPF(cpf)) return toast('CPF inválido.', 'error');
        if (!isEdit && pwd.length < 6) return toast('A senha deve ter no mínimo 6 caracteres.', 'error');
        if (pwd && pwd.length < 6) return toast('A senha deve ter no mínimo 6 caracteres.', 'error');
        if (pwd !== pwd2) return toast('As senhas não conferem.', 'error');

        // Proteção: não deixar o sistema sem administrador ativo
        if (isEdit && u.admin && (!admin || !ativo)) {
            const admins = usuarios.filter(x => x.admin && x.ativo !== false && x.id !== u.id);
            if (admins.length === 0) return toast('O sistema precisa de ao menos um administrador ativo.', 'error');
        }

        const perms = {};
        m.body.querySelectorAll('[data-perm]').forEach(c => perms[c.dataset.perm] = c.checked);

        const data = { nome, login, cpf, admin, ativo, perms };
        if (pwd) data.senhaHash = await sha256(pwd);
        if (!isEdit) data.criadoEm = hoje();

        await DB.save(PATHS.usuarios, u?.id || null, data);

        // Editou a si mesmo → atualiza sessão e sidebar
        if (isEdit && u.id === currentUser.id) {
            setSession({ ...currentUser, nome, login, admin, perms });
            renderSidebar();
        }
        toast(isEdit ? 'Usuário atualizado.' : 'Usuário criado.');
        m.close();
        renderCfgTab();
    };
}

// ============ CARGOS ============
async function renderCfgCargos() {
    const cargos = (await DB.getAll(PATHS.cargos)).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    cfgList({
        searchPh: 'Buscar cargo...',
        btnLabel: 'Novo cargo',
        emptyText: 'Nenhum cargo cadastrado.',
        thead: '<th>Cargo</th><th>Tipo</th><th class="num">Salário base</th><th class="num">Insalubridade</th><th class="num" title="Periodicidade do exame periódico (NR-7)">ASO</th><th style="width:48px"></th>',
        rowsHtml: cargos.map(c => `
            <tr data-id="${c.id}" data-search="${escapeHtml((c.nome + ' ' + c.tipo).toLowerCase())}">
                <td><strong>${escapeHtml(c.nome)}</strong></td>
                <td><span class="badge badge-accent">${escapeHtml(c.tipo || '—')}</span></td>
                <td class="num">${fmtBRL(c.salario)}</td>
                <td class="num">${c.insalubridade ? `<span class="badge badge-warning">${c.insalubridade}%</span>` : '—'}</td>
                <td class="num text-2">${asoPeriodicidadeDe(c)} meses</td>
                <td><button class="btn-icon" data-menu>${icon('dots')}</button></td>
            </tr>`).join(''),
        onNew: () => formCargo(null)
    });

    document.querySelectorAll('#cfgTbody tr[data-id]').forEach(tr => {
        const c = cargos.find(x => x.id === tr.dataset.id);
        cfgRowActions(tr, [
            { label: 'Editar', icon: 'edit', onClick: () => formCargo(c) },
            'sep',
            {
                label: 'Excluir', icon: 'trash', danger: true, onClick: async () => {
                    const funcs = await DB.getAll(PATHS.funcionarios);
                    const emUso = funcs.filter(f => f.cargoId === c.id).length;
                    if (emUso) return toast(`Não é possível excluir: ${emUso} funcionário(s) neste cargo.`, 'error');
                    if (await confirmDialog({ title: 'Excluir cargo', message: `Excluir o cargo <strong>${escapeHtml(c.nome)}</strong>?`, confirmText: 'Excluir', danger: true })) {
                        await DB.remove(PATHS.cargos, c.id);
                        toast('Cargo excluído.');
                        renderCfgTab();
                    }
                }
            }
        ]);
    });
}

function formCargo(c) {
    const isEdit = !!c;
    const m = openModal({
        title: isEdit ? 'Editar cargo' : 'Novo cargo',
        body: `
            <div class="field"><label>Nome do cargo <span class="req">*</span></label><input class="input" id="fcNome" placeholder="Ex: Analista de Sistemas" value="${escapeHtml(c?.nome || '')}"></div>
            <div class="form-row">
                <div class="field"><label>Tipo de cargo <span class="req">*</span></label>
                    <select class="select" id="fcTipo">${TIPOS_CARGO.map(t => `<option ${c?.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
                </div>
                <div class="field"><label>Salário base (R$) <span class="req">*</span></label><input class="input" id="fcSalario" type="number" min="0" step="0.01" value="${c?.salario ?? ''}">
                    <div class="field-hint">Usado como sugestão na folha de pagamento</div>
                </div>
            </div>
            <div class="form-row">
                <div class="field"><label>Grau de insalubridade</label>
                    <select class="select" id="fcInsal">
                        ${[[0, 'Nenhum'], [10, 'Mínimo — 10%'], [20, 'Médio — 20%'], [40, 'Máximo — 40%']].map(([v, l]) =>
                            `<option value="${v}" ${(c?.insalubridade || 0) === v ? 'selected' : ''}>${l}</option>`).join('')}
                    </select>
                    <div class="field-hint">% sobre o salário mínimo (Parâmetros). Adicional sugerido automaticamente na folha.</div>
                </div>
                <div class="field"><label>Periodicidade do ASO</label>
                    <select class="select" id="fcAsoPer">
                        ${ASO_PERIODICIDADES.map(v =>
                            `<option value="${v}" ${asoPeriodicidadeDe(c) === v ? 'selected' : ''}>A cada ${v} meses</option>`).join('')}
                    </select>
                    <div class="field-hint">Exame periódico (NR-7/PCMSO). Definida pelo médico do trabalho — independe do grau de insalubridade.</div>
                </div>
            </div>`,
        footer: ''
    });
    m.footer.innerHTML = `
        <button class="btn btn-secondary" data-cancel>Cancelar</button>
        <button class="btn btn-primary" data-save>${isEdit ? 'Salvar' : 'Criar cargo'}</button>`;
    m.footer.querySelector('[data-cancel]').onclick = m.close;
    m.footer.querySelector('[data-save]').onclick = async () => {
        const nome = m.body.querySelector('#fcNome').value.trim();
        const tipo = m.body.querySelector('#fcTipo').value;
        const salario = Number(m.body.querySelector('#fcSalario').value);
        if (!nome) return toast('Informe o nome do cargo.', 'error');
        if (!(salario >= 0)) return toast('Informe o salário base.', 'error');
        await DB.save(PATHS.cargos, c?.id || null, {
            nome, tipo, salario,
            insalubridade: Number(m.body.querySelector('#fcInsal').value) || 0,
            asoPeriodicidadeMeses: Number(m.body.querySelector('#fcAsoPer').value) || ASO_PERIODICIDADE_PADRAO
        });
        toast(isEdit ? 'Cargo atualizado.' : 'Cargo criado.');
        m.close();
        renderCfgTab();
    };
}

// ============ UNIDADES ============

// Diagnóstico de equipe incompleta por unidade.
// Nova regra: compara ativos POR CARGO vs. quantidade recomendada (só cargos adicionados).
// Fallback legado: se não há recomendação por cargo mas existe headcount antigo, compara o total.
// Retorna null quando a unidade está completa (ou sem meta).
function diagnosticoUnidade(un, funcionarios) {
    const ativos = funcionarios.filter(f => f.unidadeId === un.id && !f.demissao);
    const recs = un.recomendados || [];
    if (recs.length) {
        const faltasPorCargo = recs.map(r => {
            const noCargo = ativos.filter(f => f.cargoId === r.cargoId).length;
            const faltam = Math.max(0, (Number(r.qtd) || 0) - noCargo);
            return { cargoId: r.cargoId, meta: Number(r.qtd) || 0, ativos: noCargo, faltam };
        });
        const faltamTotal = faltasPorCargo.reduce((s, c) => s + c.faltam, 0);
        const metaTotal = recs.reduce((s, r) => s + (Number(r.qtd) || 0), 0);
        if (faltamTotal === 0) return null;
        return { nome: un.nome, modo: 'cargo', faltam: faltamTotal, meta: metaTotal, ativos: ativos.length, cargos: faltasPorCargo.filter(c => c.faltam > 0) };
    }
    // Fallback legado (headcount único por unidade)
    if (un.headcount && ativos.length < un.headcount) {
        return { nome: un.nome, modo: 'total', faltam: un.headcount - ativos.length, meta: un.headcount, ativos: ativos.length, cargos: [] };
    }
    return null;
}

// Diagnóstico de COBERTURA: quem está de férias continua ativo (contrato vigente, salário,
// encargos) e por isso NÃO entra em diagnosticoUnidade() — abrir vaga porque alguém saiu
// de férias seria erro. Mas operacionalmente a pessoa não está lá. Este cálculo é separado:
// gera alerta de escala/cobertura, não de contratação, e some sozinho quando a pessoa volta.
// Retorna null quando a presença cobre a meta de todos os cargos.
function diagnosticoCobertura(un, funcionarios, ausencias, ref) {
    const recs = un.recomendados || [];
    if (!recs.length) return null;                       // sem meta por cargo, sem cobertura a medir
    const ativos = funcionarios.filter(f => f.unidadeId === un.id && !f.demissao);
    const deFerias = ativos.filter(f => feriasVigente(f.id, ausencias, ref));
    if (!deFerias.length) return null;

    const idsFerias = new Set(deFerias.map(f => f.id));
    const cargos = recs.map(r => {
        const noCargo = ativos.filter(f => f.cargoId === r.cargoId);
        const fora = noCargo.filter(f => idsFerias.has(f.id)).length;
        const presentes = noCargo.length - fora;
        const meta = Number(r.qtd) || 0;
        return { cargoId: r.cargoId, meta, presentes, fora, gap: Math.max(0, meta - presentes) };
    }).filter(c => c.fora > 0 && c.gap > 0);             // só cargo cuja ausência abre buraco real

    if (!cargos.length) return null;
    const retornos = deFerias
        .map(f => ({ nome: f.nome, a: feriasVigente(f.id, ausencias, ref) }))
        .filter(x => x.a)
        .sort((x, y) => x.a.retorno.localeCompare(y.a.retorno));
    return { nome: un.nome, cargos, foraTotal: deFerias.length, retornos };
}

async function renderCfgUnidades() {
    const unidades = (await DB.getAll(PATHS.unidades)).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    const funcs = await DB.getAll(PATHS.funcionarios);
    const ativosPorUnidade = id => funcs.filter(f => f.unidadeId === id && !f.demissao).length;
    const metaDe = un => (un.recomendados || []).reduce((s, r) => s + (Number(r.qtd) || 0), 0) || un.headcount || 0;

    cfgList({
        searchPh: 'Buscar unidade...',
        btnLabel: 'Nova unidade',
        emptyText: 'Nenhuma unidade cadastrada.',
        thead: '<th>Unidade</th><th>CNPJ</th><th>Endereço</th><th class="num">Funcionários</th><th class="num">Quadro recomendado</th><th style="width:48px"></th>',
        rowsHtml: unidades.map(un => {
            const ativos = ativosPorUnidade(un.id);
            const diag = diagnosticoUnidade(un, funcs);
            const meta = metaDe(un);
            const nCargos = (un.recomendados || []).length;
            return `
            <tr data-id="${un.id}" data-search="${escapeHtml((un.nome + ' ' + (un.cnpj || '')).toLowerCase())}">
                <td><div class="flex"><span style="color:var(--accent)">${icon('building')}</span><strong>${escapeHtml(un.nome)}</strong></div></td>
                <td class="text-2">${escapeHtml(un.cnpj || '—')}</td>
                <td class="text-2">${escapeHtml(un.endereco || '—')}</td>
                <td class="num">${diag ? `<span class="badge badge-warning" title="Equipe incompleta: faltam ${diag.faltam}">${fmtNum(ativos)} ⚠</span>` : fmtNum(ativos)}</td>
                <td class="num text-2">${meta ? `${fmtNum(meta)}${nCargos ? ` <span class="muted">· ${nCargos} cargo${nCargos > 1 ? 's' : ''}</span>` : ''}` : '—'}</td>
                <td><button class="btn-icon" data-menu>${icon('dots')}</button></td>
            </tr>`;
        }).join(''),
        onNew: () => formUnidade(null)
    });

    document.querySelectorAll('#cfgTbody tr[data-id]').forEach(tr => {
        const un = unidades.find(x => x.id === tr.dataset.id);
        cfgRowActions(tr, [
            { label: 'Editar', icon: 'edit', onClick: () => formUnidade(un) },
            'sep',
            {
                label: 'Excluir', icon: 'trash', danger: true, onClick: async () => {
                    const emUso = funcs.filter(f => f.unidadeId === un.id).length;
                    if (emUso) return toast(`Não é possível excluir: ${emUso} funcionário(s) nesta unidade.`, 'error');
                    if (await confirmDialog({ title: 'Excluir unidade', message: `Excluir a unidade <strong>${escapeHtml(un.nome)}</strong>?`, confirmText: 'Excluir', danger: true })) {
                        await DB.remove(PATHS.unidades, un.id);
                        toast('Unidade excluída.');
                        renderCfgTab();
                    }
                }
            }
        ]);
    });
}

async function formUnidade(un) {
    const isEdit = !!un;
    const cargos = (await DB.getAll(PATHS.cargos)).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    // Estado do editor de recomendação por cargo
    const recs = (un?.recomendados || []).map(r => ({ cargoId: r.cargoId, qtd: Number(r.qtd) || 0 }));

    const m = openModal({
        title: isEdit ? 'Editar unidade' : 'Nova unidade',
        size: 'modal-lg',
        body: `
            <div class="form-section">
                <div class="form-section-title">Identificação</div>
                <div class="field"><label>Nome da unidade <span class="req">*</span></label><input class="input" id="fnNome" placeholder="Ex: Matriz — São Paulo" value="${escapeHtml(un?.nome || '')}"></div>
                <div class="field" style="margin-bottom:0"><label>Endereço</label><input class="input" id="fnEnd" placeholder="Rua, número, bairro, cidade" value="${escapeHtml(un?.endereco || '')}"></div>
            </div>
            <div class="form-section">
                <div class="form-section-title">Dados fiscais</div>
                <div class="field" style="margin-bottom:0;max-width:280px"><label>CNPJ</label><input class="input" id="fnCnpj" inputmode="numeric" placeholder="00.000.000/0000-00" value="${escapeHtml(un?.cnpj || '')}"></div>
            </div>
            <div class="form-section" style="margin-bottom:0">
                <div class="form-section-title">Quadro recomendado por cargo</div>
                <div class="field-hint" style="margin:-4px 0 12px">Defina quantos funcionários cada cargo deve ter nesta unidade. Só os cargos adicionados geram alerta de equipe incompleta no Dashboard.</div>
                <div id="fnRecList"></div>
                <div class="rec-add">
                    <select class="select" id="fnRecCargo"></select>
                    <input class="input" id="fnRecQtd" type="number" min="1" step="1" placeholder="Qtd" style="width:90px">
                    <button type="button" class="btn btn-secondary btn-sm" id="fnRecAdd">${icon('plus')} Adicionar</button>
                </div>
                ${!cargos.length ? '<div class="field-hint" style="margin-top:8px;color:var(--warning)">Cadastre cargos primeiro para definir o quadro recomendado.</div>' : ''}
            </div>`,
        footer: ''
    });
    const cnpjInput = m.body.querySelector('#fnCnpj');
    cnpjInput.addEventListener('input', () => cnpjInput.value = maskCNPJ(cnpjInput.value));

    const cargoNome = id => cargos.find(c => c.id === id)?.nome || '(cargo removido)';
    const recList = m.body.querySelector('#fnRecList');
    const recCargoSel = m.body.querySelector('#fnRecCargo');
    const recQtd = m.body.querySelector('#fnRecQtd');

    const renderRecs = () => {
        recList.innerHTML = recs.length ? recs.map((r, i) => `
            <div class="rec-item">
                <span class="rec-nome">${icon('briefcase')} ${escapeHtml(cargoNome(r.cargoId))}</span>
                <span class="rec-qtd">${fmtNum(r.qtd)} recomendado${r.qtd > 1 ? 's' : ''}</span>
                <button type="button" class="btn-icon danger" data-rec-del="${i}" title="Remover">${icon('trash')}</button>
            </div>`).join('')
            : '<div class="rec-empty">Nenhum cargo definido. A unidade não gera alerta de equipe incompleta.</div>';
        // Opções de cargo ainda não adicionados
        const usados = new Set(recs.map(r => r.cargoId));
        const disp = cargos.filter(c => !usados.has(c.id));
        recCargoSel.innerHTML = disp.length
            ? disp.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('')
            : '<option value="">Todos os cargos já adicionados</option>';
        recCargoSel.disabled = !disp.length;
        recList.querySelectorAll('[data-rec-del]').forEach(b =>
            b.onclick = () => { recs.splice(Number(b.dataset.recDel), 1); renderRecs(); });
    };
    m.body.querySelector('#fnRecAdd').onclick = () => {
        const cargoId = recCargoSel.value;
        const qtd = Number(recQtd.value);
        if (!cargoId) return toast('Selecione um cargo.', 'error');
        if (!(qtd > 0)) return toast('Informe uma quantidade maior que zero.', 'error');
        recs.push({ cargoId, qtd });
        recQtd.value = '';
        renderRecs();
    };
    renderRecs();

    m.footer.innerHTML = `
        <button class="btn btn-secondary" data-cancel>Cancelar</button>
        <button class="btn btn-primary" data-save>${isEdit ? 'Salvar' : 'Criar unidade'}</button>`;
    m.footer.querySelector('[data-cancel]').onclick = m.close;
    m.footer.querySelector('[data-save]').onclick = async () => {
        const nome = m.body.querySelector('#fnNome').value.trim();
        const cnpj = cnpjInput.value.trim();
        if (!nome) return toast('Informe o nome da unidade.', 'error');
        if (cnpj && cnpj.replace(/\D/g, '').length !== 14) return toast('CNPJ incompleto.', 'error');
        await DB.save(PATHS.unidades, un?.id || null, {
            nome,
            endereco: m.body.querySelector('#fnEnd').value.trim(),
            cnpj,
            recomendados: recs,
            // Zera o headcount legado quando há recomendação por cargo (evita alerta duplicado)
            headcount: recs.length ? null : (un?.headcount ?? null)
        });
        toast(isEdit ? 'Unidade atualizada.' : 'Unidade criada.');
        m.close();
        renderCfgTab();
    };
}

// ============ BENEFÍCIOS ============
async function renderCfgBeneficios() {
    const beneficios = (await DB.getAll(PATHS.beneficios)).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    cfgList({
        searchPh: 'Buscar benefício...',
        btnLabel: 'Novo benefício',
        emptyText: 'Nenhum benefício cadastrado.',
        thead: '<th>Benefício</th><th>Tipo</th><th class="num">Custo titular</th><th class="num">Custo por dependente</th><th class="num">% funcionário</th><th style="width:48px"></th>',
        rowsHtml: beneficios.map(b => `
            <tr data-id="${b.id}" data-search="${escapeHtml((b.nome + ' ' + (b.tipo || '')).toLowerCase())}">
                <td><div class="flex"><span style="color:var(--accent)">${icon('gift')}</span><strong>${escapeHtml(b.nome)}</strong></div></td>
                <td><span class="badge badge-info">${escapeHtml(b.tipo || '—')}</span></td>
                <td class="num">${fmtBRL(b.custoTitular)}</td>
                <td class="num">${b.custoDependente ? fmtBRL(b.custoDependente) : '—'}</td>
                <td class="num">${b.descontoPct ? `<span class="badge badge-warning">${b.descontoPct}%</span>` : '<span class="badge badge-success">Empresa 100%</span>'}</td>
                <td><button class="btn-icon" data-menu>${icon('dots')}</button></td>
            </tr>`).join(''),
        onNew: () => formBeneficio(null)
    });

    document.querySelectorAll('#cfgTbody tr[data-id]').forEach(tr => {
        const b = beneficios.find(x => x.id === tr.dataset.id);
        cfgRowActions(tr, [
            { label: 'Editar', icon: 'edit', onClick: () => formBeneficio(b) },
            'sep',
            {
                label: 'Excluir', icon: 'trash', danger: true, onClick: async () => {
                    const funcs = await DB.getAll(PATHS.funcionarios);
                    const emUso = funcs.filter(f => (f.beneficios || []).some(fb => fb.beneficioId === b.id)).length;
                    if (emUso) return toast(`Não é possível excluir: ${emUso} funcionário(s) com este benefício.`, 'error');
                    if (await confirmDialog({ title: 'Excluir benefício', message: `Excluir <strong>${escapeHtml(b.nome)}</strong>?`, confirmText: 'Excluir', danger: true })) {
                        await DB.remove(PATHS.beneficios, b.id);
                        toast('Benefício excluído.');
                        renderCfgTab();
                    }
                }
            }
        ]);
    });
}

function formBeneficio(b) {
    const isEdit = !!b;
    const m = openModal({
        title: isEdit ? 'Editar benefício' : 'Novo benefício',
        body: `
            <div class="form-row">
                <div class="field"><label>Nome do benefício <span class="req">*</span></label><input class="input" id="fbNome" placeholder="Ex: Unimed Nacional" value="${escapeHtml(b?.nome || '')}"></div>
                <div class="field"><label>Tipo <span class="req">*</span></label>
                    <select class="select" id="fbTipo">${TIPOS_BENEFICIO.map(t => `<option ${b?.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
                </div>
            </div>
            <div class="form-row">
                <div class="field"><label>Custo mensal do titular (R$) <span class="req">*</span></label><input class="input" id="fbCT" type="number" min="0" step="0.01" value="${b?.custoTitular ?? ''}"></div>
                <div class="field"><label>Custo mensal por dependente (R$)</label><input class="input" id="fbCD" type="number" min="0" step="0.01" value="${b?.custoDependente ?? ''}">
                    <div class="field-hint">Deixe vazio se não permite dependentes</div>
                </div>
            </div>
            <div class="form-row">
                <div class="field"><label>Coparticipação do funcionário (%)</label>
                    <input class="input" id="fbDesc" type="number" min="0" max="100" step="1" value="${b?.descontoPct ?? 0}">
                    <div class="field-hint">% do custo descontado do funcionário em folha. 0 = empresa paga tudo; 100 = funcionário paga tudo.</div>
                </div>
                <div></div>
            </div>`,
        footer: ''
    });
    m.footer.innerHTML = `
        <button class="btn btn-secondary" data-cancel>Cancelar</button>
        <button class="btn btn-primary" data-save>${isEdit ? 'Salvar' : 'Criar benefício'}</button>`;
    m.footer.querySelector('[data-cancel]').onclick = m.close;
    m.footer.querySelector('[data-save]').onclick = async () => {
        const nome = m.body.querySelector('#fbNome').value.trim();
        const custoTitular = Number(m.body.querySelector('#fbCT').value);
        if (!nome) return toast('Informe o nome do benefício.', 'error');
        if (!(custoTitular >= 0)) return toast('Informe o custo do titular.', 'error');
        const descontoPct = Math.min(100, Math.max(0, Number(m.body.querySelector('#fbDesc').value) || 0));
        await DB.save(PATHS.beneficios, b?.id || null, {
            nome,
            tipo: m.body.querySelector('#fbTipo').value,
            custoTitular,
            custoDependente: Number(m.body.querySelector('#fbCD').value) || 0,
            descontoPct
        });
        toast(isEdit ? 'Benefício atualizado.' : 'Benefício criado.');
        m.close();
        renderCfgTab();
    };
}

// ============ PARÂMETROS ============
async function renderCfgParametros() {
    const params = (await DB.getObj(PATHS.parametros)) || {};
    const cont = document.getElementById('cfgContent');
    cont.innerHTML = `
        <div class="card" style="max-width:560px">
            <div class="card-title">Parâmetros do sistema</div>
            <div class="card-sub" style="margin-bottom:18px">Valores padrão usados nos cálculos automáticos.</div>
            <div class="form-row">
                <div class="field">
                    <label>% padrão de encargos sobre salário</label>
                    <input class="input" id="fpEncargos" type="number" min="0" max="100" step="0.1" value="${params.encargosPct ?? 28}">
                    <div class="field-hint">Sugerido automaticamente na folha (editável por lançamento). Ex: INSS + FGTS ≈ 28%</div>
                </div>
                <div class="field">
                    <label>Dias do período de experiência</label>
                    <input class="input" id="fpExp" type="number" min="1" step="1" value="${params.diasExperiencia ?? 90}">
                    <div class="field-hint">Usado no índice de aprovação após experiência (padrão CLT: 90)</div>
                </div>
            </div>
            <div class="form-row">
                <div class="field">
                    <label>Base de cálculo da insalubridade</label>
                    <select class="select" id="fpInsalBase">
                        <option value="salario" ${(params.insalubridadeBase || 'salario') === 'salario' ? 'selected' : ''}>Salário do funcionário</option>
                        <option value="minimo" ${params.insalubridadeBase === 'minimo' ? 'selected' : ''}>Salário mínimo (padrão legal STF)</option>
                    </select>
                    <div class="field-hint">Grau (10/20/40%) definido no cargo × esta base</div>
                </div>
                <div class="field">
                    <label>Salário mínimo vigente (R$)</label>
                    <input class="input" id="fpSalMin" type="number" min="0" step="0.01" value="${params.salarioMinimo ?? ''}">
                    <div class="field-hint">Usado quando a base for "Salário mínimo". Atualize quando o mínimo mudar.</div>
                </div>
                <div class="field" style="margin-bottom:0">
                    <label>Alerta de prazo legal de férias (dias)</label>
                    <input class="input" id="fpFeriasAlerta" type="number" min="1" max="365" step="1" value="${params.feriasAlertaLegalDias ?? 60}">
                    <div class="field-hint">
                        Antecedência do alerta <strong>crítico</strong> antes do fim do período concessivo — o prazo que gera
                        pagamento em dobro (art. 137 CLT). O aviso da <strong>data prevista</strong> usa metade deste valor.
                    </div>
                </div>
                <div class="field" style="margin-bottom:0">
                    <label>Alerta de vencimento do ASO (dias)</label>
                    <input class="input" id="fpAsoAlerta" type="number" min="1" max="365" step="1" value="${params.asoAlertaDias ?? ASO_PARAMS_PADRAO.alertaDias}">
                    <div class="field-hint">
                        Antecedência do alerta antes do vencimento do exame periódico. A <strong>periodicidade</strong>
                        (6/12/24 meses) é definida por cargo, no cadastro de Cargos.
                    </div>
                </div>
            </div>
            <button class="btn btn-primary" id="fpSave">${icon('check')} Salvar parâmetros</button>
        </div>

        <div class="card mt-16" style="max-width:560px">
            <div class="card-title">Banco de horas</div>
            <div class="card-sub" style="margin-bottom:18px">Regras do acordo de compensação (CLT art. 59, §2º). O ciclo de cada funcionário começa no primeiro mês de saldo publicado para ele.</div>
            <div class="form-row">
                <div class="field">
                    <label>Duração do ciclo (meses)</label>
                    <select class="select" id="fpBhCiclo">
                        <option value="6" ${(params.bhCicloMeses ?? 6) == 6 ? 'selected' : ''}>6 meses — acordo individual</option>
                        <option value="12" ${params.bhCicloMeses == 12 ? 'selected' : ''}>12 meses — acordo coletivo</option>
                    </select>
                    <div class="field-hint">Prazo máximo para compensar o saldo. Estourou, o saldo positivo é devido como hora extra.</div>
                </div>
                <div class="field">
                    <label>Alerta de fechamento do ciclo (dias)</label>
                    <input class="input" id="fpBhAlerta" type="number" min="1" max="365" step="1" value="${params.bhAlertaDias ?? BH_PARAMS_PADRAO.alertaDias}">
                    <div class="field-hint">Antecedência do alerta <strong>crítico</strong> antes do fim do ciclo — a última janela para compensar em vez de pagar.</div>
                </div>
            </div>
            <div class="form-row">
                <div class="field" style="margin-bottom:0">
                    <label>Teto mensal de compensação (HH:MM)</label>
                    <input class="input" id="fpBhTeto" placeholder="10:00" value="${fmtHHMM(params.bhTetoMensalMin ?? BH_PARAMS_PADRAO.tetoMensalMin)}">
                    <div class="field-hint">Quanto dá para compensar em um mês. Usado para avisar quando o saldo já não cabe no prazo restante. <strong>00:00</strong> = sem teto.</div>
                </div>
                <div class="field" style="margin-bottom:0">
                    <label>Adicional de hora extra (%)</label>
                    <input class="input" id="fpBhAdicional" type="number" min="0" max="200" step="1" value="${params.bhAdicionalPct ?? BH_PARAMS_PADRAO.adicionalPct}">
                    <div class="field-hint">Só para <strong>estimar</strong> em R$ o custo do saldo não compensado (mínimo legal: 50%). Não lança na folha.</div>
                </div>
            </div>
            <button class="btn btn-primary mt-16" id="fpBhSave">${icon('check')} Salvar banco de horas</button>
        </div>

        <div class="card mt-16" style="max-width:560px">
            <div class="card-title">Férias</div>
            <div class="card-sub" style="margin-bottom:18px">Regras de cálculo da remuneração (CF art. 7º XVII, CLT arts. 129-145). A competência de cada funcionário só se encerra quando os lançamentos somam os dias do período — fracionar divide o direito, não o multiplica.</div>
            <div class="form-row">
                <div class="field">
                    <label>Dias por período</label>
                    <input class="input" id="fpFerDias" type="number" min="1" max="60" step="1" value="${params.feriasDiasPorCiclo ?? FERIAS_PARAMS_PADRAO.diasPorCiclo}">
                    <div class="field-hint">Total de uma competência (art. 130: 30 dias). Só fecha quando os lançamentos somam este total.</div>
                </div>
                <div class="field">
                    <label>Terço constitucional (%)</label>
                    <input class="input" id="fpFerTerco" type="number" min="0" max="100" step="0.01" value="${Number(params.feriasTercoPct ?? FERIAS_PARAMS_PADRAO.tercoPct).toFixed(2)}">
                    <div class="field-hint">Adicional sobre a remuneração (art. 7º XVII CF: 1/3 = 33,33%). Convenção pode ser mais generosa, nunca menos.</div>
                </div>
            </div>
            <div class="form-row">
                <div class="field">
                    <label>Abono pecuniário — máximo (dias)</label>
                    <input class="input" id="fpFerAbono" type="number" min="0" max="30" step="1" value="${params.feriasAbonoMaxDias ?? FERIAS_PARAMS_PADRAO.abonoMaxDias}">
                    <div class="field-hint">Dias que o funcionário pode vender (art. 143: até 1/3 do período). Contam para fechar a competência.</div>
                </div>
                <div class="field">
                    <label>Média de horas extras na base</label>
                    <label class="flex" style="gap:8px;align-items:center;margin-top:6px;cursor:pointer">
                        <span class="switch"><input type="checkbox" id="fpFerMediaHe" ${(params.feriasMediaHe ?? FERIAS_PARAMS_PADRAO.mediaHe) ? 'checked' : ''}><span class="track"></span></span>
                        <span>Incluir (Súmula 45 TST)</span>
                    </label>
                    <div class="field-hint">HE habitual integra a remuneração de férias. <strong>Confirme a regra da sua convenção coletiva</strong> — ela varia.</div>
                </div>
            </div>
            <div class="field" style="margin-bottom:0">
                <label>Meses da média de HE</label>
                <input class="input" id="fpFerMediaMeses" type="number" min="1" max="12" step="1" value="${params.feriasMediaHeMeses ?? FERIAS_PARAMS_PADRAO.mediaHeMeses}">
                <div class="field-hint">Quantos meses do período aquisitivo entram na média. A média divide pelo total de meses, não só pelos que tiveram extra.</div>
            </div>
            <button class="btn btn-primary mt-16" id="fpFerSave">${icon('check')} Salvar férias</button>
        </div>

        <div class="card mt-16" style="max-width:560px">
            <div class="card-title">Dados de exemplo</div>
            <div class="card-sub" style="margin-bottom:16px">Gera ~20 funcionários fictícios com lançamentos e folha do ano para validar os KPIs. Limpe antes de usar o sistema com dados reais.</div>
            <div class="flex">
                <button class="btn btn-secondary" id="seedGerar">${icon('plus')} Gerar dados de exemplo</button>
                <button class="btn btn-ghost" id="seedLimpar" style="color:var(--danger)">${icon('trash')} Limpar dados de exemplo</button>
            </div>
        </div>`;

    document.getElementById('seedGerar').onclick = async () => {
        const existente = await DB.getObj(SEED_PATH);
        if (existente) return toast('Já existem dados de exemplo. Limpe antes de gerar novamente.', 'error');
        if (!await confirmDialog({ title: 'Gerar dados de exemplo', message: 'Serão criados cargos, unidades, benefícios, ~20 funcionários, lançamentos e folha fictícios. Continuar?', confirmText: 'Gerar' })) return;
        const btn = document.getElementById('seedGerar');
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Gerando...';
        try {
            await gerarDadosExemplo();
            toast('Dados de exemplo criados. Explore o Dashboard e os Resultados.');
        } catch (e) { console.error(e); toast('Erro ao gerar: ' + e.message, 'error'); }
        renderCfgTab();
    };
    document.getElementById('seedLimpar').onclick = async () => {
        if (!await confirmDialog({ title: 'Limpar dados de exemplo', message: 'Todos os registros fictícios serão excluídos permanentemente (dados reais são preservados). Continuar?', confirmText: 'Limpar', danger: true })) return;
        const btn = document.getElementById('seedLimpar');
        btn.disabled = true;
        try {
            const ok = await limparDadosExemplo();
            toast(ok ? 'Dados de exemplo removidos.' : 'Nenhum dado de exemplo encontrado.', ok ? 'success' : 'info');
        } catch (e) { console.error(e); toast('Erro ao limpar: ' + e.message, 'error'); }
        renderCfgTab();
    };

    document.getElementById('fpSave').onclick = async () => {
        const alertaFerias = Number(document.getElementById('fpFeriasAlerta').value);
        if (!(alertaFerias >= 1 && alertaFerias <= 365))
            return toast('O alerta de prazo legal deve ficar entre 1 e 365 dias.', 'error');
        const alertaAso = Number(document.getElementById('fpAsoAlerta').value);
        if (!(alertaAso >= 1 && alertaAso <= 365))
            return toast('O alerta de vencimento do ASO deve ficar entre 1 e 365 dias.', 'error');
        const novos = {
            encargosPct: Number(document.getElementById('fpEncargos').value) || 0,
            diasExperiencia: Number(document.getElementById('fpExp').value) || 90,
            salarioMinimo: Number(document.getElementById('fpSalMin').value) || 0,
            insalubridadeBase: document.getElementById('fpInsalBase').value,
            feriasAlertaLegalDias: alertaFerias,
            asoAlertaDias: alertaAso
        };
        // Preserva o bloco de banco de horas: os dois cards gravam no mesmo path e um
        // DB.set completo aqui apagaria o que o outro salvou.
        await DB.set(PATHS.parametros, { ...params, ...novos });
        Object.assign(params, novos);
        // Os setters leem o conjunto INTEIRO de parâmetros do seu domínio, e o card de Férias
        // grava no mesmo path. Passar só `novos` faria este save zerar dias/terço/abono para
        // o padrão até o próximo reload — o mesmo erro que o spread acima evita no banco.
        setFeriasParams(params);
        setAsoParams(params);
        toast('Parâmetros salvos.');
    };

    document.getElementById('fpBhSave').onclick = async () => {
        const alertaBh = Number(document.getElementById('fpBhAlerta').value);
        if (!(alertaBh >= 1 && alertaBh <= 365))
            return toast('O alerta de fechamento do ciclo deve ficar entre 1 e 365 dias.', 'error');
        // Teto é HH:MM: parseHHMM devolve null quando não consegue ler, e null não pode
        // virar 0 em silêncio — 0 aqui significa "sem teto", que é outra coisa.
        const teto = parseHHMM(document.getElementById('fpBhTeto').value);
        if (teto == null || teto < 0)
            return toast('Teto mensal inválido. Use o formato HH:MM (ex: 10:00) ou 00:00 para sem teto.', 'error');
        const adicional = Number(document.getElementById('fpBhAdicional').value);
        if (!(adicional >= 0 && adicional <= 200))
            return toast('O adicional de hora extra deve ficar entre 0 e 200%.', 'error');

        const novos = {
            bhCicloMeses: Number(document.getElementById('fpBhCiclo').value) || 6,
            bhAlertaDias: alertaBh,
            bhTetoMensalMin: teto,
            bhAdicionalPct: adicional
        };
        await DB.set(PATHS.parametros, { ...params, ...novos });
        Object.assign(params, novos);
        setBhParams(novos);
        toast('Parâmetros de banco de horas salvos.');
    };

    document.getElementById('fpFerSave').onclick = async () => {
        const dias = Number(document.getElementById('fpFerDias').value);
        if (!(dias >= 1 && dias <= 60))
            return toast('Os dias por período devem ficar entre 1 e 60.', 'error');
        const terco = Number(document.getElementById('fpFerTerco').value);
        if (!(terco >= 0 && terco <= 100))
            return toast('O terço constitucional deve ficar entre 0 e 100%.', 'error');
        // O piso é constitucional: convenção pode dar mais, nunca menos que 1/3. Aviso em vez
        // de bloqueio — quem opera a folha pode ter um motivo que o sistema não conhece.
        if (terco < 33.33 && !await confirmDialog({
            title: 'Terço abaixo do mínimo legal',
            message: `${fmtPct(terco, 2)} é <strong>menor que o mínimo constitucional</strong> de 33,33% (art. 7º XVII CF).<br><br>
                Convenção coletiva pode ampliar o terço, nunca reduzi-lo. Salvar mesmo assim?`,
            confirmText: 'Salvar assim mesmo', danger: true
        })) return;
        const abono = Number(document.getElementById('fpFerAbono').value);
        if (!(abono >= 0 && abono <= 30))
            return toast('O máximo de abono deve ficar entre 0 e 30 dias.', 'error');
        if (abono > dias / 3 && !await confirmDialog({
            title: 'Abono acima de 1/3',
            message: `${abono} dias é mais que <strong>1/3 de ${dias}</strong> (${Math.floor(dias / 3)} dias), o limite do art. 143 da CLT.<br><br>Salvar mesmo assim?`,
            confirmText: 'Salvar assim mesmo', danger: true
        })) return;
        const mediaMeses = Number(document.getElementById('fpFerMediaMeses').value);
        if (!(mediaMeses >= 1 && mediaMeses <= 12))
            return toast('Os meses da média de HE devem ficar entre 1 e 12.', 'error');

        const novos = {
            feriasDiasPorCiclo: dias,
            feriasTercoPct: terco,
            feriasAbonoMaxDias: abono,
            feriasMediaHe: document.getElementById('fpFerMediaHe').checked,
            feriasMediaHeMeses: mediaMeses
        };
        await DB.set(PATHS.parametros, { ...params, ...novos });
        Object.assign(params, novos);
        setFeriasParams({ ...params, ...novos });
        toast('Parâmetros de férias salvos.');
    };
}
