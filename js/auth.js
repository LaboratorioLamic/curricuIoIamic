// ===== Autenticação e permissões =====

const SESSION_KEY = 'rh_sessao';
let currentUser = null;

// ===== Modelo de permissões =====
// Organizado em ÁRVORE: MÓDULO (tela do menu) → SUB-ITENS (as abas de dentro da tela), no
// espírito do menu de cadastros que expande para mostrar cada item. Cada leaf tem só as ações
// que o sistema REALMENTE controla — nada de coluna decorativa que não é aplicada:
//   • consultar → gate `ver_*`   : abrir a aba/tela e ler os registros.
//   • gerenciar → gate `editar_*`: incluir, alterar e excluir.
//
// Lançamentos é a tela com várias abas; a VISUALIZAÇÃO é por aba (Férias, Faltas, ASO...),
// controlando quais abas o usuário enxerga. A GESTÃO (incluir/alterar/excluir) fica no nível
// do módulo porque os mesmos formulários de edição são reaproveitados fora da tela de
// Lançamentos (na ficha do funcionário) — separar por aba criaria brechas e inconsistência.
const PERM_ACOES = {
    consultar: { label: 'Visualizar', desc: 'Ver e abrir os registros', icon: 'eye' },
    gerenciar: { label: 'Gerenciar', desc: 'Incluir, alterar e excluir', icon: 'edit' }
};

// Sub-abas da tela de Lançamentos (espelham LANC_TABS em lancamentos.js). `fin` = a aba é
// financeira e também exige ver_folha + ver_financeiro para aparecer.
const PERM_LANC_SUBS = [
    { id: 'ferias', label: 'Férias' },
    { id: 'ausencias', label: 'Faltas e Licenças' },
    { id: 'aso', label: 'ASO' },
    { id: 'demissoes', label: 'Demissões' },
    { id: 'treinamentos', label: 'Treinamentos' },
    { id: 'promocoes', label: 'Promoções' },
    { id: 'transferencias', label: 'Transferências' },
    { id: 'bancohoras', label: 'Banco de horas' },
    { id: 'decimo', label: '13º Salário', fin: true },
    { id: 'folhagrid', label: 'Folha mensal', fin: true }
].map(s => ({ ...s, ver: 'ver_lanc_' + s.id }));

const PERM_MODULOS = [
    {
        id: 'dashboard', label: 'Dashboard', icon: 'dashboard',
        desc: 'Indicadores e visão geral do RH',
        acoes: [{ tipo: 'consultar', key: 'ver_dashboard' }]
    },
    {
        id: 'funcionarios', label: 'Funcionários', icon: 'users',
        desc: 'Cadastro e ficha dos colaboradores',
        acoes: [
            { tipo: 'consultar', key: 'ver_funcionarios' },
            { tipo: 'gerenciar', key: 'editar_funcionarios' }
        ]
    },
    {
        id: 'lancamentos', label: 'Lançamentos', icon: 'calendar',
        desc: 'Eventos de RH — visualização por aba',
        // Ação de gestão no nível do módulo (ver comentário acima).
        acoes: [{ tipo: 'gerenciar', key: 'editar_lancamentos' }],
        // Visualização por aba: cada leaf tem sua própria permissão de ver.
        viewCoarse: 'ver_lancamentos',
        subs: PERM_LANC_SUBS
    },
    {
        id: 'folha', label: 'Folha & Custos', icon: 'money',
        desc: 'Folha de pagamento e custos mensais',
        acoes: [
            { tipo: 'consultar', key: 'ver_folha' },
            { tipo: 'gerenciar', key: 'editar_folha' }
        ]
    },
    {
        id: 'resultados', label: 'Resultados', icon: 'chart',
        desc: 'Relatórios e análises consolidadas',
        acoes: [{ tipo: 'consultar', key: 'ver_resultados' }]
    }
];

// Permissões sensíveis (transversais a vários módulos)
const PERM_SENSIVEIS = [
    {
        key: 'ver_financeiro', label: 'Valores financeiros', icon: 'money',
        desc: 'Salários, custos e totais em R$ — em todos os módulos.'
    },
    // Dado de saúde é categoria especial na LGPD (art. 11): quem controla prazo de ASO não
    // precisa ver o resultado clínico. Sem esta permissão a aba mostra datas e vencimentos
    // (o que o RH precisa para não tomar autuação), mas oculta resultado, restrições e laudo.
    {
        key: 'ver_medico', label: 'Dados médicos', icon: 'medical',
        desc: 'Resultado do ASO, restrições e laudos (LGPD art. 11).'
    }
];

