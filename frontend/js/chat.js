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
        await sendQueryStream(question, currentSessionId, {
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
                renderMermaidBlocks(streamContent);
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

    if (role === 'bot') {
        renderMermaidBlocks(content);
    }
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

// --- Sessions ---
const sessionsList = document.getElementById('sessionsList');
const sessionsEmpty = document.getElementById('sessionsEmpty');

async function loadSessions() {
    try {
        const data = await fetchSessions();
        renderSessions(data);
    } catch (err) {
        console.error('Failed to load sessions:', err);
    }
}

function renderSessions(sessions) {
    sessionsList.querySelectorAll('.session-item').forEach(el => el.remove());

    if (sessions.length === 0) {
        sessionsEmpty.style.display = 'flex';
        return;
    }
    sessionsEmpty.style.display = 'none';

    sessions.forEach(s => {
        const div = document.createElement('div');
        div.className = 'session-item' + (s._id === currentSessionId ? ' active' : '');
        div.innerHTML = `
            <div class="session-icon">
                <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="session-info">
                <div class="session-title">${escapeHtml(s.title)}</div>
                <div class="session-date">${formatDate(s.updated_at)}</div>
            </div>
            <button class="session-delete" onclick="event.stopPropagation(); deleteSession('${s._id}')">
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>`;
        div.addEventListener('click', () => openSession(s._id));
        sessionsList.appendChild(div);
    });
}

async function openSession(sessionId) {
    try {
        const session = await fetchSession(sessionId);

        currentSessionId = sessionId;

        // Clear chat and hide welcome
        clearChat();
        if (welcomeScreen) welcomeScreen.style.display = 'none';

        // Render all messages
        if (session.messages) {
            session.messages.forEach(msg => {
                const role = msg.role === 'user' ? 'user' : 'bot';
                appendMessage(msg.content, role, msg.meta || null);
            });
        }

        // Update active state in sidebar
        sessionsList.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
        const items = sessionsList.querySelectorAll('.session-item');
        items.forEach(el => {
            if (el.querySelector('.session-title')?.textContent === session.title) {
                el.classList.add('active');
            }
        });
        loadSessions();
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
    const totalTokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);

    // Toggle bar
    const toggle = document.createElement('button');
    toggle.className = 'meta-toggle';
    toggle.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span class="meta-summary">
            <span class="meta-pill">${meta.chunks_retrieved || 0} chunks</span>
            <span class="meta-pill">${totalTokens.toLocaleString()} tokens</span>
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
                <span class="meta-stat-value">${(usage.input_tokens || 0).toLocaleString()}</span>
            </div>
            <div class="meta-stat">
                <span class="meta-stat-label">Output tokens</span>
                <span class="meta-stat-value">${(usage.output_tokens || 0).toLocaleString()}</span>
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