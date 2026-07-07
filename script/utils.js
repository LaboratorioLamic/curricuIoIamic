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

