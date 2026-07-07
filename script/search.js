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

