// ─── REALTIME SYNC ──────────────────────────────────────────────────
function setupRealtimeListeners() {
    // Mostra status de conexão
    const realtimeBadge = document.getElementById('realtimeBadge');
    if (realtimeBadge) {
        realtimeBadge.style.display = 'flex';
    }
    
    // Listener para cards em tempo real
    database.ref(FIREBASE_PATHS.cards).on('value', (snapshot) => {
        const newCardsData = snapshot.val();
        if (newCardsData) {
            const newCards = Object.values(newCardsData);
            
            // Verifica se houve mudanças significativas
            if (JSON.stringify(cards) !== JSON.stringify(newCards)) {
                console.log('Atualizando cards em tempo real...');
                cards = newCards;
                sortCards();
                renderCards();
                
                // Mostra notificação sutil de atualização
                showRealtimeUpdate('Cards atualizados');
            }
        }
    });
    
    // Listener para dados da planilha em tempo real
    database.ref(FIREBASE_PATHS.sheetData).on('value', (snapshot) => {
        const newSheetData = snapshot.val();
        if (newSheetData) {
            // Verifica se houve mudanças
            if (JSON.stringify(sheetData) !== JSON.stringify(newSheetData)) {
                console.log('Atualizando dados da planilha em tempo real...');
                sheetData = newSheetData;
                populateDatalist();
                
                // Atualiza cards existentes com novos dados
                updateCardsWithSheetData();
                
                showRealtimeUpdate('Dados da planilha atualizados');
            }
        }
    });
    
    // Listener para arquivos em tempo real
    database.ref(FIREBASE_PATHS.files).on('value', (snapshot) => {
        const newFilesData = snapshot.val();
        if (newFilesData) {
            const newFiles = newFilesData.files || [];
            
            // Verifica se houve mudanças nos arquivos
            if (JSON.stringify(allFiles) !== JSON.stringify(newFiles)) {
                console.log('Atualizando arquivos em tempo real...');
                allFiles = newFiles;
                
                // Atualiza cards com novos arquivos sem重建 completa
                updateCardsWithNewFiles();
                
                showRealtimeUpdate('Arquivos atualizados');
            }
        }
    });
}

// Atualiza cards com novos arquivos sem重建 completa
function updateCardsWithNewFiles() {
    const updatedCards = cards.map(card => {
        const cardFiles = allFiles.filter(f => 
            f.name && f.name.includes(`[CARD:${card.id}]`)
        );
        
        // Se os arquivos do card mudaram, atualiza
        if (JSON.stringify(card.files || []) !== JSON.stringify(cardFiles)) {
            return {
                ...card,
                files: cardFiles,
                _noFiles: !cardFiles.length
            };
        }
        
        return card;
    });
    
    // Verifica se houve mudanças
    if (JSON.stringify(cards) !== JSON.stringify(updatedCards)) {
        cards = updatedCards;
        renderCards();
        
        // Se houver card aberto, atualiza também
        if (activeCardId) {
            const activeCard = cards.find(c => c.id === activeCardId);
            if (activeCard) {
                fillEditPane(activeCard);
            }
        }
    }
}

// Mostra notificação sutil de atualização em tempo real
function showRealtimeUpdate(message) {
    // Cria elemento de notificação
    const notification = document.createElement('div');
    notification.className = 'realtime-update';
    notification.innerHTML = `
        <div class="realtime-update-content">
            <i class="fas fa-sync-alt"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Estilo inline para a notificação
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 0.85rem;
        font-weight: 500;
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
        z-index: 1000;
        animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
        max-width: 300px;
    `;
    
    // Adiciona CSS para animações
    if (!document.getElementById('realtimeUpdateCSS')) {
        const style = document.createElement('style');
        style.id = 'realtimeUpdateCSS';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            .realtime-update-content {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .realtime-update-content i {
                animation: spin 1s linear infinite;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Remove após 3 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

