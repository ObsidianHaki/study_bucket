const libraryOverlay = document.getElementById('libraryOverlay');
const libraryBody = document.getElementById('libraryBody');
const libraryCount = document.getElementById('libraryCount');
const libraryCountBadge = document.getElementById('libraryCountBadge');
const libraryLoading = document.getElementById('libraryLoading');
const librarySearchInput = document.getElementById('librarySearchInput');

let libraryFiles = [];
let activeFilter = null;
let searchQuery = '';

librarySearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    applyFilters();
});

async function openLibrary() {
    libraryOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
    libraryLoading.style.display = 'flex';
    libraryCount.style.display = 'none';

    // Remove previous content
    const oldGrid = libraryBody.querySelector('.library-grid, .library-empty');
    if (oldGrid) oldGrid.remove();
    document.getElementById('libraryAlphabet').style.display = 'none';
    document.getElementById('librarySearch').style.display = 'none';
    librarySearchInput.value = '';
    searchQuery = '';

    try {
        const files = await fetchAllDocuments();
        libraryLoading.style.display = 'none';
        renderLibrary(files);
    } catch (err) {
        libraryLoading.style.display = 'none';
        renderLibraryEmpty();
        showToast(err.message, 'error');
    }
}

function closeLibrary() {
    libraryOverlay.classList.remove('visible');
    document.body.style.overflow = '';
}

function handleLibraryOverlayClick(e) {
    if (e.target === libraryOverlay) closeLibrary();
}

// Close on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && libraryOverlay.classList.contains('visible')) {
        closeLibrary();
    }
});

function renderLibrary(files) {
    if (!files || files.length === 0) {
        document.getElementById('libraryAlphabet').style.display = 'none';
        document.getElementById('librarySearch').style.display = 'none';
        renderLibraryEmpty();
        return;
    }

    libraryFiles = files.slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    activeFilter = null;
    searchQuery = '';
    librarySearchInput.value = '';

    libraryCount.style.display = 'flex';
    libraryCountBadge.textContent = files.length;
    document.getElementById('librarySearch').style.display = 'block';

    renderAlphabetBar();
    renderLibraryGrid(libraryFiles);
}

function renderAlphabetBar() {
    const bar = document.getElementById('libraryAlphabet');
    bar.innerHTML = '';
    bar.style.display = 'flex';

    const firstLetters = new Set(
        libraryFiles.map(f => f.charAt(0).toUpperCase()).filter(c => /[A-Z]/.test(c))
    );

    // "All" button
    const allBtn = document.createElement('button');
    allBtn.className = 'library-alphabet-btn active';
    allBtn.textContent = 'All';
    allBtn.style.width = 'auto';
    allBtn.style.padding = '0 10px';
    allBtn.onclick = () => filterByLetter(null);
    bar.appendChild(allBtn);

    for (let i = 65; i <= 90; i++) {
        const letter = String.fromCharCode(i);
        const btn = document.createElement('button');
        btn.className = 'library-alphabet-btn';
        if (!firstLetters.has(letter)) btn.classList.add('disabled');
        btn.textContent = letter;
        btn.onclick = () => filterByLetter(letter);
        bar.appendChild(btn);
    }
}

function filterByLetter(letter) {
    activeFilter = letter;

    // Clear search when picking a letter
    searchQuery = '';
    librarySearchInput.value = '';

    // Update active state on buttons
    document.querySelectorAll('.library-alphabet-btn').forEach(btn => {
        btn.classList.remove('active');
        if (letter === null && btn.textContent === 'All') btn.classList.add('active');
        if (btn.textContent === letter) btn.classList.add('active');
    });

    applyFilters();
}

function applyFilters() {
    let filtered = libraryFiles;

    // Apply alphabet filter
    if (activeFilter) {
        filtered = filtered.filter(f => f.charAt(0).toUpperCase() === activeFilter);
    }

    // Apply search query
    if (searchQuery) {
        filtered = filtered.filter(f => f.toLowerCase().includes(searchQuery));
    }

    libraryCountBadge.textContent = filtered.length;

    // Remove old grid/empty
    const old = libraryBody.querySelector('.library-grid, .library-empty');
    if (old) old.remove();

    if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'library-empty';
        const reason = searchQuery
            ? `No documents matching "${escapeHtml(searchQuery)}"`
            : `No documents starting with "${activeFilter}"`;
        empty.innerHTML = `<p>${reason}.</p>`;
        libraryBody.appendChild(empty);
    } else {
        renderLibraryGrid(filtered);
    }
}

function renderLibraryGrid(files) {
    const old = libraryBody.querySelector('.library-grid');
    if (old) old.remove();

    const grid = document.createElement('div');
    grid.className = 'library-grid';

    files.forEach(filename => {
        const card = document.createElement('div');
        card.className = 'library-card';
        card.innerHTML = `
            <div class="library-card-icon">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="library-card-name">${escapeHtml(filename)}</div>
            <div class="library-card-actions">
                <div class="library-card-badge">Indexed</div>
                <button class="library-card-download" onclick="event.stopPropagation(); downloadDocument('${filename.replace(/'/g, "\\'")}')" title="Download PDF">
                    <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
            </div>`;
        grid.appendChild(card);
    });

    libraryBody.appendChild(grid);
}

function renderLibraryEmpty() {
    libraryCount.style.display = 'none';
    const empty = document.createElement('div');
    empty.className = 'library-empty';
    empty.innerHTML = `
        <div class="library-empty-icon">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <p>No documents uploaded yet.<br>Upload a PDF from the sidebar to get started.</p>`;
    libraryBody.appendChild(empty);
}