// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBo8RHN7GfVk7g8SMISlzzYIkY5KCcrtUg",
  authDomain: "curriculolamic.firebaseapp.com",
  databaseURL: "https://curriculolamic-default-rtdb.firebaseio.com",
  projectId: "curriculolamic",
  storageBucket: "curriculolamic.firebasestorage.app",
  messagingSenderId: "325255911078",
  appId: "1:325255911078:web:126cc8b86537b5fcebc667"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const DRIVE_API = "https://script.google.com/macros/s/AKfycbzzqR-O-ViBpkcNtNccer2O-8PlWuFVgKd1MdJEEs94nYEfL25mMyt-fmfpmnNHXurURA/exec";
const SHEET_API = "https://script.google.com/macros/s/AKfycbwzlnsjXywhXMq1jErG0BiMfMH7Wrv8GQWzwq65xlaxKXEGvPHs5z2WZbXnbio5bDFFlQ/exec";
const MASTER_PWD = "Lamic6530@";

// Firebase paths
const FIREBASE_PATHS = {
    cards: 'curr_colab_cards',
    sheetData: 'curr_colab_sheet_data',
    sheetHash: 'curr_colab_sheet_hash',
    files: 'curr_colab_files'
};

let sheetData = [];      
let cards = [];          
let allFiles = [];       
let deletingCardId = null;
let activeCardId = null;
let modalMode = 'view';  
let isAuthenticated = false;
let pendingAction = null; 
let pendingId = null;

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
        top: 20px;
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

// ─── SEARCH EXPANDIBLE ───────────────────────────────────────────────
function toggleSearch() {
    const expandable = document.getElementById('searchExpandable');
    const searchInput = document.getElementById('searchInput');
    
    if (expandable.classList.contains('active')) {
        closeSearch();
    } else {
        expandable.classList.add('active');
        searchInput.focus();
    }
}

function closeSearch() {
    const expandable = document.getElementById('searchExpandable');
    const searchInput = document.getElementById('searchInput');
    
    expandable.classList.remove('active');
    searchInput.value = '';
    renderCards(); // Limpa a busca ao fechar
}

// Fecha a busca ao pressionar ESC fora do input
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const expandable = document.getElementById('searchExpandable');
        const searchInput = document.getElementById('searchInput');
        
        if (expandable.classList.contains('active') && document.activeElement !== searchInput) {
            closeSearch();
        }
    }
});

// Fecha a busca ao clicar fora
document.addEventListener('click', function(event) {
    const container = document.getElementById('searchContainer');
    const expandable = document.getElementById('searchExpandable');
    
    if (expandable.classList.contains('active') && 
        !container.contains(event.target)) {
        closeSearch();
    }
});

// Carrega dados persistidos do Firebase com listeners em tempo real
async function loadLocalData() {
    try {
        // Carrega cards do Firebase (uma vez)
        const cardsSnapshot = await database.ref(FIREBASE_PATHS.cards).once('value');
        const cardsData = cardsSnapshot.val();
        if (cardsData) {
            cards = Object.values(cardsData);
            renderCards();
        }
        
        // Carrega dados da planilha do Firebase se existir (uma vez)
        const sheetSnapshot = await database.ref(FIREBASE_PATHS.sheetData).once('value');
        const sheetDataFromFirebase = sheetSnapshot.val();
        if (sheetDataFromFirebase) {
            sheetData = sheetDataFromFirebase;
            populateDatalist();
        }
        
        // Adiciona listeners em tempo real para cards
        setupRealtimeListeners();
        
    } catch(e) {
        console.error('Erro ao carregar dados do Firebase:', e);
        // Fallback para localStorage se Firebase falhar
        const savedCards = localStorage.getItem('curr_colab_cards_fallback');
        if (savedCards) {
            cards = JSON.parse(savedCards);
            renderCards();
        }
    }
    
    // Não carrega mais o estado de autenticação do localStorage
    // para exigir senha sempre que a página for atualizada
    isAuthenticated = false;
}

