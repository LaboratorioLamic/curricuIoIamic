// ─── SAVE CARD ───────────────────────────────────────────────────
function saveCard() {
    const id   = document.getElementById('editCardId').value;
    const name = document.getElementById('editNome').value.trim();
    if (!name) { toast('Informe o nome do colaborador', 'error'); return; }

    const row = sheetData.find(r => r.nome.trim().toLowerCase() === name.toLowerCase());
    if (!row && name) { toast('Nome não encontrado na planilha', 'error'); return; }

    const idx = cards.findIndex(c => c.id === id);
    if (idx === -1) return;
    cards[idx].nome     = name;
    cards[idx].telefone = row?.telefone || '';
    cards[idx].genero   = row?.genero   || '';
    cards[idx].uc       = row?.uc       || '';
    cards[idx].funcao   = row?.funcao   || '';

    // Verifica se há upload em andamento
    const uploadProg = document.getElementById('editUploadProg');
    if (uploadProg && uploadProg.classList.contains('visible')) {
        // Mostra aviso que o upload está em andamento
        showUploadInProgressWarning();
        return;
    }

    toast('Colaborador atualizado!', 'success');
    closeModal();
    saveLocalCards(); // Persiste no LocalStorage
    sortCards();      // Apenas ordena os cards
    renderCards();   // Renderiza os cards
}

// Função para mostrar aviso de upload em andamento
function showUploadInProgressWarning() {
    const existingWarning = document.getElementById('uploadInProgressWarning');
    if (existingWarning) return; // Evita duplicação
    
    const warning = document.createElement('div');
    warning.id = 'uploadInProgressWarning';
    warning.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #f59e0b;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 1000;
        min-width: 300px;
        text-align: center;
    `;
    
    warning.innerHTML = `
        <div style="color: #f59e0b; font-size: 24px; margin-bottom: 10px;">⏳</div>
        <h3 style="color: #1f2937; margin-bottom: 10px;">Upload em Andamento</h3>
        <p style="color: #6b7280; margin-bottom: 15px;">Aguarde o upload do arquivo concluir para salvar o colaborador.</p>
        <div id="uploadProgressBar" style="background: #e5e7eb; border-radius: 8px; height: 8px; margin-bottom: 10px; overflow: hidden;">
            <div id="uploadProgressFill" style="background: #f59e0b; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
        </div>
        <div id="uploadProgressText" style="color: #6b7280; font-size: 14px;">Aguardando...</div>
        <button onclick="closeUploadWarning()" style="background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-top: 10px;">OK</button>
    `;
    
    document.body.appendChild(warning);
    
    // Monitora o progresso do upload
    monitorUploadProgress();
}

function closeUploadWarning() {
    const warning = document.getElementById('uploadInProgressWarning');
    if (warning) {
        warning.remove();
    }
}

function monitorUploadProgress() {
    const checkProgress = () => {
        const prog = document.getElementById('editUploadProg');
        const warning = document.getElementById('uploadInProgressWarning');
        
        if (!warning) return; // Warning foi fechado
        
        if (prog && prog.classList.contains('visible')) {
            const fill = document.getElementById('editProgFill');
            const value = document.getElementById('editProgValue');
            const label = document.getElementById('editProgLabel');
            
            if (fill && value && label) {
                const progressWidth = fill.style.width;
                const progressValue = value.textContent;
                const progressLabel = label.textContent;
                
                // Atualiza o warning
                const warningFill = document.getElementById('uploadProgressFill');
                const warningText = document.getElementById('uploadProgressText');
                
                if (warningFill && warningText) {
                    warningFill.style.width = progressWidth;
                    warningText.textContent = `${progressLabel} - ${progressValue}`;
                }
            }
            
            // Continua monitorando
            setTimeout(checkProgress, 500);
        } else {
            // Upload concluído, fecha o warning e salva
            closeUploadWarning();
            saveCard();
        }
    };
    
    checkProgress();
}

