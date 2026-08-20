// ===== Componentes de UI: toast, modal, confirm, popover =====

// ---- Toast ----
function toast(msg, type = 'success', ms = 3200) {
    const cont = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const ic = type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info';
    el.innerHTML = `${icon(ic)}<span>${escapeHtml(msg)}</span>`;
    cont.appendChild(el);
    setTimeout(() => {
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 300);
    }, ms);
}

// ---- Modal ----
let _modalStack = [];

function openModal({ title, titleHtml, body, footer, size = '', onClose } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal ${size}">
            <div class="modal-header">
                ${titleHtml || `<h3>${escapeHtml(title || '')}</h3>`}
                <button class="modal-close" data-close>${icon('x')}</button>
            </div>
            <div class="modal-body"></div>
            ${footer !== null ? '<div class="modal-footer"></div>' : ''}
        </div>`;
    const bodyEl = overlay.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
    const footEl = overlay.querySelector('.modal-footer');
    if (footEl && footer) { if (typeof footer === 'string') footEl.innerHTML = footer; else footEl.appendChild(footer); }

    const close = () => {
        overlay.remove();
        _modalStack = _modalStack.filter(m => m !== ctl);
        onClose && onClose();
    };
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-close]').onclick = close;
    document.body.appendChild(overlay);

    const ctl = { close, el: overlay, body: bodyEl, footer: footEl };
    _modalStack.push(ctl);
    return ctl;
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const top = _modalStack[_modalStack.length - 1];
        if (top) top.close();
        closePopover();
    }
});

// Confirmação (sempre explícita para ações destrutivas)
function confirmDialog({ title = 'Confirmar', message = '', confirmText = 'Confirmar', danger = false }) {
    return new Promise(resolve => {
        const m = openModal({
            title,
            size: 'modal-sm',
            body: `<p class="text-2">${message}</p>`,
            footer: ''
        });
        m.footer.innerHTML = `
            <button class="btn btn-secondary" data-no>Cancelar</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${escapeHtml(confirmText)}</button>`;
        m.footer.querySelector('[data-no]').onclick = () => { m.close(); resolve(false); };
        m.footer.querySelector('[data-yes]').onclick = () => { m.close(); resolve(true); };
    });
}

// ---- Popover (menu de contexto) ----
let _popover = null;

function closePopover() {
    if (_popover) { _popover.remove(); _popover = null; }
}

// items: [{label, icon, danger, onClick}, 'sep', ...]
function openPopover(anchorEl, items) {
    closePopover();
    const pop = document.createElement('div');
    pop.className = 'popover';
    items.forEach(it => {
        if (it === 'sep') {
            pop.insertAdjacentHTML('beforeend', '<div class="pop-sep"></div>');
            return;
        }
        const el = document.createElement('div');
        el.className = `pop-item${it.danger ? ' danger' : ''}`;
        el.innerHTML = `${it.icon ? icon(it.icon) : ''}<span>${escapeHtml(it.label)}</span>`;
        el.onclick = () => { closePopover(); it.onClick && it.onClick(); };
        pop.appendChild(el);
    });
    document.body.appendChild(pop);

    const r = anchorEl.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = r.right - pw, y = r.bottom + 6;
    if (x < 8) x = r.left;
    if (y + ph > window.innerHeight - 8) y = r.top - ph - 6;
    pop.style.left = `${Math.max(8, x)}px`;
    pop.style.top = `${Math.max(8, y)}px`;
    _popover = pop;

    setTimeout(() => {
        document.addEventListener('mousedown', function h(e) {
            if (_popover && !_popover.contains(e.target)) { closePopover(); document.removeEventListener('mousedown', h); }
        });
    });
}

// ---- Filtro em popover (substitui selects de filtro) ----
// btnEl: botão âncora; options: [{value, label, sub, icon}]; valorAtual; onPick(value)
// `icon` é opcional (nome de ICONS) e entra à esquerda do rótulo — usado onde a lista é
// curta e fixa, para o item ser reconhecível antes de se ler o texto.
// `sub` é a segunda linha da opção (ex.: o CBO do cargo) — entra também na busca,
// porque é ela que distingue dois itens de mesmo nome.
// Fecha ao escolher; mostra busca quando há muitas opções.
// matchWidth: popover no mínimo tão largo quanto a âncora (usado em campo de formulário).
function openFilterPopover(btnEl, { options, value, onPick, searchable = true, allLabel, matchWidth = false }) {
    closePopover();
    const pop = document.createElement('div');
    pop.className = 'popover pop-filter';
    const list = allLabel != null ? [{ value: '', label: allLabel }, ...options] : options.slice();
    const showSearch = searchable && list.length > 6;
    if (matchWidth) pop.style.minWidth = `${btnEl.getBoundingClientRect().width}px`;

    pop.innerHTML = `
        ${showSearch ? `<div class="pop-search">${icon('search')}<input class="input" placeholder="Buscar..." data-pop-q></div>` : ''}
        <div class="pop-list" data-pop-list>${list.map(o => `
            <div class="pop-item${o.sub ? ' pop-item-2l' : ''}${o.value === value ? ' selected' : ''}" data-val="${escapeHtml(o.value)}" data-search="${escapeHtml(`${o.label || ''} ${o.sub || ''}`.toLowerCase())}">
                ${o.icon ? `<span class="pop-ico">${icon(o.icon)}</span>` : ''}
                <span class="grow">
                    <span class="pop-lbl">${escapeHtml(o.label)}</span>
                    ${o.sub ? `<span class="pop-sub">${escapeHtml(o.sub)}</span>` : ''}
                </span>
                ${o.value === value ? icon('check') : ''}
            </div>`).join('')}</div>`;
    document.body.appendChild(pop);

    pop.querySelectorAll('.pop-item').forEach(el => el.onclick = () => { closePopover(); onPick(el.dataset.val); });
    const q = pop.querySelector('[data-pop-q]');
    if (q) {
        q.addEventListener('input', () => {
            const v = q.value.toLowerCase();
            pop.querySelectorAll('.pop-item').forEach(it =>
                it.style.display = it.dataset.search.includes(v) ? '' : 'none');
        });
        setTimeout(() => q.focus(), 30);
    }

    const r = btnEl.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = r.left, y = r.bottom + 6;
    if (x + pw > window.innerWidth - 8) x = r.right - pw;
    if (y + ph > window.innerHeight - 8) y = r.top - ph - 6;
    pop.style.left = `${Math.max(8, x)}px`;
    pop.style.top = `${Math.max(8, y)}px`;
    _popover = pop;
    setTimeout(() => {
        document.addEventListener('mousedown', function h(e) {
            if (_popover && !_popover.contains(e.target) && e.target !== btnEl && !btnEl.contains(e.target)) {
                closePopover(); document.removeEventListener('mousedown', h);
            }
        });
    });
}

// ---- Campo seletor em popover (substitui <select> quando a opção precisa de 2 linhas) ----
// O <option> nativo não aceita marcação: cargos homônimos com CBO diferente ficariam
// indistinguíveis na lista. Aqui a âncora é um <button>, que tem `value` próprio e aceita
// evento 'change' — quem usa continua lendo `el.value` e ouvindo 'change' como num select.
// options: [{value, label, sub}]. Retorna { set(v), sync(), options }.
function initPickerField(btnEl, { options = [], value = '', placeholder = 'Selecione', icon: ic = '', onPick } = {}) {
    const ctl = { options: options.slice() };

    ctl.sync = () => {
        const sel = ctl.options.find(o => o.value === btnEl.value);
        btnEl.disabled = !ctl.options.length;
        btnEl.innerHTML = `
            ${ic ? icon(ic) : ''}
            <span class="picker-val">
                <span class="picker-lbl${sel ? '' : ' placeholder'}">${escapeHtml(sel ? sel.label : placeholder)}</span>
                ${sel?.sub ? `<span class="picker-sub">${escapeHtml(sel.sub)}</span>` : ''}
            </span>
            ${icon('chevronDown')}`;
    };
    // Sem disparar 'change': quem chama set() já sabe o que mudou (evita laço de re-render).
    ctl.set = v => { btnEl.value = v || ''; ctl.sync(); };
    ctl.setOptions = (opts, v) => {
        ctl.options = opts.slice();
        if (v !== undefined) btnEl.value = v || '';
        if (!ctl.options.some(o => o.value === btnEl.value)) btnEl.value = '';
        ctl.sync();
    };

    btnEl.type = 'button';
    btnEl.classList.add('picker-btn');
    btnEl.value = value || '';
    btnEl.onclick = () => openFilterPopover(btnEl, {
        options: ctl.options,
        value: btnEl.value,
        searchable: true,
        matchWidth: true,
        onPick: v => {
            btnEl.value = v;
            ctl.sync();
            btnEl.dispatchEvent(new Event('change', { bubbles: true }));
            onPick && onPick(v);
        }
    });
    ctl.sync();
    return ctl;
}

// ---- Campo de multisseleção em popover (grupos + busca + chips) ----
// Um <select multiple> nativo obriga a segurar Ctrl e não cabe lista longa com categorias;
// aqui a âncora é um <button> que guarda o escolhido em `btnEl.value` (texto separado por
// vírgula, como o dado é gravado) e dispara 'change' — quem usa lê igual a um select.
// groups: [{ grupo, itens: [string | {value, label, sub}] }] ou options: [...] sem grupo.
// Retorna { get(), set(v), sync() }.
function initMultiPickerField(btnEl, { groups = [], options = [], value = [], placeholder = 'Selecione', maxChips = 6, onChange } = {}) {
    const norm = o => typeof o === 'string' ? { value: o, label: o } : o;
    const secoes = (groups.length ? groups : [{ grupo: '', itens: options }])
        .map(g => ({ grupo: g.grupo || '', itens: (g.itens || []).map(norm) }));
    const todos = secoes.flatMap(s => s.itens);
    const rotulo = v => (todos.find(o => o.value === v) || { label: v }).label;

    const ctl = { options: todos };
    const parse = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => s.trim()).filter(Boolean);
    let sel = parse(value);

    ctl.get = () => sel.slice();

    ctl.sync = () => {
        btnEl.value = sel.join(', ');
        const extra = sel.length - maxChips;
        btnEl.innerHTML = sel.length
            ? `<span class="mpick-chips">
                    ${sel.slice(0, maxChips).map(v => `
                        <span class="mpick-chip">${escapeHtml(rotulo(v))}
                            <span class="mpick-chip-x" data-del="${escapeHtml(v)}" title="Remover">${icon('x')}</span>
                        </span>`).join('')}
                    ${extra > 0 ? `<span class="mpick-chip mpick-chip-more">+${extra}</span>` : ''}
               </span>${icon('chevronDown')}`
            : `<span class="picker-lbl placeholder">${escapeHtml(placeholder)}</span>${icon('chevronDown')}`;
        // O X do chip remove sem abrir o popover.
        btnEl.querySelectorAll('[data-del]').forEach(b => b.onclick = e => {
            e.stopPropagation();
            sel = sel.filter(v => v !== b.dataset.del);
            ctl.sync();
            btnEl.dispatchEvent(new Event('change', { bubbles: true }));
            onChange && onChange(ctl.get());
        });
    };

    ctl.set = v => { sel = parse(v); ctl.sync(); };

    btnEl.type = 'button';
    btnEl.classList.add('picker-btn', 'mpick-btn');
    btnEl.onclick = () => openMultiSelectPopover(btnEl, {
        secoes,
        selected: sel,
        onChange: arr => {
            sel = arr;
            ctl.sync();
            btnEl.dispatchEvent(new Event('change', { bubbles: true }));
            onChange && onChange(ctl.get());
        }
    });

    ctl.sync();
    return ctl;
}

// Popover da multisseleção: não fecha ao marcar (escolher 3 partes do corpo são 3 cliques,
// não 3 aberturas), busca ignorando acento e some com o cabeçalho do grupo sem resultado.
function openMultiSelectPopover(anchorEl, { secoes, selected, onChange }) {
    closePopover();
    const sel = new Set(selected);
    const pop = document.createElement('div');
    pop.className = 'popover pop-filter pop-mselect';
    pop.style.minWidth = `${Math.max(280, anchorEl.getBoundingClientRect().width)}px`;

    const chave = s => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

    pop.innerHTML = `
        <div class="pop-search">${icon('search')}<input class="input" placeholder="Buscar..." data-pop-q></div>
        <div class="pop-list" data-pop-list>${secoes.map(s => `
            <div class="pop-group" data-group>
                ${s.grupo ? `<div class="pop-group-lbl">${escapeHtml(s.grupo)}</div>` : ''}
                ${s.itens.map(o => `
                    <div class="pop-item pop-check${sel.has(o.value) ? ' selected' : ''}"
                         data-val="${escapeHtml(o.value)}"
                         data-search="${escapeHtml(chave(`${o.label} ${o.sub || ''} ${s.grupo}`))}">
                        <span class="mpick-box">${icon('check')}</span>
                        <span class="grow">
                            <span class="pop-lbl">${escapeHtml(o.label)}</span>
                            ${o.sub ? `<span class="pop-sub">${escapeHtml(o.sub)}</span>` : ''}
                        </span>
                    </div>`).join('')}
            </div>`).join('')}
            <div class="pop-empty" data-empty hidden>Nada encontrado.</div>
        </div>
        <div class="pop-foot">
            <span class="pop-count" data-count></span>
            <button type="button" class="link-inline" data-clear>Limpar</button>
        </div>`;
    document.body.appendChild(pop);

    const countEl = pop.querySelector('[data-count]');
    const emit = () => {
        countEl.textContent = sel.size ? `${sel.size} selecionada${sel.size > 1 ? 's' : ''}` : 'Nenhuma selecionada';
        onChange([...sel]);
    };

    pop.querySelectorAll('.pop-check').forEach(el => el.onclick = () => {
        const v = el.dataset.val;
        if (sel.has(v)) sel.delete(v); else sel.add(v);
        el.classList.toggle('selected', sel.has(v));
        emit();
    });
    pop.querySelector('[data-clear]').onclick = () => {
        sel.clear();
        pop.querySelectorAll('.pop-check').forEach(el => el.classList.remove('selected'));
        emit();
    };
    emit();

    const q = pop.querySelector('[data-pop-q]');
    q.addEventListener('input', () => {
        const v = chave(q.value);
        let achou = 0;
        pop.querySelectorAll('[data-group]').forEach(g => {
            let vis = 0;
            g.querySelectorAll('.pop-check').forEach(it => {
                const ok = it.dataset.search.includes(v);
                it.style.display = ok ? '' : 'none';
                if (ok) vis++;
            });
            g.hidden = !vis;
            achou += vis;
        });
        pop.querySelector('[data-empty]').hidden = !!achou;
    });
    // Enter marca a única linha que sobrou da busca — atalho de quem digitou o nome inteiro.
    q.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const vis = [...pop.querySelectorAll('.pop-check')].filter(it => it.style.display !== 'none');
        if (vis.length === 1) { vis[0].click(); q.value = ''; q.dispatchEvent(new Event('input')); }
    });
    setTimeout(() => q.focus(), 30);

    const r = anchorEl.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = r.left, y = r.bottom + 6;
    if (x + pw > window.innerWidth - 8) x = r.right - pw;
    if (y + ph > window.innerHeight - 8) y = Math.max(8, r.top - ph - 6);
    pop.style.left = `${Math.max(8, x)}px`;
    pop.style.top = `${y}px`;
    _popover = pop;
    setTimeout(() => {
        document.addEventListener('mousedown', function h(e) {
            if (_popover && !_popover.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) {
                closePopover(); document.removeEventListener('mousedown', h);
            }
        });
    });
}

// ---- Popover de multisseleção (legenda de gráfico como filtro) ----
// Diferente de openFilterPopover: NÃO fecha ao clicar, marca/desmarca vários e tem
// "Restaurar". items: [{key, label, cor}]; selected: Set; onChange(Set); onReset().
// Cada linha mostra um quadradinho da cor da série, para a legenda continuar legível.
function openMultiPopover(anchorEl, { items, selected, onChange, onReset }) {
    closePopover();
    const pop = document.createElement('div');
    pop.className = 'popover pop-multi';
    pop.innerHTML = `
        <div class="pop-list" data-pop-list>${items.map(it => `
            <div class="pop-item pop-check${selected.has(it.key) ? ' selected' : ''}" data-key="${escapeHtml(it.key)}">
                <span class="pop-swatch" style="background:${it.cor || 'var(--muted)'}"></span>
                <span class="grow">${escapeHtml(it.label)}</span>
                ${selected.has(it.key) ? icon('check') : ''}
            </div>`).join('')}</div>
        <div class="pop-sep"></div>
        <div class="pop-item pop-reset" data-reset><span class="grow">${icon('refresh')} Restaurar todos</span></div>`;
    document.body.appendChild(pop);

    const redraw = () => pop.querySelectorAll('.pop-check').forEach(el => {
        const on = selected.has(el.dataset.key);
        el.classList.toggle('selected', on);
        const chk = el.querySelector('svg.icon:last-child');
        if (on && !chk) el.insertAdjacentHTML('beforeend', icon('check'));
        if (!on && chk && chk.previousElementSibling) chk.remove();
    });

    pop.querySelectorAll('.pop-check').forEach(el => el.onclick = () => {
        const k = el.dataset.key;
        // Nunca deixa esvaziar tudo: um gráfico sem nenhuma série não diz nada.
        if (selected.has(k)) { if (selected.size > 1) selected.delete(k); }
        else selected.add(k);
        redraw();
        onChange(selected);
    });
    pop.querySelector('[data-reset]').onclick = () => { closePopover(); onReset(); };

    const r = anchorEl.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = r.right - pw, y = r.bottom + 6;
    if (x < 8) x = r.left;
    if (y + ph > window.innerHeight - 8) y = r.top - ph - 6;
    pop.style.left = `${Math.max(8, x)}px`;
    pop.style.top = `${Math.max(8, y)}px`;
    _popover = pop;
    setTimeout(() => {
        document.addEventListener('mousedown', function h(e) {
            if (_popover && !_popover.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) {
                closePopover(); document.removeEventListener('mousedown', h);
            }
        });
    });
}

// ---- Drawer (painel lateral de detalhe) ----
let _drawer = null;

function closeDrawer() {
    if (_drawer) { _drawer.overlay.remove(); _drawer.el.remove(); _drawer = null; }
}

function openDrawer({ headerHtml = '', body, onClose } = {}) {
    closeDrawer();
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    const el = document.createElement('div');
    el.className = 'drawer';
    el.innerHTML = `
        <div class="drawer-header">
            <div class="grow">${headerHtml}</div>
            <button class="modal-close" data-close>${icon('x')}</button>
        </div>
        <div class="drawer-body"></div>`;
    const bodyEl = el.querySelector('.drawer-body');
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);

    const close = () => { closeDrawer(); onClose && onClose(); };
    overlay.onclick = close;
    el.querySelector('[data-close]').onclick = close;
    document.body.appendChild(overlay);
    document.body.appendChild(el);
    _drawer = { overlay, el, body: bodyEl, close };
    return _drawer;
}

// ---- Empty state ----
function emptyState({ icon: ic = 'tool', title = 'Em construção', text = '' }) {
    return `
        <div class="empty-state">
            <div class="empty-icon">${icon(ic)}</div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(text)}</p>
        </div>`;
}