// Salva a lista de cards no Firebase
async function saveLocalCards() {
    try {
        // Salva no Firebase
        await database.ref(FIREBASE_PATHS.cards).set(cards);
        console.log('Cards salvos no Firebase');
    } catch(e) {
        console.error('Erro ao salvar no Firebase:', e);
        // Fallback para localStorage
        localStorage.setItem('curr_colab_cards_fallback', JSON.stringify(cards));
        console.log('Cards salvos no localStorage (fallback)');
    }
}

// Gera hash simples para detectar mudanças nos dados
function generateDataHash(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i <str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

async function loadSheet() {
    try {
        const res = await fetch(SHEET_API);
        const rows = await res.json();
        const newSheetData = rows.map(row => ({
            nome:     row.colunaB || row[0] || '',
            telefone: row.colunaC || row[1] || '',
            genero:   row.colunaD || row[2] || '',
            uc:       row.colunaE || row[3] || '',
            funcao:   row.colunaF || row[4] || ''
        }));
        
        // Gera hash dos novos dados
        const newHash = generateDataHash(newSheetData);
        const savedHash = await database.ref(FIREBASE_PATHS.sheetHash).once('value').then(s => s.val());
        
        // Verifica se houve mudança
        if (newHash !== savedHash) {
            console.log('Dados da planilha atualizados');
            sheetData = newSheetData;
            
            // Salva no Firebase
            try {
                await database.ref(FIREBASE_PATHS.sheetData).set(sheetData);
                await database.ref(FIREBASE_PATHS.sheetHash).set(newHash);
                console.log('Dados da planilha salvos no Firebase');
            } catch(e) {
                console.error('Erro ao salvar no Firebase:', e);
                // Fallback para localStorage
                localStorage.setItem('curr_colab_sheet_data_fallback', JSON.stringify(sheetData));
                localStorage.setItem('curr_colab_sheet_hash_fallback', newHash);
            }
            
            populateDatalist();
            
            // SEMPRE reconstrói os cards quando a planilha é atualizada
            // Isso garante que TODAS as alterações sejam aplicadas automaticamente
            if (allFiles.length > 0) {
                rebuildCards();
            } else {
                // Mesmo sem arquivos, atualiza os cards existentes
                updateCardsWithSheetData();
            }
            
            // Força uma atualização completa para garantir sincronização
            setTimeout(() => {
                if (allFiles.length > 0) {
                    rebuildCards();
                } else {
                    updateCardsWithSheetData();
                }
            }, 1000);
            
        } else {
            console.log('Dados da planilha inalterados, usando cache');
            // Mesmo sem mudanças, verifica se há inconsistências para corrigir
            updateCardsWithSheetData();
        }
    } catch(e) { 
        console.error('Erro ao carregar planilha:', e);
        toast('Erro ao carregar planilha', 'error'); 
    }
}

function populateDatalist() {
    ['nameDatalist','addNameDatalist'].forEach(id => {
        const dl = document.getElementById(id);
        if (!dl) return;
        dl.innerHTML = '';
        sheetData.forEach(r => {
            if (!r.nome) return;
            const opt = document.createElement('option');
            opt.value = r.nome;
            dl.appendChild(opt);
        });
    });
}

// Atualiza cards existentes com novos dados da planilha
function updateCardsWithSheetData() {
    let hasChanges = false;
    
    cards.forEach(card => {
        const sheetRow = sheetData.find(r => 
            r.nome.trim().toLowerCase() === card.nome.trim().toLowerCase()
        );
        
        if (sheetRow) {
            // Verifica se houve mudanças nos dados
            if (card.telefone !== sheetRow.telefone ||
                card.genero !== sheetRow.genero ||
                card.uc !== sheetRow.uc ||
                card.funcao !== sheetRow.funcao) {
                
                // Atualiza os dados do card
                card.telefone = sheetRow.telefone || '';
                card.genero = sheetRow.genero || '';
                card.uc = sheetRow.uc || '';
                card.funcao = sheetRow.funcao || '';
                hasChanges = true;
            }
        }
    });
    
    if (hasChanges) {
        saveLocalCards();
        sortCards();  // Ordena os cards atualizados
        renderCards();
        console.log('Cards atualizados com novos dados da planilha');
    }
}

async function loadDriveFiles() {
    toggleSync(true);
    try {
        const res = await fetch(`${DRIVE_API}?action=list`);
        allFiles = await res.json();
        rebuildCards();
    } catch(e) { toast('Erro ao carregar arquivos', 'error'); }
    finally { toggleSync(false); }
}

function rebuildCards() {
    const cardMap = {};
    
    // Processa arquivos do Drive para vincular aos cards existentes ou novos
    allFiles.forEach(f => {
        const m = f.name.match(/\[CARD:([^\]]+)\]/);
        if (!m) return;
        const cid = m[1];
        if (!cardMap[cid]) {
            const nameMatch = f.name.match(/^(.+?)\s*\[CARD:/);
            const storedName = nameMatch ? nameMatch[1].replace(/\s*\[.*/, '').trim() : '';
            // Sempre busca os dados mais recentes da planilha
            const sheetRow = sheetData.find(r => r.nome.trim().toLowerCase() === storedName.trim().toLowerCase()) || {};
            cardMap[cid] = {
                id: cid,
                nome: storedName,
                telefone: sheetRow.telefone || '',
                genero: sheetRow.genero || '',
                uc: sheetRow.uc || '',
                funcao: sheetRow.funcao || '',
                files: []
            };
        }
        cardMap[cid].files.push(f);
    });

    // Mantém cards que foram criados manualmente (standalone) e ainda não têm arquivos
    let existingStandalone = cards.filter(c => !cardMap[c.id] && c._noFiles);
    
    // Atualiza os cards standalone com dados mais recentes da planilha
    existingStandalone = existingStandalone.map(card => {
        const sheetRow = sheetData.find(r => 
            r.nome.trim().toLowerCase() === card.nome.trim().toLowerCase()
        );
        
        if (sheetRow) {
            // Atualiza com os dados mais recentes da planilha
            return {
                ...card,
                telefone: sheetRow.telefone || '',
                genero: sheetRow.genero || '',
                uc: sheetRow.uc || '',
                funcao: sheetRow.funcao || ''
            };
        }
        return card;
    });
    
    // Atualiza a lista global de cards
    cards = [...Object.values(cardMap), ...existingStandalone];
    
    // Ordenação: primeiro por UC (ordem crescente), depois por nome
    cards.sort((a, b) => {
        const ucA = (a.uc || '').trim().toLowerCase();
        const ucB = (b.uc || '').trim().toLowerCase();
        
        // Compara por UC primeiro
        if (ucA < ucB) return -1;
        if (ucA > ucB) return 1;
        
        // Se UC for igual, compara por nome
        const nameA = (a.nome || '').trim().toLowerCase();
        const nameB = (b.nome || '').trim().toLowerCase();
        
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        
        return 0;
    });
    
    saveLocalCards(); // Persiste no LocalStorage
    renderCards();
}

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
}

// ─── RENDER ─────────────────────────────────────────────────────
function formatGenero(val) {
    if (!val) return '—';
    const clean = val.toString().toUpperCase().trim();
    if (clean === 'F') return 'Feminino';
    if (clean === 'M') return 'Masculino';
    return val;
}

// Ordena os cards sem reconstruir
function sortCards() {
    cards.sort((a, b) => {
        const ucA = (a.uc || '').trim().toLowerCase();
        const ucB = (b.uc || '').trim().toLowerCase();
        
        // Compara por UC primeiro
        if (ucA < ucB) return -1;
        if (ucA > ucB) return 1;
        
        // Se UC for igual, compara por nome
        const nameA = (a.nome || '').trim().toLowerCase();
        const nameB = (b.nome || '').trim().toLowerCase();
        
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        
        return 0;
    });
}

function renderCards() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const grid  = document.getElementById('cardsGrid');
    grid.innerHTML = '';

    const filtered = cards.filter(c =>
        c.nome.toLowerCase().includes(query) ||
        (c.funcao || '').toLowerCase().includes(query) ||
        (c.uc || '').toLowerCase().includes(query)
    );

    document.getElementById('countLabel').textContent = `${filtered.length} colaborador${filtered.length !== 1 ? 'es' : ''}`;

    if (!filtered.length) {
        grid.innerHTML = `<div class="empty-state">
            <div class="empty-icon"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
            <h3>Nenhum colaborador encontrado</h3>
            <p>Adicione um novo colaborador ou ajuste a busca.</p>
        </div>`;
        return;
    }

    filtered.forEach(c => grid.appendChild(buildCard(c)));
}

