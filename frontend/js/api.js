const API_BASE = window.location.origin;

async function uploadFileToServer(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/documents/upload`, { method: 'POST', body: formData });
    if (res.status === 409) return res;
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return res;
}

/**
 * Send a query and read the SSE stream.
 * Calls onSession(sessionId) once, onToken(text) per chunk, onDone() at end.
 */
async function sendQueryStream(question, sessionId, { onSession, onToken, onDone, onMeta }) {
    let url = `${API_BASE}/query?question=${encodeURIComponent(question)}`;
    if (sessionId) {
        url += `&session_id=${encodeURIComponent(sessionId)}`;
    }

    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) throw new Error(`Error (${res.status})`);

    // Fallback: if body stream isn't available, read as text and parse
    if (!res.body) {
        const text = await res.text();
        const lines = text.split('\n');
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
                const payload = JSON.parse(line.slice(6));
                if (payload.type === 'session' && onSession) onSession(payload.session_id);
                else if (payload.type === 'token' && onToken) onToken(payload.token);
                else if (payload.type === 'meta' && onMeta) onMeta(payload);
                else if (payload.type === 'done' && onDone) onDone();
            } catch (e) {
                console.warn('SSE parse error (fallback):', e, line);
            }
        }
        return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by double newline)
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 2);

            if (chunk.startsWith('data: ')) {
                try {
                    const payload = JSON.parse(chunk.slice(6));
                    if (payload.type === 'session' && onSession) onSession(payload.session_id);
                    else if (payload.type === 'token' && onToken) onToken(payload.token);
                    else if (payload.type === 'meta' && onMeta) onMeta(payload);
                    else if (payload.type === 'done' && onDone) onDone();
                } catch (e) {
                    console.warn('SSE parse error:', e, chunk);
                }
            }

            boundary = buffer.indexOf('\n\n');
        }
    }

    // Process any remaining data in buffer
    if (buffer.trim().startsWith('data: ')) {
        try {
            const payload = JSON.parse(buffer.trim().slice(6));
            if (payload.type === 'session' && onSession) onSession(payload.session_id);
            else if (payload.type === 'token' && onToken) onToken(payload.token);
            else if (payload.type === 'meta' && onMeta) onMeta(payload);
            else if (payload.type === 'done' && onDone) onDone();
        } catch (e) {
            console.warn('SSE parse error (final):', e, buffer);
        }
    }
}

async function fetchSessions() {
    const res = await fetch(`${API_BASE}/sessions`);
    if (!res.ok) throw new Error('Failed to load sessions');
    return res.json();
}

async function fetchSession(sessionId) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
    if (!res.ok) throw new Error('Failed to load session');
    return res.json();
}

async function deleteSessionById(sessionId) {
    await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
}

async function fetchAllDocuments() {
    const res = await fetch(`${API_BASE}/documents/all`);
    if (!res.ok) throw new Error('Failed to load documents');
    return res.json();
}

function downloadDocument(filename) {
    const a = document.createElement('a');
    a.href = `${API_BASE}/documents/download/${encodeURIComponent(filename)}`;
    a.download = filename;
    a.click();
}