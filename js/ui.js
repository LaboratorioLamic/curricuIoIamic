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
// btnEl: botão âncora; options: [{value, label}]; valorAtual; onPick(value)
// Fecha ao escolher; mostra busca quando há muitas opções.
function openFilterPopover(btnEl, { options, value, onPick, searchable = true, allLabel }) {
    closePopover();
    const pop = document.createElement('div');
    pop.className = 'popover pop-filter';
    const list = allLabel != null ? [{ value: '', label: allLabel }, ...options] : options.slice();
    const showSearch = searchable && list.length > 6;

    pop.innerHTML = `
        ${showSearch ? `<div class="pop-search">${icon('search')}<input class="input" placeholder="Buscar..." data-pop-q></div>` : ''}
        <div class="pop-list" data-pop-list>${list.map(o => `
            <div class="pop-item${o.value === value ? ' selected' : ''}" data-val="${escapeHtml(o.value)}" data-search="${escapeHtml((o.label || '').toLowerCase())}">
                <span class="grow">${escapeHtml(o.label)}</span>
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
