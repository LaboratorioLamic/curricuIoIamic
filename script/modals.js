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