// Função segura para atualizar cards sem perder dados
function safeUpdateCards(callback) {
    try {
        // Salva estado atual dos cards
        const currentCards = [...cards];
        
        // Executa a operação
        const result = callback();
        
        // Verifica se algum card foi perdido
        if (cards.length < currentCards.length) {
            console.warn('Cards foram perdidos durante a operação, restaurando...');
            cards = currentCards;
        }
        
        return result;
    } catch (error) {
        console.error('Erro na operação de cards:', error);
        return null;
    }
}

function buildCard(c) {
    const initials = (c.nome || '?').split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
    const cleanPhone = (c.telefone || '').replace(/\D/g, '');
    const div = document.createElement('div');
    div.className = 'card';
    div.setAttribute('data-card-id', c.id); // Adiciona ID para referência
    div.innerHTML = `
        <div class="card-accent"></div>
        <div class="card-body">
            <div class="card-avatar"><span>${initials}</span></div>
            <div class="card-name">${c.nome || '—'}</div>
            <div class="card-role">${c.funcao || 'Sem função'}</div>
            <div class="card-meta">
                <div class="card-meta-item">
                    <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.38 2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.36 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.34 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    ${c.telefone || '—'}
                    ${cleanPhone ? `<a href="https://wa.me/55${cleanPhone}" target="_blank" class="whatsapp-link" onclick="event.stopPropagation()">
                        <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .004 5.412.001 12.04c0 2.123.554 4.197 1.607 6.037L0 24l6.105-1.602a11.834 11.834 0 005.937 1.61h.005c6.637 0 12.05-5.414 12.053-12.04a11.83 11.83 0 00-3.51-8.413z"/></svg>
                    </a>` : ''}
                </div>
                <div class="card-meta-item">
                    <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    ${c.uc || '—'}
                </div>
            </div>
        </div>
        <div class="card-footer">
            <div class="card-attach-count">
                <svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                ${c.files ? c.files.length : 0} anexo${c.files && c.files.length !== 1 ? 's' : ''}
            </div>
            <div class="card-actions">
                <button class="btn-view" title="Visualizar" onclick="openViewModal('${c.id}')">
                    <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="btn-edit" title="Editar" onclick="checkAuth('edit', '${c.id}')">
                    <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-delete" title="Remover" onclick="checkAuth('delete', '${c.id}')">
                    <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </button>
            </div>
        </div>`;
    return div;
}

