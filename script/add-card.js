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