// Lista achatada (compat. com quem itera PERMISSOES: seed do 1º admin, backup, etc.)
const PERMISSOES = [
    ...PERM_MODULOS.flatMap(m => [
        ...(m.acoes || []).map(a => ({ key: a.key, grupo: m.label, label: `${PERM_ACOES[a.tipo].label} — ${m.label}` })),
        ...(m.viewCoarse ? [{ key: m.viewCoarse, grupo: m.label, label: `Ver — ${m.label}` }] : []),
        ...(m.subs || []).map(s => ({ key: s.ver, grupo: m.label, label: `Ver ${s.label} — ${m.label}` }))
    ]),
    ...PERM_SENSIVEIS.map(p => ({ key: p.key, grupo: 'Sensível', label: p.label }))
];
const PERM_KEYS = PERMISSOES.map(p => p.key);

// Expande/normaliza um conjunto de permissões para que os gates grosos e os por-aba fiquem
// coerentes entre si:
//   • Grupo legado que só tem `ver_lancamentos` (sem as chaves por aba) → libera todas as abas.
//   • O gate groso `ver_lancamentos` (usado no menu e no registerPage) passa a refletir se há
//     ao menos UMA aba visível.
function expandirPerms(perms) {
    const p = { ...(perms || {}) };
    const subKeys = PERM_LANC_SUBS.map(s => s.ver);
    const algumSub = subKeys.some(k => p[k]);
    if (p.ver_lancamentos && !algumSub) subKeys.forEach(k => p[k] = true); // legado → todas as abas
    p.ver_lancamentos = subKeys.some(k => p[k]);                            // coarse reflete as abas
    return p;
}

// Cache dos grupos carregados na sessão (para resolver perms e exibir o nome do grupo).
let gruposCache = null;
async function carregarGrupos(force) {
    if (!gruposCache || force) gruposCache = await DB.getAll(PATHS.grupos);
    return gruposCache;
}
function grupoPorId(id) { return (gruposCache || []).find(g => g.id === id) || null; }

// Resolve o conjunto de permissões efetivo de um usuário: admin = tudo; senão, as permissões
// do GRUPO ao qual ele pertence; e, por retrocompatibilidade, as permissões gravadas
// direto no usuário (modelo antigo) quando ele ainda não tem grupo.
async function resolverPerms(user) {
    if (user.admin) { const p = {}; PERM_KEYS.forEach(k => p[k] = true); return p; }
    let base;
    if (user.grupoId) {
        await carregarGrupos();
        base = grupoPorId(user.grupoId)?.perms || {};
    } else {
        base = user.perms || {}; // modelo legado (perms direto no usuário)
    }
    return expandirPerms(base);
}

// Visualização por aba de Lançamentos (admin sempre pode).
function podeVerLanc(subId) {
    if (!currentUser) return false;
    if (currentUser.admin) return true;
    return !!currentUser.perms?.['ver_lanc_' + subId];
}

function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}

function setSession(user) {
    currentUser = user;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
    currentUser = null;
    sessionStorage.removeItem(SESSION_KEY);
}

// user.admin === true → tudo liberado
function can(perm) {
    if (!currentUser) return false;
    if (currentUser.admin) return true;
    return !!(currentUser.perms && currentUser.perms[perm]);
}

async function doLogin(login, senha) {
    const usuarios = await DB.getAll(PATHS.usuarios);
    const hash = await sha256(senha);
    const user = usuarios.find(u => (u.login || '').toLowerCase() === login.toLowerCase().trim());
    if (!user || user.senhaHash !== hash) throw new Error('Login ou senha incorretos.');
    if (user.ativo === false) throw new Error('Usuário inativo. Contate um administrador.');
    const perms = await resolverPerms(user);
    setSession({
        id: user.id,
        nome: user.nome,
        login: user.login,
        admin: !!user.admin,
        grupoId: user.grupoId || null,
        grupoNome: user.grupoId ? (grupoPorId(user.grupoId)?.nome || null) : null,
        perms
    });
    return currentUser;
}

function doLogout() {
    clearSession();
    location.hash = '';
    location.reload();
}

// ---- Telas ----
async function showLogin() {
    document.getElementById('app').classList.remove('show');
    document.getElementById('loginScreen').style.display = 'flex';

    // Primeiro acesso: nenhum usuário cadastrado → criar primeiro administrador
    try {
        const usuarios = await DB.getAll(PATHS.usuarios);
        if (usuarios.length === 0) renderFirstAdminSetup();
    } catch (e) {
        console.error('Erro ao verificar usuários:', e);
        const errEl = document.getElementById('loginError');
        errEl.textContent = 'Erro de conexão com o banco de dados.';
        errEl.classList.add('show');
    }
}