// ─── MODALS ──────────────────────────────────────────────────────
function openViewModal(id) {
    activeCardId = id;
    const c = cards.find(x => x.id === id);
    if (!c) return;
    fillModalHeader(c);
    fillViewPane(c);
    
    // Esconde as abas e mostra apenas o conteúdo de visualização
    document.querySelector('.modal-tabs').style.display = 'none';
    document.getElementById('viewPane').style.display = '';
    document.getElementById('editPane').style.display = 'none';
    document.getElementById('editFooter').style.display = 'none';
    
    document.getElementById('mainOverlay').classList.add('open');
}

function openEditModal(id) {
    activeCardId = id;
    const c = cards.find(x => x.id === id);
    if (!c) return;
    
    // Primeiro preenche todos os dados
    fillModalHeader(c);
    fillEditPane(c);
    
    // Esconde completamente a aba de visualização
    document.getElementById('tabViewBtn').style.display = 'none';
    document.getElementById('tabEditBtn').style.display = '';
    
    // Mostra as abas e abre o modal
    document.querySelector('.modal-tabs').style.display = '';
    document.getElementById('mainOverlay').classList.add('open');
    
    // Depois ativa a aba de edição com delay
    setTimeout(() => {
        switchModalTab('edit');
    }, 50);
}

function fillModalHeader(c) {
    const initials = (c.nome || '?').split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
    document.getElementById('modalInitials').textContent = initials;
    document.getElementById('modalNameDisp').textContent = c.nome || '—';
    document.getElementById('modalRoleDisp').textContent = c.funcao || 'Sem função';
}

