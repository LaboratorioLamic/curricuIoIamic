// ─── AUTH SYSTEM ────────────────────────────────────────────────
function checkAuth(action, id = null) {
    if (isAuthenticated) {
        executeSecureAction(action, id);
    } else {
        pendingAction = action;
        pendingId = id;
        document.getElementById('passwordOverlay').classList.add('open');
        document.getElementById('authPassword').value = '';
        document.getElementById('authPassword').focus();
    }
}

function closePasswordModal() {
    document.getElementById('passwordOverlay').classList.remove('open');
    pendingAction = null;
    pendingId = null;
}

function validatePassword() {
    const pwd = document.getElementById('authPassword').value;
    if (pwd === MASTER_PWD) {
        isAuthenticated = true;
        // Não persiste mais o estado de login para exigir senha ao atualizar a página
        document.getElementById('tabEditBtn').classList.remove('locked');
        document.getElementById('passwordOverlay').classList.remove('open');
        toast('Acesso autorizado', 'success');
        if (pendingAction) executeSecureAction(pendingAction, pendingId);
    } else {
        toast('Senha incorreta', 'error');
        document.getElementById('authPassword').value = '';
    }
}

// Adiciona evento Enter para o campo de senha
document.addEventListener('DOMContentLoaded', function() {
    const authPassword = document.getElementById('authPassword');
    if (authPassword) {
        authPassword.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                validatePassword();
            }
        });
    }
});

function executeSecureAction(action, id) {
    if (action === 'add') openAddModal();
    if (action === 'edit') openEditModal(id);
    if (action === 'delete') askDelete(id);
    if (action === 'backup') openBackupModal();
}

