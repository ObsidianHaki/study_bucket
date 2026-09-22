// --- Source scope picker: limit retrieval of the current chat to selected documents ---
const scopeBtn = document.getElementById('scopeBtn');
const scopeLabel = document.getElementById('scopeLabel');
const scopePicker = document.getElementById('scopePicker');
const scopeList = document.getElementById('scopeList');
const scopeSearchInput = document.getElementById('scopeSearchInput');
const scopeSubtitle = document.getElementById('scopeSubtitle');
const scopeClearBtn = document.getElementById('scopeClearBtn');

// Filenames the current chat is scoped to. Empty = all documents.
let selectedDocuments = [];
let scopeAllDocuments = [];

function getSelectedDocuments() {
    return [...selectedDocuments];
}

/** Replace the scope (e.g. when opening a chat) without persisting it. */
function setSelectedDocuments(documents) {
    selectedDocuments = [...(documents || [])];
    updateScopeLabel();
    if (scopePicker.classList.contains('visible')) renderScopeList();
}

function displayName(filename) {
    return filename.replace(/\.pdf$/i, '');
}

function updateScopeLabel() {
    const n = selectedDocuments.length;
    if (n === 0) {
        scopeLabel.textContent = 'All books';
        scopeBtn.title = 'Searching all books. Click to choose sources';
    } else if (n === 1) {
        scopeLabel.textContent = displayName(selectedDocuments[0]);
        scopeBtn.title = `Searching only: ${selectedDocuments[0]}`;
    } else {
        scopeLabel.textContent = `${n} books`;
        scopeBtn.title = `Searching only:\n${selectedDocuments.join('\n')}`;
    }
    scopeBtn.classList.toggle('active', n > 0);
    scopeSubtitle.textContent = n === 0
        ? 'Searching all books'
        : `Only searching ${n} selected book${n > 1 ? 's' : ''}`;
    scopeClearBtn.style.visibility = n > 0 ? 'visible' : 'hidden';
}

async function persistScope() {
    updateScopeLabel();
    // A chat that doesn't exist yet gets its scope with the first message
    if (!currentSessionId) return;
    try {
        await setSessionDocuments(currentSessionId, selectedDocuments);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function toggleScopePicker(e) {
    e?.stopPropagation();
    if (scopePicker.classList.contains('visible')) {
        closeScopePicker();
        return;
    }
    closeAllMenus();
    scopePicker.classList.add('visible');
    scopeSearchInput.value = '';
    scopeList.innerHTML = '<div class="context-menu-empty">Loading…</div>';
    document.addEventListener('click', closeScopePickerOnOutsideClick);
    try {
        scopeAllDocuments = (await fetchAllDocuments()).sort((a, b) => a.localeCompare(b));
        renderScopeList();
        if (!isMobile()) scopeSearchInput.focus();
    } catch (err) {
        scopeList.innerHTML = '<div class="context-menu-empty">Failed to load documents</div>';
    }
}

function closeScopePicker() {
    scopePicker.classList.remove('visible');
    document.removeEventListener('click', closeScopePickerOnOutsideClick);
}

function closeScopePickerOnOutsideClick(e) {
    if (!scopePicker.contains(e.target) && !scopeBtn.contains(e.target)) closeScopePicker();
}

function renderScopeList() {
    const query = scopeSearchInput.value.trim().toLowerCase();
    // Keep selected documents visible even if they vanished from the library
    const all = [...new Set([...scopeAllDocuments, ...selectedDocuments])];
    const docs = query ? all.filter(d => d.toLowerCase().includes(query)) : all;

    scopeList.innerHTML = '';
    if (all.length === 0) {
        scopeList.innerHTML = '<div class="context-menu-empty">No documents uploaded yet</div>';
        return;
    }
    if (docs.length === 0) {
        scopeList.innerHTML = '<div class="context-menu-empty">No matches</div>';
        return;
    }

    docs.forEach(doc => {
        const label = document.createElement('label');
        label.className = 'scope-item';
        label.innerHTML = `
            <span class="scope-item-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
            <span class="scope-item-name" title="${escapeHtml(doc)}">${escapeHtml(displayName(doc))}</span>
            <input type="checkbox" ${selectedDocuments.includes(doc) ? 'checked' : ''}>
            <span class="scope-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span>`;
        label.classList.toggle('selected', selectedDocuments.includes(doc));
        label.querySelector('input').addEventListener('change', (e) => {
            label.classList.toggle('selected', e.target.checked);
            if (e.target.checked) {
                if (!selectedDocuments.includes(doc)) selectedDocuments.push(doc);
            } else {
                selectedDocuments = selectedDocuments.filter(d => d !== doc);
            }
            persistScope();
        });
        scopeList.appendChild(label);
    });
}

function clearScope() {
    selectedDocuments = [];
    renderScopeList();
    persistScope();
}

scopeSearchInput.addEventListener('input', renderScopeList);
scopeSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeScopePicker();
        questionInput.focus();
    }
});

updateScopeLabel();
