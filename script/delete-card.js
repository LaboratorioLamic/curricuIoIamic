// ─── DELETE ──────────────────────────────────────────────────────
function askDelete(id) { 
    deletingCardId = id; 
    const card = cards.find(c => c.id === id);
    if (!card) return;
    
    // Preenche o modal de deleção com os dados do colaborador
    document.getElementById('deleteCardName').textContent = card.nome || 'Colaborador';
    document.getElementById('deleteConfirmInput').value = '';
    document.getElementById('deleteConfirmInput').disabled = false;
    document.getElementById('deleteConfirmBtn').disabled = true;
    document.getElementById('deleteError').style.display = 'none';
    
    document.getElementById('deleteOverlay').classList.add('open'); 
    document.getElementById('deleteConfirmInput').focus();
}

function closeDeleteModal() { 
    document.getElementById('deleteOverlay').classList.remove('open'); 
    deletingCardId = null; 
}

function validateDeleteConfirmation() {
    const card = cards.find(c => c.id === deletingCardId);
    if (!card) return;
    
    const input = document.getElementById('deleteConfirmInput').value.trim();
    const expectedName = (card.nome || '').trim();
    
    // Habilita/desabilita o botão conforme a digitação
    const confirmBtn = document.getElementById('deleteConfirmBtn');
    const errorMsg = document.getElementById('deleteError');
    const errorName = document.getElementById('deleteErrorName');
    
    if (input === expectedName) {
        confirmBtn.disabled = false;
        errorMsg.style.display = 'none';
        document.getElementById('deleteConfirmInput').style.borderColor = '#10b981';
    } else if (input.length > 0) {
        confirmBtn.disabled = true;
        errorMsg.style.display = 'block';
        errorName.textContent = expectedName;
        document.getElementById('deleteConfirmInput').style.borderColor = '#ef4444';
    } else {
        confirmBtn.disabled = true;
        errorMsg.style.display = 'none';
        document.getElementById('deleteConfirmInput').style.borderColor = '#d1d5db';
    }
}

async function confirmDelete() {
    const c = cards.find(x => x.id === deletingCardId);
    if (!c) { closeDeleteModal(); return; }

    // Remove visualmente imediatamente usando o data-attribute
    const cardElement = document.querySelector(`[data-card-id="${deletingCardId}"]`);
    if (cardElement) {
        cardElement.style.opacity = '0.3';
        cardElement.style.pointerEvents = 'none';
        cardElement.style.transform = 'scale(0.95)';
        cardElement.style.transition = 'all 0.3s ease';
        
        // Adiciona animação de "apagando"
        const deletingOverlay = document.createElement('div');
        deletingOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(239, 68, 68, 0.9);
            color: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            z-index: 10;
            backdrop-filter: blur(4px);
        `;
        deletingOverlay.innerHTML = `
            <div style="animation: pulse 1.5s ease-in-out infinite;">
                <svg style="width:32px;height:32px;margin-bottom:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                </svg>
            </div>
            <div style="font-weight:600;font-size:14px;text-align:center;">
                APAGANDO
            </div>
            <div style="font-size:12px;opacity:0.9;text-align:center;">
                Aguarde...
            </div>
        `;
        
        // Adiciona animação CSS
        if (!document.getElementById('deletingAnimationCSS')) {
            const style = document.createElement('style');
            style.id = 'deletingAnimationCSS';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(0.95); }
                }
            `;
            document.head.appendChild(style);
        }
        
        cardElement.style.position = 'relative';
        cardElement.appendChild(deletingOverlay);
    }
    
    // Fecha o modal mas mantém o ID para uso posterior
    document.getElementById('deleteOverlay').classList.remove('open');
    toggleSync(true);

    try {
        // Primeiro deleta todos os arquivos do Drive
        if (c.files && c.files.length > 0) {
            for (const f of c.files) {
                try {
                    await fetch(DRIVE_API, { 
                        method:'POST', 
                        body: JSON.stringify({ 
                            action:'delete', 
                            id: f.id 
                        }) 
                    });
                } catch(e) {
                    console.error('Erro ao deletar arquivo:', e);
                }
            }
        }
        
        // Remove o card da lista local
        cards = cards.filter(x => x.id !== deletingCardId);
        
        // Atualiza a UI
        saveLocalCards();
        renderCards();
        
        toast('Colaborador e todos os seus arquivos foram removidos permanentemente', 'success');
    } catch(e) {
        toast('Erro ao processar remoção', 'error');
        // Restaura visualmente em caso de erro
        if (cardElement) {
            cardElement.style.opacity = '1';
            cardElement.style.pointerEvents = 'auto';
            cardElement.style.transform = 'scale(1)';
            
            // Remove a overlay de deleção
            const deletingOverlay = cardElement.querySelector('div[style*="position: absolute"]');
            if (deletingOverlay) {
                deletingOverlay.remove();
            }
        }
    }
    finally {
        toggleSync(false);
        // Limpa a variável apenas no final
        deletingCardId = null;
    }
}