function fillViewPane(c) {
    document.getElementById('vNome').textContent     = c.nome     || '—';
    document.getElementById('vTelefone').textContent = c.telefone || '—';
    document.getElementById('vGenero').textContent   = formatGenero(c.genero);
    document.getElementById('vUC').textContent       = c.uc       || '—';
    document.getElementById('vFuncao').textContent   = c.funcao   || '—';

    const list = document.getElementById('viewAttachList');
    list.innerHTML = '';
    if (!c.files || !c.files.length) {
        list.innerHTML = '<div class="no-attach">Nenhum anexo cadastrado.</div>';
        return;
    }
    c.files.forEach(f => {
        // Remove o nome do colaborador e o tag CARD do nome do arquivo
        let cleanName = f.name.replace(/^[^\[]*\s*\[CARD:[^\]]+\]\s*/, '').trim();
        const a = document.createElement('a');
        a.href = f.url; a.target = '_blank'; a.className = 'attach-item';
        a.innerHTML = `
            <svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <span class="attach-name" title="${cleanName}" id="viewFileName_${f.id}">${cleanName}</span>
            <span class="attach-open"><svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></span>`;
        list.appendChild(a);
    });
}

function fillEditPane(c) {
    document.getElementById('editCardId').value = c.id;
    document.getElementById('editNome').value     = c.nome     || '';
    document.getElementById('editTelefone').value = c.telefone || '';
    document.getElementById('editGenero').value   = formatGenero(c.genero);
    document.getElementById('editUC').value       = c.uc       || '';
    document.getElementById('editFuncao').value   = c.funcao   || '';

    const list = document.getElementById('editAttachList');
    list.innerHTML = '';
    if (c.files) {
        c.files.forEach(f => {
            // Remove o nome do colaborador e o tag CARD do nome do arquivo
            let cleanName = f.name.replace(/^[^\[]*\s*\[CARD:[^\]]+\]\s*/, '').trim();
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;margin-bottom:6px;';
            row.innerHTML = `
                <svg style="width:13px;height:13px;stroke:#3b82f6;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                <input type="text" value="${cleanName}" 
                       id="fileName_${f.id}"
                       style="flex:1;font-size:0.8rem;font-weight:500;color:#1d4ed8;background:transparent;border:1px solid transparent;padding:2px 4px;border-radius:4px;" 
                       onfocus="startEditingFileName('${f.id}', this)" 
                       onblur="finishEditingFileName('${f.id}', this, '${c.id}')" 
                       title="Clique para editar o nome do arquivo">
                <button onclick="deleteFile('${f.id}')" style="background:none;border:none;cursor:pointer;padding:2px;" title="Remover">
                    <svg style="width:14px;height:14px;stroke:#ef4444;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>`;
            list.appendChild(row);
        });
    }
    document.getElementById('editUploadProg').classList.remove('visible');
}

document.getElementById('editNome').addEventListener('input', function() {
    const name = this.value.trim();
    const row = sheetData.find(r => r.nome.trim().toLowerCase() === name.toLowerCase());
    if (row) {
        document.getElementById('editTelefone').value = row.telefone || '';
        document.getElementById('editGenero').value   = formatGenero(row.genero);
        document.getElementById('editUC').value       = row.uc       || '';
        document.getElementById('editFuncao').value   = row.funcao   || '';
    }
});

