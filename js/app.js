// ===== Inicialização =====

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm').addEventListener('submit', handleLoginSubmit);

    // Mostrar/ocultar senha
    const pwdToggle = document.getElementById('pwdToggle');
    pwdToggle.onclick = () => {
        const inp = document.getElementById('loginPwd');
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        pwdToggle.innerHTML = icon(show ? 'eyeOff' : 'eye');
    };

    // Sessão existente → direto pro app
    const session = getSession();
    if (session) {
        currentUser = session;
        showApp();
    } else {
        showLogin();
    }
});
