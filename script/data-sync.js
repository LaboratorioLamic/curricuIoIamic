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

