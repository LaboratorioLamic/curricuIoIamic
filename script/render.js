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

