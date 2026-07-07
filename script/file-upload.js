// ─── FILE UPLOAD ──────────────────────────────────────────────────
async function handleEditUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const cardId = document.getElementById('editCardId').value;
    if (!cardId) { toast('Salve o colaborador primeiro', 'error'); return; }

    const prog = document.getElementById('editUploadProg');
    prog.classList.add('visible');
    setEditProg(20, 'Lendo arquivo...');
    
    // Ativa o estado de upload no modal
    setModalUploadingState(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
        const card = cards.find(c => c.id === cardId);
        const taggedName = `${card ? card.nome : 'Colaborador'} [CARD:${cardId}] ${file.name}`;
        setEditProg(50, 'Enviando...');
        try {
            await fetch(DRIVE_API, {
                method: 'POST',
                body: JSON.stringify({ action:'upload', filename: taggedName, data: e.target.result })
            });
            setEditProg(100, 'Concluído!');
            toast('Arquivo enviado!', 'success');
            setTimeout(async () => {
                prog.classList.remove('visible');
                // Desativa o estado de upload no modal
                setModalUploadingState(false);
                await loadDriveFiles();
                const updatedCard = cards.find(c => c.id === cardId);
                if (updatedCard) fillEditPane(updatedCard);
            }, 700);
        } catch(err) {
            toast('Erro no upload', 'error');
            prog.classList.remove('visible');
            // Desativa o estado de upload no modal em caso de erro
            setModalUploadingState(false);
        }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function setEditProg(p, label) {
    document.getElementById('editProgFill').style.width  = p + '%';
    document.getElementById('editProgValue').textContent = p + '%';
    document.getElementById('editProgLabel').textContent = label;
}

function startEditingFileName(fileId, inputElement) {
    inputElement.style.borderColor = '#3b82f6';
    inputElement.style.background = 'white';
    inputElement.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.1)';
    // Salva o valor original para possível restauração
    inputElement.setAttribute('data-original-value', inputElement.value);
}

async function finishEditingFileName(fileId, inputElement, cardId) {
    const newName = inputElement.value;
    const originalValue = inputElement.getAttribute('data-original-value');
    
    // Se não houve mudança, apenas restaura o estilo
    if (newName === originalValue) {
        inputElement.style.borderColor = 'transparent';
        inputElement.style.background = 'transparent';
        inputElement.style.boxShadow = 'none';
        return;
    }
    
    if (!newName || newName.trim() === '') {
        toast('Nome do arquivo não pode estar vazio', 'error');
        inputElement.value = originalValue;
        inputElement.style.borderColor = '#ef4444';
        inputElement.style.background = '#fef2f2';
        inputElement.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.2)';
        return;
    }
    
    const file = allFiles.find(f => f.id === fileId);
    if (!file) return;
    
    // Extrai o nome do colaborador e o ID do card do nome original
    const cardMatch = file.name.match(/^(.+?)\s*\[CARD:([^\]]+)\]\s*(.*)$/);
    if (!cardMatch) return;
    
    const collaboratorName = cardMatch[1];
    const cardIdFromName = cardMatch[2];
    const originalFileName = cardMatch[3];
    
    // Constrói o novo nome mantendo a estrutura original
    const newFullName = `${collaboratorName} [CARD:${cardIdFromName}] ${newName.trim()}`;
    
    // Mostra indicador de carregamento e feedback visual
    inputElement.style.borderColor = '#f59e0b';
    inputElement.style.background = '#fef3c7';
    inputElement.style.boxShadow = '0 0 0 2px rgba(245,158,11,0.2)';
    
    // Atualiza imediatamente na visualização com o novo nome
    const viewElement = document.getElementById(`viewFileName_${fileId}`);
    if (viewElement) {
        viewElement.style.color = '#f59e0b';
        viewElement.style.fontStyle = 'italic';
        viewElement.textContent = newName;
        
        // Adiciona indicador visual de carregamento
        const loadingIndicator = document.createElement('span');
        loadingIndicator.style.cssText = `
            margin-left: 6px;
            font-size: 11px;
            color: #f59e0b;
            animation: pulse 1.5s ease-in-out infinite;
        `;
        loadingIndicator.innerHTML = '⟳ salvando...';
        viewElement.appendChild(loadingIndicator);
    }
    
    toggleSync(true);
    
    try {
        await fetch(DRIVE_API, { 
            method:'POST', 
            body: JSON.stringify({ 
                action:'rename', 
                id: fileId, 
                newName: newFullName 
            }) 
        });
        await loadDriveFiles();
        const card = cards.find(c => c.id === cardId);
        if (card) fillEditPane(card);
        toast('Nome do arquivo atualizado!', 'success');
    } catch(e) { 
        toast('Erro ao atualizar nome', 'error'); 
        // Restaura o valor original em caso de erro
        inputElement.value = originalValue;
        inputElement.style.borderColor = '#ef4444';
        inputElement.style.background = '#fef2f2';
        inputElement.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.2)';
        
        // Restaura na visualização também
        if (viewElement) {
            viewElement.style.color = '';
            viewElement.style.fontStyle = '';
            viewElement.textContent = originalValue;
        }
    }
    finally { 
        toggleSync(false); 
        // Restaura o estilo normal após um breve delay
        setTimeout(() => {
            inputElement.style.borderColor = 'transparent';
            inputElement.style.background = 'transparent';
            inputElement.style.boxShadow = 'none';
            
            // Restaura na visualização também
            if (viewElement) {
                viewElement.style.color = '';
                viewElement.style.fontStyle = '';
                // Remove o indicador de carregamento se existir
                const loadingIndicator = viewElement.querySelector('span');
                if (loadingIndicator) {
                    loadingIndicator.remove();
                }
            }
        }, 1000);
    }
}

