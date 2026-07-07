// ─── BACKUP FUNCTIONS ──────────────────────────────────────────────────
let backupFileData = null;

function openBackupModal() {
    // Atualiza informações do backup
    updateBackupInfo();
    
    // Abre o modal
    document.getElementById('backupOverlay').classList.add('open');
    
    // Configura upload zone
    setupBackupUploadZone();
}

function closeBackupModal() {
    document.getElementById('backupOverlay').classList.remove('open');
    
    // Limpa dados
    backupFileData = null;
    document.getElementById('backupFileInput').value = '';
    document.getElementById('backupWarning').style.display = 'none';
    document.getElementById('restoreConfirmInput').value = '';
    document.getElementById('restoreBtn').disabled = true;
    document.getElementById('restoreError').style.display = 'none';
}

function updateBackupInfo() {
    // Total de colaboradores
    document.getElementById('backupCardCount').textContent = cards.length;
    
    // Total de arquivos
    const totalFiles = cards.reduce((sum, card) => sum + (card.files ? card.files.length : 0), 0);
    document.getElementById('backupFileCount').textContent = totalFiles;
    
    // Última atualização
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
    document.getElementById('backupLastUpdate').textContent = dateStr;
}

function performBackup() {
    try {
        // Prepara dados completos do backup
        const backupData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            data: {
                cards: cards,
                sheetData: sheetData,
                allFiles: allFiles
            }
        };
        
        // Converte para JSON
        const jsonString = JSON.stringify(backupData, null, 2);
        
        // Cria blob e download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Nome do arquivo com timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `backup_curriculo_${timestamp}.json`;
        
        // Cria link e dispara download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Limpa URL
        URL.revokeObjectURL(url);
        
        toast('Backup baixado com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao gerar backup:', error);
        toast('Erro ao gerar backup', 'error');
    }
}

function setupBackupUploadZone() {
    const zone = document.getElementById('backupUploadZone');
    const input = document.getElementById('backupFileInput');
    
    // Click para selecionar arquivo
    zone.addEventListener('click', () => input.click());
    
    // Drag and drop
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.style.borderColor = 'var(--blue)';
        zone.style.background = '#f8fafc';
    });
    
    zone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        zone.style.borderColor = '#cbd5e1';
        zone.style.background = 'white';
    });
    
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.style.borderColor = '#cbd5e1';
        zone.style.background = 'white';
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/json') {
            handleBackupFile(files[0]);
        } else {
            toast('Por favor, selecione um arquivo JSON', 'error');
        }
    });
}

function handleBackupUpload(event) {
    const file = event.target.files[0];
    if (file && file.type === 'application/json') {
        handleBackupFile(file);
    } else {
        toast('Por favor, selecione um arquivo JSON', 'error');
    }
}

function handleBackupFile(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Valida estrutura do arquivo
            if (!data.data || !data.data.cards) {
                throw new Error('Arquivo de backup inválido');
            }
            
            backupFileData = data;
            
            // Mostra aviso de confirmação
            document.getElementById('backupWarning').style.display = 'block';
            
            // Info do arquivo
            const fileCards = data.data.cards ? data.data.cards.length : 0;
            const fileFiles = data.data.allFiles ? data.data.allFiles.length : 0;
            const fileDate = data.timestamp ? new Date(data.timestamp).toLocaleString('pt-BR') : 'Desconhecida';
            
            toast(`Arquivo carregado: ${fileCards} colaboradores, ${fileFiles} arquivos (${fileDate})`, 'success');
            
        } catch (error) {
            console.error('Erro ao ler arquivo:', error);
            toast('Erro ao ler arquivo de backup', 'error');
            backupFileData = null;
        }
    };
    
    reader.readAsText(file);
}

function validateRestoreConfirmation() {
    const input = document.getElementById('restoreConfirmInput');
    const btn = document.getElementById('restoreBtn');
    const error = document.getElementById('restoreError');
    
    if (input.value.trim() === 'SIM') {
        btn.disabled = false;
        error.style.display = 'none';
    } else {
        btn.disabled = true;
        if (input.value.trim() !== '') {
            error.style.display = 'block';
        } else {
            error.style.display = 'none';
        }
    }
}

async function performRestore() {
    if (!backupFileData) {
        toast('Nenhum arquivo de backup carregado', 'error');
        return;
    }
    
    try {
        // Mostra loading
        toggleSync(true);
        
        // Restaura dados
        const { cards: newCards, sheetData: newSheetData, allFiles: newAllFiles } = backupFileData.data;
        
        // Atualiza variáveis globais
        cards = newCards || [];
        sheetData = newSheetData || [];
        allFiles = newAllFiles || [];
        
        // Salva no Firebase
        await database.ref(FIREBASE_PATHS.cards).set(
            cards.reduce((acc, c) => { acc[c.id] = c; return acc; }, {})
        );
        
        await database.ref(FIREBASE_PATHS.sheetData).set(sheetData);
        
        await database.ref(FIREBASE_PATHS.files).set({ files: allFiles });
        
        // Atualiza interface
        populateDatalist();
        sortCards();
        renderCards();
        
        // Salva localmente
        saveLocalCards();
        
        toast('Dados restaurados com sucesso!', 'success');
        closeBackupModal();
        
    } catch (error) {
        console.error('Erro ao restaurar backup:', error);
        toast('Erro ao restaurar backup', 'error');
    } finally {
        toggleSync(false);
    }
}
