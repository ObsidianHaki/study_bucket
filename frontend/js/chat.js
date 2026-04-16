const messagesContainer = document.getElementById('messagesContainer');
const messagesInner = messagesContainer.querySelector('.messages-inner');
const questionInput = document.getElementById('questionInput');
const sendBtn = document.getElementById('sendBtn');
const welcomeScreen = document.getElementById('welcomeScreen');

let currentSessionId = null;
let thinkingInterval = null;

const thinkingStatuses = [
    'Analyzing your question...',
    'Searching knowledge base...',
    'Reading through documents...',
    'Connecting the dots...',
    'Preparing response...',
];

// Auto-resize textarea
questionInput.addEventListener('input', () => {
    questionInput.style.height = 'auto';
    questionInput.style.height = Math.min(questionInput.scrollHeight, 120) + 'px';
});

function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function startThinkingStatus(el) {
    let idx = 0;
    const statusEl = el.querySelector('.thinking-status');
    if (!statusEl) return;
    statusEl.textContent = thinkingStatuses[0];
    thinkingInterval = setInterval(() => {
        idx = (idx + 1) % thinkingStatuses.length;
        statusEl.style.opacity = '0';
        setTimeout(() => {
            statusEl.textContent = thinkingStatuses[idx];
            statusEl.style.opacity = '1';
        }, 200);
    }, 2500);
}

function stopThinkingStatus() {
    if (thinkingInterval) {
        clearInterval(thinkingInterval);
        thinkingInterval = null;
    }
}