function switchModalTab(tab) {
    // Verifica se há upload em andamento
    const uploadProg = document.getElementById('editUploadProg');
    if (uploadProg && uploadProg.classList.contains('visible')) {
        toast('Não é possível trocar de aba enquanto há upload em andamento', 'error');
        return;
    }
    
    modalMode = tab;
    document.getElementById('viewPane').style.display   = tab === 'view' ? '' : 'none';
    document.getElementById('editPane').style.display   = tab === 'edit' ? '' : 'none';
    document.getElementById('editFooter').style.display = tab === 'edit' ? '' : 'none';
    document.getElementById('tabViewBtn').classList.toggle('active', tab === 'view');
    document.getElementById('tabEditBtn').classList.toggle('active', tab === 'edit');
}

function closeModal() { 
    // Verifica se há upload em andamento
    const uploadProg = document.getElementById('editUploadProg');
    if (uploadProg && uploadProg.classList.contains('visible')) {
        toast('Não é possível fechar enquanto há upload em andamento', 'error');
        return;
    }
    
    document.getElementById('mainOverlay').classList.remove('open');
    // Restaura as abas ao estado normal
    document.getElementById('tabViewBtn').style.display = '';
    document.getElementById('tabEditBtn').style.display = '';
    
    // Garante que o estado de upload seja desativado
    setModalUploadingState(false);
}

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

// ─── ADD CARD ────────────────────────────────────────────────────
function openAddModal() { document.getElementById('addOverlay').classList.add('open'); }
function closeAddModal() { document.getElementById('addOverlay').classList.remove('open'); }

function fillAddFields() {
    const name = document.getElementById('addNome').value.trim();
    const row = sheetData.find(r => r.nome.trim().toLowerCase() === name.toLowerCase());
    if (row) {
        // Preenche apenas se o campo estiver vazio ou com "-"
        const telefoneField = document.getElementById('addTelefone');
        const generoField = document.getElementById('addGenero');
        const ucField = document.getElementById('addUC');
        const funcaoField = document.getElementById('addFuncao');
        
        if (!telefoneField.value || telefoneField.value.trim() === '-' || telefoneField.value.trim() === '—') {
            telefoneField.value = row.telefone || '';
        }
        if (!generoField.value || generoField.value.trim() === '-' || generoField.value.trim() === '—') {
            generoField.value = formatGenero(row.genero);
        }
        if (!ucField.value || ucField.value.trim() === '-' || ucField.value.trim() === '—') {
            ucField.value = row.uc || '';
        }
        if (!funcaoField.value || funcaoField.value.trim() === '-' || funcaoField.value.trim() === '—') {
            funcaoField.value = row.funcao || '';
        }
    }
}

function saveNewCard() {
    const name = document.getElementById('addNome').value.trim();
    if (!name) { toast('Informe o nome do colaborador', 'error'); return; }
    const row = sheetData.find(r => r.nome.trim().toLowerCase() === name.toLowerCase());
    if (!row) { toast('Nome não encontrado na planilha', 'error'); return; }

    const newCard = {
        id:       crypto.randomUUID(),
        nome:     name,
        telefone: row.telefone || '',
        genero:   row.genero   || '',
        uc:       row.uc       || '',
        funcao:   row.funcao   || '',
        files:    [],
        _noFiles: true
    };
    cards.push(newCard);
    closeAddModal();
    document.getElementById('addNome').value = '';
    ['addTelefone','addGenero','addUC','addFuncao'].forEach(i => document.getElementById(i).value = '');
    
    saveLocalCards(); // Persiste no LocalStorage
    sortCards();      // Apenas ordena os cards
    renderCards();   // Renderiza os cards
    toast(`Colaborador ${name} adicionado!`, 'success');
}

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

// ─── UTILS ────────────────────────────────────────────────────────
function toggleSync(show) {
    const badge = document.getElementById('syncBadge');
    if (badge) badge.classList.toggle('visible', show);
}

function toast(msg, type='success') {
    const wrap = document.getElementById('toastWrap');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icon = type === 'success'
        ? '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    el.innerHTML = icon + msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}
