// --- Upload ---
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
let fileIdCounter = 0;

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    // Only accept single PDF files, reject folders and multiple files
    if (e.dataTransfer.items) {
        const items = [...e.dataTransfer.items];
        if (items.length > 1) {
            showToast('Please upload a single PDF file', 'error');
            return;
        }
        const item = items[0];
        if (item.webkitGetAsEntry) {
            const entry = item.webkitGetAsEntry();
            if (entry && entry.isDirectory) {
                showToast('Folders are not supported. Please upload a single PDF file.', 'error');
                return;
            }
        }
    }
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') uploadFile(file);
    else showToast('Please upload a PDF file', 'error');
});
fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) uploadFile(fileInput.files[0]);
});

async function uploadFile(file) {
    const itemId = 'file-' + (++fileIdCounter);
    addFileItem(itemId, file.name, 'Uploading...', 'uploading');

    try {
        const res = await uploadFileToServer(file);
        if (res.status === 409) {
            updateFileStatus(itemId, 'Already exists', 'error');
            showToast(`"${file.name}" is already uploaded`, 'error');
            return;
        }
        updateFileStatus(itemId, 'Processed & indexed', 'success');
        showToast(`${file.name} uploaded successfully`, 'success');
    } catch (err) {
        updateFileStatus(itemId, 'Upload failed', 'error');
        showToast(err.message, 'error');
    }
    fileInput.value = '';
}

function addFileItem(id, name, status, statusClass) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.id = id;
    div.innerHTML = `
        <div class="file-icon">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="file-info">
            <div class="file-name">${name}</div>
            <div class="file-status ${statusClass}">${status}</div>
        </div>
        <button class="file-download" onclick="event.stopPropagation(); downloadDocument('${name.replace(/'/g, "\\'")}')" title="Download">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>`;
    fileList.appendChild(div);
}

function updateFileStatus(id, status, statusClass) {
    const el = document.getElementById(id);
    if (!el) return;
    const s = el.querySelector('.file-status');
    s.textContent = status;
    s.className = 'file-status ' + statusClass;
}

// --- Sidebar toggles ---
const sidebarOverlay = document.getElementById('sidebarOverlay');

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const btn = document.getElementById('filesToggle');
    if (isMobile()) {
        const isOpen = sidebar.classList.contains('mobile-open');
        closeAllMobileSidebars();
        if (!isOpen) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('mobile-open');
            sidebarOverlay.classList.add('visible');
        }
    } else {
        sidebar.classList.toggle('collapsed');
        btn.classList.toggle('active');
    }
}

function toggleChatSidebar() {
    const sidebar = document.getElementById('chatSidebar');
    const btn = document.getElementById('historyToggle');
    if (isMobile()) {
        const isOpen = sidebar.classList.contains('mobile-open');
        closeAllMobileSidebars();
        if (!isOpen) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('mobile-open');
            sidebarOverlay.classList.add('visible');
        }
    } else {
        sidebar.classList.toggle('collapsed');
        btn.classList.toggle('active');
    }
}

function closeAllMobileSidebars() {
    const sidebar = document.getElementById('sidebar');
    const chatSidebar = document.getElementById('chatSidebar');
    sidebar.classList.remove('mobile-open');
    sidebar.classList.add('collapsed');
    chatSidebar.classList.remove('mobile-open');
    chatSidebar.classList.add('collapsed');
    sidebarOverlay.classList.remove('visible');
    document.getElementById('filesToggle').classList.remove('active');
    document.getElementById('historyToggle').classList.remove('active');
}

// Close mobile sidebars on resize to desktop
window.addEventListener('resize', () => {
    if (!isMobile()) {
        closeAllMobileSidebars();
    }
});