async function sendMessage() {
    const question = questionInput.value.trim();
    if (!question) return;

    // Hide welcome
    if (welcomeScreen) welcomeScreen.style.display = 'none';

    // User message
    appendMessage(question, 'user');
    questionInput.value = '';
    questionInput.style.height = 'auto';
    sendBtn.disabled = true;

    // Add thinking state to input area
    const inputWrapper = document.querySelector('.input-wrapper');
    inputWrapper.classList.add('thinking');
    sendBtn.classList.add('thinking');
    sendBtn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="white" stroke-width="2" stroke-dasharray="40 20" /></svg>';
    questionInput.placeholder = 'luni is thinking...';

    // Thinking indicator in chat
    const thinkingEl = appendThinking();
    startThinkingStatus(thinkingEl);

    // Prepare the streaming message bubble (hidden until first token)
    const { msg: streamMsg, content: streamContent } = createBotBubble();
    streamMsg.style.display = 'none';
    let fullText = '';
    let renderPending = false;
    let responseMeta = null;

    try {
        // Get selected model from the selector
        const modelSelector = document.getElementById('modelSelector');
        const selectedModel = modelSelector ? modelSelector.value : null;
        
        await sendQueryStream(question, currentSessionId, selectedModel, {
            onSession(sessionId) {
                currentSessionId = sessionId;
                loadSessions();
            },
            onToken(token) {
                // On first token, swap thinking indicator for real message
                if (streamMsg.style.display === 'none') {
                    stopThinkingStatus();
                    thinkingEl.remove();
                    streamMsg.style.display = '';
                }
                fullText += token;
                // Throttle DOM updates to one per animation frame
                if (!renderPending) {
                    renderPending = true;
                    requestAnimationFrame(() => {
                        streamContent.innerHTML = renderContentStreaming(fullText);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        renderPending = false;
                    });
                }
            },
            onMeta(meta) {
                responseMeta = meta;
            },
            onDone() {
                streamContent.classList.remove('typewriter-cursor');
                // Final render: full viz blocks + syntax highlighting
                streamContent.innerHTML = renderContent(fullText);
                highlightCode(streamContent);
                // Append metadata panel
                if (responseMeta) {
                    streamMsg.appendChild(buildMetaPanel(responseMeta));
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            },
        });
    } catch (err) {
        stopThinkingStatus();
        thinkingEl.remove();
        streamMsg.remove();
        appendMessage('Sorry, something went wrong. Please try again.', 'bot');
        showToast(err.message, 'error');
    }

    inputWrapper.classList.remove('thinking');
    sendBtn.classList.remove('thinking');
    sendBtn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    sendBtn.disabled = false;
    questionInput.placeholder = 'Ask luni anything...';
    questionInput.focus();
}

/** Create an empty bot message bubble and append it. Returns {msg, content} elements. */
function createBotBubble() {
    const msg = document.createElement('div');
    msg.className = 'message bot';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = '<img src="/static/Luni_logo.png" alt="luni">';

    const content = document.createElement('div');
    content.className = 'message-content typewriter-cursor';

    msg.appendChild(avatar);
    msg.appendChild(content);
    messagesInner.appendChild(msg);
    return { msg, content };
}

function appendMessage(text, role, meta) {
    const msg = document.createElement('div');
    msg.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    if (role === 'bot') {
        avatar.innerHTML = '<img src="/static/Luni_logo.png" alt="luni">';
    } else {
        avatar.textContent = 'U';
    }

    const content = document.createElement('div');
    content.className = 'message-content';

    if (role === 'bot') {
        content.innerHTML = renderContent(text);
        highlightCode(content);
    } else {
        content.textContent = text;
    }

    msg.appendChild(avatar);
    msg.appendChild(content);

    // Add metadata panel if available
    if (role === 'bot' && meta) {
        msg.appendChild(buildMetaPanel(meta));
    }

    messagesInner.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

}

function appendThinking() {
    const msg = document.createElement('div');
    msg.className = 'message bot';
    msg.innerHTML = `
        <div class="message-avatar"><img src="/static/Luni_logo.png" alt="luni"></div>
        <div class="message-content">
            <div class="thinking-indicator">
                <div class="thinking-dots"><span></span><span></span><span></span></div>
                <div class="thinking-status" style="transition: opacity 0.2s ease;">Analyzing your question...</div>
                <div class="thinking-skeleton">
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                </div>
            </div>
        </div>`;
    messagesInner.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return msg;
}

function clearChat() {
    messagesInner.querySelectorAll('.message').forEach(el => el.remove());
}

function startNewChat() {
    currentSessionId = null;
    clearChat();
    if (welcomeScreen) welcomeScreen.style.display = 'flex';
    loadSessions();
    questionInput.focus();
}

// --- Sessions & Groups ---
const sessionsList = document.getElementById('sessionsList');
const sessionsEmpty = document.getElementById('sessionsEmpty');
const sessionsSearchInput = document.getElementById('sessionsSearchInput');
const sessionsSearchClear = document.getElementById('sessionsSearchClear');
let cachedGroups = [];
let cachedSessions = [];
let sessionSearchQuery = '';
let collapsedGroups = JSON.parse(localStorage.getItem('collapsedGroups') || '{}');
let contextMenuSessionId = null;
let contextMenuGroupName = null;

// Session search
sessionsSearchInput.addEventListener('input', () => {
    sessionSearchQuery = sessionsSearchInput.value.trim().toLowerCase();
    sessionsSearchClear.style.display = sessionSearchQuery ? '' : 'none';
    applySessionFilter();
});

function clearSessionSearch() {
    sessionsSearchInput.value = '';
    sessionSearchQuery = '';
    sessionsSearchClear.style.display = 'none';
    applySessionFilter();
    sessionsSearchInput.focus();
}

function applySessionFilter() {
    if (!sessionSearchQuery) {
        renderGroupedSessions(cachedSessions, cachedGroups);
        return;
    }
    const filtered = cachedSessions.filter(s =>
        s.title.toLowerCase().includes(sessionSearchQuery)
    );
    renderGroupedSessions(filtered, cachedGroups);
}

async function loadSessions() {
    try {
        const [sessions, groups] = await Promise.all([fetchSessions(), fetchGroups()]);
        cachedSessions = sessions;
        cachedGroups = groups;
        applySessionFilter();
    } catch (err) {
        console.error('Failed to load sessions:', err);
    }
}

function renderGroupedSessions(sessions, groups) {
    // Clear existing content (keep empty state element)
    sessionsList.querySelectorAll('.group-section, .session-item').forEach(el => el.remove());

    if (sessions.length === 0 && groups.length === 0) {
        sessionsEmpty.style.display = 'flex';
        return;
    }
    sessionsEmpty.style.display = 'none';

    // Build lookup: session id -> session
    const sessionMap = {};
    sessions.forEach(s => { sessionMap[s._id] = s; });

    // Track which sessions are in groups
    const groupedIds = new Set();
    groups.forEach(g => {
        (g.chat_ids || []).forEach(id => groupedIds.add(id));
    });

    // Render each group
    groups.forEach(g => {
        const section = document.createElement('div');
        section.className = 'group-section';
        const isCollapsed = collapsedGroups[g.name];

        section.innerHTML = `
            <div class="group-header" data-group="${escapeHtml(g.name)}">
                <button class="group-toggle ${isCollapsed ? 'collapsed' : ''}">
                    <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="group-icon">
                    <svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                </div>
                <span class="group-name">${escapeHtml(g.name)}</span>
                <span class="group-count">${(g.chat_ids || []).filter(id => sessionMap[id]).length}</span>
                <button class="group-menu-btn" onclick="event.stopPropagation(); showGroupActions('${escapeHtml(g.name)}', '${g._id}', this)">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                </button>
            </div>
            <div class="group-items ${isCollapsed ? 'collapsed' : ''}"></div>`;

        const header = section.querySelector('.group-header');
        header.addEventListener('click', (e) => {
            if (e.target.closest('.group-menu-btn')) return;
            const items = section.querySelector('.group-items');
            const toggle = section.querySelector('.group-toggle');
            items.classList.toggle('collapsed');
            toggle.classList.toggle('collapsed');
            collapsedGroups[g.name] = items.classList.contains('collapsed');
            localStorage.setItem('collapsedGroups', JSON.stringify(collapsedGroups));
        });

        const itemsContainer = section.querySelector('.group-items');
        (g.chat_ids || []).forEach(chatId => {
            const s = sessionMap[chatId];
            if (!s) return;
            itemsContainer.appendChild(createSessionItem(s, g.name));
        });

        sessionsList.appendChild(section);
    });

    // Ungrouped sessions
    const ungrouped = sessions.filter(s => !groupedIds.has(s._id));
    if (ungrouped.length > 0) {
        if (groups.length > 0) {
            const divider = document.createElement('div');
            divider.className = 'group-section';
            divider.innerHTML = `
                <div class="group-header ungrouped-header">
                    <div class="group-icon">
                        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <span class="group-name">Ungrouped</span>
                    <span class="group-count">${ungrouped.length}</span>
                </div>`;
            sessionsList.appendChild(divider);
        }
        ungrouped.forEach(s => {
            sessionsList.appendChild(createSessionItem(s, null));
        });
    }
}

function createSessionItem(s, groupName) {
    const div = document.createElement('div');
    div.className = 'session-item' + (s._id === currentSessionId ? ' active' : '') + (groupName ? ' in-group' : '');
    div.dataset.sessionId = s._id;
    if (groupName) div.dataset.groupName = groupName;
    div.innerHTML = `
        <div class="session-icon">
            <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="session-info">
            <div class="session-title">${escapeHtml(s.title)}</div>
            <div class="session-date">${formatDate(s.updated_at)}</div>
        </div>
        <button class="session-actions-btn" onclick="event.stopPropagation(); showSessionContextMenu('${s._id}', ${groupName ? "'" + escapeHtml(groupName) + "'" : 'null'}, this)">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>`;
    // Use both click and touchend for reliable iOS support
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.addEventListener('click', (e) => {
        if (!e.target.closest('.session-actions-btn')) openSession(s._id);
    });
    // iOS Safari: touchend fallback for portrait mode
    let touchMoved = false;
    div.addEventListener('touchstart', () => { touchMoved = false; }, {passive: true});
    div.addEventListener('touchmove', () => { touchMoved = true; }, {passive: true});
    div.addEventListener('touchend', (e) => {
        if (touchMoved || e.target.closest('.session-actions-btn')) return;
        e.preventDefault();
        openSession(s._id);
    });
    return div;
}

// --- Context menu for sessions ---
function showSessionContextMenu(sessionId, groupName, btnEl) {
    contextMenuSessionId = sessionId;
    contextMenuGroupName = groupName;
    closeAllMenus();

    const menu = document.getElementById('groupContextMenu');
    const ungroupBtn = menu.querySelector('[data-action="ungroup"]');
    ungroupBtn.style.display = groupName ? '' : 'none';

    // Position near button
    const rect = btnEl.getBoundingClientRect();
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
    menu.classList.add('visible');

    // Rename action
    menu.querySelector('[data-action="rename"]').onclick = (e) => {
        e.stopPropagation();
        closeAllMenus();
        renameChat(sessionId).catch(err => showToast('Rename error: ' + err.message, 'error'));
    };

    // Move action -> show submenu
    menu.querySelector('[data-action="move"]').onclick = (e) => {
        e.stopPropagation();
        showGroupSubmenu(sessionId, rect);
    };

    // Ungroup action
    ungroupBtn.onclick = async (e) => {
        e.stopPropagation();
        closeAllMenus();
        try {
            await removeChatFromGroup(groupName, sessionId);
            loadSessions();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // Delete action
    menu.querySelector('[data-action="delete"]').onclick = async (e) => {
        e.stopPropagation();
        closeAllMenus();
        deleteSession(sessionId);
    };

    setTimeout(() => document.addEventListener('click', closeAllMenusOnClick), 0);
}

function showGroupSubmenu(sessionId, anchorRect) {
    const submenu = document.getElementById('groupSubmenu');
    submenu.innerHTML = '';

    if (cachedGroups.length === 0) {
        submenu.innerHTML = '<div class="context-menu-empty">No groups yet</div>';
    } else {
        cachedGroups.forEach(g => {
            const btn = document.createElement('button');
            btn.className = 'context-menu-item';
            btn.innerHTML = `
                <svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                ${escapeHtml(g.name)}`;
            btn.onclick = async (e) => {
                e.stopPropagation();
                closeAllMenus();
                try {
                    await addChatToGroup(g.name, sessionId);
                    loadSessions();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            };
            submenu.appendChild(btn);
        });
    }

    // Add "New group" option
    const newBtn = document.createElement('button');
    newBtn.className = 'context-menu-item context-menu-new';
    newBtn.innerHTML = `
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New group`;
    newBtn.onclick = async (e) => {
        e.stopPropagation();
        closeAllMenus();
        const name = await showDialog({ title: 'Create group', placeholder: 'Group name...', confirmText: 'Create' });
        if (!name) return;
        try {
            await createGroup(name);
            await addChatToGroup(name, sessionId);
            loadSessions();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };
    submenu.appendChild(newBtn);

    const menuRect = document.getElementById('groupContextMenu').getBoundingClientRect();
    submenu.style.top = menuRect.top + 'px';
    submenu.style.left = menuRect.right + 4 + 'px';

    // If would overflow right, show to the left
    if (menuRect.right + 180 > window.innerWidth) {
        submenu.style.left = (menuRect.left - 180) + 'px';
    }

    submenu.classList.add('visible');
}

// --- Group actions (rename, delete) ---
function showGroupActions(groupName, groupId, btnEl) {
    closeAllMenus();
    const menu = document.createElement('div');
    menu.className = 'group-context-menu visible';
    menu.id = 'groupActionsMenu';
    menu.innerHTML = `
        <button class="context-menu-item" onclick="event.stopPropagation(); promptRenameGroup('${escapeHtml(groupName)}')">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Rename
        </button>
        <button class="context-menu-item context-menu-danger" onclick="event.stopPropagation(); confirmDeleteGroup('${groupId}', '${escapeHtml(groupName)}')">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Delete group
        </button>`;

    const rect = btnEl.getBoundingClientRect();
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.left = Math.min(rect.left, window.innerWidth - 180) + 'px';
    document.body.appendChild(menu);

    setTimeout(() => document.addEventListener('click', closeAllMenusOnClick), 0);
}

async function promptCreateGroup() {
    const name = await showDialog({ title: 'Create group', placeholder: 'Group name...', confirmText: 'Create' });
    if (!name) return;
    try {
        await createGroup(name);
        loadSessions();
        showToast('Group created', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renameChat(sessionId) {
    const session = cachedSessions.find(s => s._id === sessionId);
    const currentTitle = session ? session.title : '';
    const newTitle = await showDialog({ title: 'Rename chat', placeholder: 'Chat name...', defaultValue: currentTitle, confirmText: 'Rename' });
    if (!newTitle || newTitle === currentTitle) return;
    try {
        await renameSessionById(sessionId, newTitle);
        loadSessions();
        showToast('Chat renamed', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function promptRenameGroup(oldName) {
    closeAllMenus();
    const newName = await showDialog({ title: 'Rename group', placeholder: 'New name...', defaultValue: oldName, confirmText: 'Rename' });
    if (!newName || newName === oldName) return;
    try {
        await renameGroup(oldName, newName);
        loadSessions();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function confirmDeleteGroup(groupId, groupName) {
    closeAllMenus();
    const ok = await showDialog({
        title: 'Delete group',
        message: `Delete "${groupName}"? Chats will be ungrouped, not deleted.`,
        confirmText: 'Delete',
        danger: true,
    });
    if (!ok) return;
    try {
        await deleteGroupById(groupId);
        loadSessions();
        showToast('Group deleted', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function closeAllMenus() {
    document.getElementById('groupContextMenu')?.classList.remove('visible');
    document.getElementById('groupSubmenu')?.classList.remove('visible');
    document.getElementById('groupActionsMenu')?.remove();
    document.removeEventListener('click', closeAllMenusOnClick);
}

function closeAllMenusOnClick() {
    closeAllMenus();
}

async function openSession(sessionId) {
    try {
        const session = await fetchSession(sessionId);
        currentSessionId = sessionId;
        clearChat();
        if (welcomeScreen) welcomeScreen.style.display = 'none';

        if (session.messages) {
            session.messages.forEach(msg => {
                const role = msg.role === 'user' ? 'user' : 'bot';
                appendMessage(msg.content, role, msg.meta || null);
            });
        }

        // Update active state
        sessionsList.querySelectorAll('.session-item').forEach(el => {
            el.classList.toggle('active', el.dataset.sessionId === sessionId);
        });

        // Close sidebar on mobile
        if (isMobile()) closeAllMobileSidebars();
    } catch (err) {
        showToast('Failed to load chat', 'error');
    }
}

async function deleteSession(sessionId) {
    try {
        await deleteSessionById(sessionId);
        if (currentSessionId === sessionId) {
            startNewChat();
        }
        loadSessions();
    } catch (err) {
        showToast('Failed to delete chat', 'error');
    }
}

// --- Response metadata panel ---
function buildMetaPanel(meta) {
    const panel = document.createElement('div');
    panel.className = 'meta-panel';

    const usage = meta.usage || {};
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    const cost = calculateCost(meta.model, inputTokens, outputTokens);

    // Toggle bar
    const toggle = document.createElement('button');
    toggle.className = 'meta-toggle';
    toggle.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span class="meta-summary">
            <span class="meta-pill">${meta.chunks_retrieved || 0} chunks</span>
            <span class="meta-pill">${totalTokens.toLocaleString()} tokens</span>
            <span class="meta-pill">${formatCost(cost)}</span>
            <span class="meta-pill">${formatDuration(meta.total_ms)}</span>
        </span>
        <svg class="meta-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
    toggle.onclick = () => {
        panel.classList.toggle('expanded');
    };
    panel.appendChild(toggle);

    // Details body
    const body = document.createElement('div');
    body.className = 'meta-body';

    // Stats row
    body.innerHTML = `
        <div class="meta-stats">
            <div class="meta-stat">
                <span class="meta-stat-label">Model</span>
                <span class="meta-stat-value">${escapeHtml(meta.model || 'unknown')}</span>
            </div>
            <div class="meta-stat">
                <span class="meta-stat-label">Input tokens</span>
                <span class="meta-stat-value">${inputTokens.toLocaleString()}</span>
            </div>
            <div class="meta-stat">
                <span class="meta-stat-label">Output tokens</span>
                <span class="meta-stat-value">${outputTokens.toLocaleString()}</span>
            </div>
            <div class="meta-stat">
                <span class="meta-stat-label">Cost</span>
                <span class="meta-stat-value">${formatCost(cost)}</span>
            </div>
            <div class="meta-stat">
                <span class="meta-stat-label">Retrieval</span>
                <span class="meta-stat-value">${formatDuration(meta.retrieval_ms)}</span>
            </div>
            <div class="meta-stat">
                <span class="meta-stat-label">Generation</span>
                <span class="meta-stat-value">${formatDuration(meta.generation_ms)}</span>
            </div>
        </div>`;

    // Retrieved chunks
    if (meta.chunks && meta.chunks.length > 0) {
        const chunksSection = document.createElement('div');
        chunksSection.className = 'meta-chunks';
        chunksSection.innerHTML = `<div class="meta-chunks-title">Retrieved context</div>`;
        meta.chunks.forEach((chunk, i) => {
            const rawTitle = chunk.metadata?.Title;
            const source = (rawTitle && rawTitle !== 'No Title') ? rawTitle : (chunk.metadata?.filename || 'Unknown');
            const page = chunk.metadata?.Page != null ? ` — p.${chunk.metadata.Page}` : '';
            const score = chunk.score != null ? `${Math.round(chunk.score * 100)}%` : '—';
            const el = document.createElement('div');
            el.className = 'meta-chunk';
            el.innerHTML = `
                <div class="meta-chunk-header">
                    <span class="meta-chunk-source">${escapeHtml(source)}${page}</span>
                    <span class="meta-chunk-score">${score} match</span>
                </div>
                <div class="meta-chunk-text">${escapeHtml(chunk.text)}</div>`;
            chunksSection.appendChild(el);
        });
        body.appendChild(chunksSection);
    }

    panel.appendChild(body);
    return panel;
}

function formatDuration(ms) {
    if (ms == null) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

/** Calculate cost in USD based on model and token counts */
function calculateCost(model, inputTokens, outputTokens) {
    // Pricing per million tokens (USD)
    const pricing = {
        'claude-sonnet-4-20250514':  { input: 3, output: 15 },
        'claude-sonnet-4':           { input: 3, output: 15 },
        'claude-opus-4':             { input: 15, output: 75 },
        'claude-haiku-4':            { input: 0.80, output: 4 },
    };
    // Find matching pricing by prefix
    const key = Object.keys(pricing).find(k => (model || '').startsWith(k));
    const rates = key ? pricing[key] : { input: 3, output: 15 };
    const cost = (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
    return cost;
}

function formatCost(cost) {
    if (cost < 0.001) return `$${(cost * 100).toFixed(4)}c`;
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(3)}`;
}

// --- Scroll-to-bottom button ---
const scrollBottomBtn = document.getElementById('scrollBottomBtn');

messagesContainer.addEventListener('scroll', () => {
    const distFromBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
    scrollBottomBtn.style.display = distFromBottom > 200 ? '' : 'none';
});

function scrollToBottom() {
    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
}

// --- Keyboard shortcuts ---
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N → new chat
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        startNewChat();
    }
    // Ctrl/Cmd + K → focus search in sidebar
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const chatSidebar = document.getElementById('chatSidebar');
        if (chatSidebar.classList.contains('collapsed')) toggleChatSidebar();
        sessionsSearchInput.focus();
    }
    // Escape → close sidebars & menus
    if (e.key === 'Escape') {
        closeAllMenus();
        if (isMobile()) closeAllMobileSidebars();
    }
});