// Formulário de criação do primeiro administrador
function renderFirstAdminSetup() {
    const card = document.querySelector('#loginScreen .login-card');
    card.innerHTML = `
        <div class="login-logo">${icon('lock')}</div>
        <h1>Configuração inicial</h1>
        <p class="login-sub">Nenhum usuário cadastrado. Crie o primeiro administrador do sistema.</p>
        <div class="login-error" id="setupError"></div>
        <form id="setupForm">
            <div class="field">
                <label>Nome completo <span class="req">*</span></label>
                <input class="input" id="setupNome" type="text" placeholder="Seu nome" required>
            </div>
            <div class="field">
                <label>Login <span class="req">*</span></label>
                <input class="input" id="setupLogin" type="text" autocomplete="username" placeholder="Ex: maria.silva" required>
            </div>
            <div class="field">
                <label>CPF</label>
                <input class="input" id="setupCpf" type="text" inputmode="numeric" placeholder="000.000.000-00">
            </div>
            <div class="form-row">
                <div class="field">
                    <label>Senha <span class="req">*</span></label>
                    <input class="input" id="setupPwd" type="password" autocomplete="new-password" required>
                    <div class="field-hint">Mínimo 6 caracteres</div>
                </div>
                <div class="field">
                    <label>Confirmar senha <span class="req">*</span></label>
                    <input class="input" id="setupPwd2" type="password" autocomplete="new-password" required>
                </div>
            </div>
            <button class="btn btn-primary btn-block" id="btnSetup" type="submit">Criar administrador</button>
        </form>`;

    const cpfInput = card.querySelector('#setupCpf');
    cpfInput.addEventListener('input', () => cpfInput.value = maskCPF(cpfInput.value));

    card.querySelector('#setupForm').addEventListener('submit', async e => {
        e.preventDefault();
        const errEl = card.querySelector('#setupError');
        errEl.classList.remove('show');
        const nome = card.querySelector('#setupNome').value.trim();
        const login = card.querySelector('#setupLogin').value.trim();
        const cpf = cpfInput.value.trim();
        const pwd = card.querySelector('#setupPwd').value;
        const pwd2 = card.querySelector('#setupPwd2').value;

        const fail = msg => { errEl.textContent = msg; errEl.classList.add('show'); };
        if (pwd.length < 6) return fail('A senha deve ter no mínimo 6 caracteres.');
        if (pwd !== pwd2) return fail('As senhas não conferem.');
        if (cpf && !validaCPF(cpf)) return fail('CPF inválido.');

        const btn = card.querySelector('#btnSetup');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Criando...';
        try {
            // Corrida: alguém pode ter criado usuário enquanto o formulário estava aberto
            const existentes = await DB.getAll(PATHS.usuarios);
            if (existentes.length > 0) return fail('Já existe usuário cadastrado. Recarregue a página e faça login.');

            const perms = {};
            PERMISSOES.forEach(p => perms[p.key] = true);
            const id = await DB.save(PATHS.usuarios, null, {
                nome, login, cpf,
                senhaHash: await sha256(pwd),
                ativo: true,
                admin: true,
                perms,
                criadoEm: hoje()
            });
            setSession({ id, nome, login, admin: true, perms });
            toast(`Bem-vindo, ${nome.split(' ')[0]}! Administrador criado.`);
            showApp();
        } catch (err) {
            fail(err.message || 'Erro ao criar administrador.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Criar administrador';
        }
    });
}

function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').classList.add('show');
    renderSidebar();
    initSidebarToggle();
    if (can('ver_dashboard') && typeof refreshNotificacoes === 'function') refreshNotificacoes();
    // Parâmetros globais (alerta de prazo de férias, vencimento de ASO, ciclo de banco de
    // horas) antes da primeira página renderizar
    DB.getObj(PATHS.parametros).then(p => { setFeriasParams(p || {}); setAsoParams(p || {}); setBhParams(p || {}); setDecimoParams(p || {}); initRouter(); })
        .catch(() => initRouter());
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnLogin');
    const errEl = document.getElementById('loginError');
    errEl.classList.remove('show');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Entrando...';
    try {
        await doLogin(
            document.getElementById('loginUser').value,
            document.getElementById('loginPwd').value
        );
        showApp();
    } catch (err) {
        errEl.textContent = err.message || 'Erro ao entrar.';
        errEl.classList.add('show');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Entrar';
    }
}