async function updateFileName(fileId, newName, cardId) {
    if (!newName || newName.trim() === '') {
        toast('Nome do arquivo não pode estar vazio', 'error');
        return;
    }
    
    const file = allFiles.find(f => f.id === fileId);
    if (!file) return;
    
    // Extrai o nome do colaborador e o ID do card do nome original
    const cardMatch = file.name.match(/^(.+?)\s*\[CARD:([^\]]+)\]\s*(.*)$/);
    if (!cardMatch) return;
    
    const collaboratorName = cardMatch[1];
    const cardIdFromName = cardMatch[2];
    const originalFileName = cardMatch[3];
    
    // Constrói o novo nome mantendo a estrutura original
    const newFullName = `${collaboratorName} [CARD:${cardIdFromName}] ${newName.trim()}`;
    
    // Mostra indicador de carregamento
    toggleSync(true);
    
    try {
        await fetch(DRIVE_API, { 
            method:'POST', 
            body: JSON.stringify({ 
                action:'rename', 
                id: fileId, 
                newName: newFullName 
            }) 
        });
        await loadDriveFiles();
        const card = cards.find(c => c.id === cardId);
        if (card) fillEditPane(card);
        toast('Nome do arquivo atualizado!', 'success');
    } catch(e) { 
        toast('Erro ao atualizar nome', 'error'); 
    }
    finally { 
        toggleSync(false); 
    }
}

async function deleteFile(fileId) {
    showDeleteFileConfirmation(fileId);
}

// Mostra janela de confirmação moderna para deletar anexo
function showDeleteFileConfirmation(fileId) {
    const file = allFiles.find(f => f.id === fileId);
    if (!file) return;
    
    // Remove o nome do colaborador e o tag CARD do nome do arquivo
    const fileName = file.name.replace(/^[^\[]*\s*\[CARD:[^\]]+\]\s*/, '').trim();
    
    // Cria o overlay de confirmação
    const overlay = document.createElement('div');
    overlay.id = 'deleteFileOverlay';
    overlay.className = 'overlay open';
    overlay.innerHTML = `
        <div class="modal modal-sm">
            <div class="modal-body">
                <div class="danger-icon">
                    <svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </div>
                <h3>Remover Anexo?</h3>
                <p>O anexo <strong>${fileName}</strong> será removido permanentemente.</p>
                <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">Esta ação não pode ser desfeita.</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button class="btn-cancel" onclick="closeDeleteFileModal()">Cancelar</button>
                    <button class="btn-danger" onclick="confirmDeleteFile('${fileId}', this)">
                        <svg viewBox="0 0 24 24" style="width:16px;height:16px;margin-right:6px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Remover Anexo
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Impede fechamento acidental
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            e.preventDefault();
            e.stopPropagation();
        }
    });
    
    // Impede ESC key
    const handleEsc = function(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
        }
    };
    document.addEventListener('keydown', handleEsc);
    
    // Salva referência para remover depois
    overlay._handleEsc = handleEsc;
}

function closeDeleteFileModal() {
    const overlay = document.getElementById('deleteFileOverlay');
    if (overlay) {
        if (overlay._handleEsc) {
            document.removeEventListener('keydown', overlay._handleEsc);
        }
        overlay.remove();
    }
}

async function confirmDeleteFile(fileId, buttonElement) {
    const file = allFiles.find(f => f.id === fileId);
    if (!file) return;
    
    // Adiciona animação de "apagando" no botão
    const deleteBtn = buttonElement;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" style="width:16px;height:16px;margin-right:6px;animation:spin 1s linear infinite"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        Apagando...
    `;
    
    // Mostra indicador de carregamento
    toggleSync(true);
    
    try {
        // Primeiro deleta o arquivo do Drive
        await fetch(DRIVE_API, { method:'POST', body: JSON.stringify({ action:'delete', id: fileId }) });
        
        // Remove o arquivo da lista local
        allFiles = allFiles.filter(f => f.id !== fileId);
        
        // Atualiza o Firebase com a nova lista de arquivos
        await database.ref(FIREBASE_PATHS.files).set({ files: allFiles });
        
        // Atualiza o card ativo removendo o arquivo
        const card = cards.find(c => c.id === activeCardId);
        
        if (card) {
            // Se o card não tiver array de files, cria um
            if (!card.files) card.files = [];
            
            // Remove o arquivo do card
            card.files = card.files.filter(f => f.id !== fileId);
            
            // Atualiza o _noFiles
            card._noFiles = !card.files.length;
            
            // Salva o card atualizado no Firebase
            await database.ref(FIREBASE_PATHS.cards).set(
                cards.reduce((acc, c) => { acc[c.id] = c; return acc; }, {})
            );
        }
        
        // Atualiza a interface
        if (card) fillEditPane(card);
        
        // Salva localmente para consistência
        saveLocalCards();
        
        toast('Anexo removido permanentemente', 'success');
        closeDeleteFileModal();
    } catch(e) { 
        console.error('Erro ao remover anexo:', e);
        toast('Erro ao remover anexo', 'error'); 
        // Restaura o botão em caso de erro
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" style="width:16px;height:16px;margin-right:6px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Remover Anexo
        `;
    }
    finally { 
        toggleSync(false); 
    }
}

