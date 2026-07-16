// ===== Autenticação e permissões =====

const SESSION_KEY = 'rh_sessao';
let currentUser = null;

// Permissões disponíveis (matriz: ver/editar por módulo + financeiro)
const PERMISSOES = [
    { key: 'ver_dashboard', label: 'Ver Dashboard', grupo: 'Visualização' },
    { key: 'ver_funcionarios', label: 'Ver Funcionários', grupo: 'Visualização' },
    { key: 'ver_lancamentos', label: 'Ver Lançamentos', grupo: 'Visualização' },
    { key: 'ver_folha', label: 'Ver Folha & Custos', grupo: 'Visualização' },
    { key: 'ver_resultados', label: 'Ver Resultados', grupo: 'Visualização' },
    { key: 'editar_funcionarios', label: 'Editar Funcionários', grupo: 'Edição' },
    { key: 'editar_lancamentos', label: 'Editar Lançamentos', grupo: 'Edição' },
    { key: 'editar_folha', label: 'Editar Folha & Custos', grupo: 'Edição' },
    { key: 'ver_financeiro', label: 'Ver valores financeiros (salários e custos)', grupo: 'Sensível' },
    // Dado de saúde é categoria especial na LGPD (art. 11): quem controla prazo de ASO não
    // precisa ver o resultado clínico. Sem esta permissão a aba mostra datas e vencimentos
    // (o que o RH precisa para não tomar autuação), mas oculta resultado, restrições e laudo.
    { key: 'ver_medico', label: 'Ver dados médicos (resultado do ASO, restrições e laudos)', grupo: 'Sensível' }
];

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
    setSession({
        id: user.id,
        nome: user.nome,
        login: user.login,
        admin: !!user.admin,
        perms: user.perms || {}
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
