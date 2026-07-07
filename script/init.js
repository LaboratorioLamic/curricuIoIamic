// ─── INIT ───────────────────────────────────────────────────────
window.onload = () => { 
    loadLocalData(); // Primeiro carrega o que estiver no cache local
    loadSheet().then(() => {
        // Após carregar a planilha, carrega os arquivos para garantir sincronização
        loadDriveFiles(); 
    });
    
    // Adiciona listener para tecla ESC
    document.addEventListener('keydown', handleEscKey);
    
    // Adiciona listener para quando usuário volta para a página
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Adiciona listener para quando a janela ganha foco
    window.addEventListener('focus', handleWindowFocus);
};

// Atualiza dados quando usuário volta para a página
function handleVisibilityChange() {
    if (!document.hidden) {
        console.log('Usuário voltou para a página, verificando atualizações...');
        // Força uma verificação rápida de atualizações
        checkForUpdates();
    }
}

// Atualiza dados quando janela ganha foco
function handleWindowFocus() {
    console.log('Janela ganhou foco, verificando atualizações...');
    checkForUpdates();
}

// Verifica se há atualizações pendentes
async function checkForUpdates() {
    try {
        // Verifica cards
        const cardsSnapshot = await database.ref(FIREBASE_PATHS.cards).once('value');
        const serverCards = cardsSnapshot.val();
        if (serverCards) {
            const serverCardsArray = Object.values(serverCards);
            if (JSON.stringify(cards) !== JSON.stringify(serverCardsArray)) {
                console.log('Detectadas atualizações de cards...');
                cards = serverCardsArray;
                sortCards();
                renderCards();
                showRealtimeUpdate('Cards sincronizados');
            }
        }
        
        // Verifica arquivos
        const filesSnapshot = await database.ref(FIREBASE_PATHS.files).once('value');
        const serverFiles = filesSnapshot.val();
        if (serverFiles) {
            const serverFilesArray = serverFiles.files || [];
            if (JSON.stringify(allFiles) !== JSON.stringify(serverFilesArray)) {
                console.log('Detectadas atualizações de arquivos...');
                allFiles = serverFilesArray;
                updateCardsWithNewFiles();
                showRealtimeUpdate('Arquivos sincronizados');
            }
        }
        
    } catch (error) {
        console.error('Erro ao verificar atualizações:', error);
    }
}

function handleEscKey(event) {
    if (event.key === 'Escape') {
        // Verifica se o modal está aberto
        const overlay = document.getElementById('mainOverlay');
        if (overlay && overlay.classList.contains('open')) {
            // Verifica se há upload em andamento
            const uploadProg = document.getElementById('editUploadProg');
            if (uploadProg && uploadProg.classList.contains('visible')) {
                toast('Não é possível fechar enquanto há upload em andamento', 'error');
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            
            // Se não há upload, fecha o modal
            closeModal();
        }
    }
}

// Gerencia o estado visual do modal durante upload
function setModalUploadingState(isUploading) {
    const overlay = document.getElementById('mainOverlay');
    const modal = document.getElementById('mainModal');
    
    if (isUploading) {
        overlay.classList.add('uploading');
        
        // Adiciona indicador visual de upload
        if (!modal.querySelector('.upload-indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'upload-indicator';
            indicator.innerHTML = 'UPLOAD';
            modal.appendChild(indicator);
        }
    } else {
        overlay.classList.remove('uploading');
        
        // Remove indicador visual
        const indicator = modal.querySelector('.upload-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
}

