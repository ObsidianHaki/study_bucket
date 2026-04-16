// --- Theme toggle ---
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('luni-theme', next);
}

// Restore saved theme on load
(function initTheme() {
    const saved = localStorage.getItem('luni-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
})();

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function isMobile() {
    return window.innerWidth <= 768;
}

let toastStack = 0;
function showToast(msg, type) {
    const icon = type === 'success'
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <span class="toast-text">${escapeHtml(msg)}</span>
        <div class="toast-progress"></div>`;

    // Stack multiple toasts
    const offset = toastStack * 56;
    toast.style.top = (16 + offset) + 'px';
    toastStack++;

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => {
            toast.remove();
            toastStack = Math.max(0, toastStack - 1);
        }, 300);
    }, 3000);
}

/**
 * Show a styled dialog that replaces browser prompt() and confirm().
 * Returns a Promise that resolves with the input value (for prompt)
 * or true (for confirm), or null if cancelled.
 *
 * Usage:
 *   const name = await showDialog({ title: 'New group', placeholder: 'Group name...' });
 *   const ok = await showDialog({ title: 'Delete?', message: 'This cannot be undone.', confirmText: 'Delete', danger: true });
 */
function showDialog({ title, message, placeholder, defaultValue, confirmText, danger }) {
    const isPrompt = placeholder != null;
    if (isPrompt) {
        const val = window.prompt(title + (message ? '\n' + message : ''), defaultValue || '');
        return Promise.resolve(val ? val.trim() || null : null);
    } else {
        const ok = window.confirm(title + (message ? '\n' + message : ''));
        return Promise.resolve(ok || null);
    }
}

// --- Prism autoloader CDN path ---
if (Prism.plugins.autoloader) {
    Prism.plugins.autoloader.languages_path = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/';
}

// --- Markdown rendering ---

/**
 * FAST render for streaming — markdown only, no viz block processing.
 * Keeps mermaid/html code blocks as plain <pre><code> during streaming
 * so we don't create/destroy iframes and mermaid containers on every token.
 */
function renderContentStreaming(text) {
    return marked.parse(text);
}

/**
 * FULL render for final output — processes viz blocks + syntax highlighting.
 * Called once when streaming is done, or when loading history messages.
 */
function renderContent(text) {
    let html = marked.parse(text);

    // Post-process: replace mermaid code blocks with sandboxed iframe previews
    html = html.replace(
        /<pre><code class="language-mermaid">([\s\S]*?)<\/code>\s*<\/pre>/g,
        (_, code) => {
            const tmp = document.createElement('textarea');
            tmp.innerHTML = code;
            const decoded = tmp.value.trim();

            // Sanitize mermaid source: auto-quote node labels containing special chars
            // Only for graph/flowchart diagrams where [/text/] is misread as shapes
            const firstLineLower = decoded.split('\n')[0].trim().toLowerCase();
            const isGraph = firstLineLower.startsWith('graph') || firstLineLower.startsWith('flowchart');
            const sanitized = isGraph
                ? decoded.replace(
                    /\[([^\]"]*[\/\\{}()][^\]"]*)\]/g,
                    (m, inner) => '["' + inner + '"]'
                  )
                : decoded;

            // Detect current theme for mermaid color config
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';

            // Build a self-contained HTML page that loads mermaid in the iframe
            const mermaidHtml = `<pre id="src" style="display:none">${sanitized.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
<div id="diagram" style="display:flex;justify-content:center;padding:24px;background:transparent;min-height:300px;overflow-x:auto;"></div>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"><\/script>
<script>
var isLight=${isLight};
mermaid.initialize({startOnLoad:false,fontSize:16,
  theme:isLight?'default':'dark',
  themeVariables:isLight?{
    primaryColor:'#7c3aed',primaryTextColor:'#1e1b4b',primaryBorderColor:'#7c3aed',
    lineColor:'#6d28d9',secondaryColor:'#ede9fe',tertiaryColor:'#ddd6fe',
    background:'transparent',mainBkg:'#f5f3ff',nodeBorder:'#7c3aed',
    clusterBkg:'#faf5ff',clusterBorder:'#a78bfa',
    titleColor:'#1e1b4b',edgeLabelBackground:'#ffffff',textColor:'#312e81',
    labelTextColor:'#1e1b4b',nodeTextColor:'#1e1b4b',
    signalColor:'#6d28d9',signalTextColor:'#1e1b4b',
    actorBkg:'#f5f3ff',actorBorder:'#7c3aed',actorTextColor:'#1e1b4b',
    actorLineColor:'#a78bfa',noteBkgColor:'#faf5ff',noteTextColor:'#1e1b4b',noteBorderColor:'#c4b5fd'
  }:{
    primaryColor:'#7c3aed',primaryTextColor:'#e0e7ff',primaryBorderColor:'#a78bfa',
    lineColor:'#6366f1',secondaryColor:'#1e1b4b',tertiaryColor:'#172554',
    background:'transparent',mainBkg:'#1c1c2e',nodeBorder:'#818cf8',
    clusterBkg:'#0f0f1a',clusterBorder:'#4338ca',
    titleColor:'#e0e7ff',edgeLabelBackground:'#1c1c2e',textColor:'#c7d2fe',
    labelTextColor:'#e0e7ff',
    signalColor:'#a78bfa',signalTextColor:'#e0e7ff',
    actorBkg:'#1c1c2e',actorBorder:'#7c3aed',actorTextColor:'#e0e7ff',
    actorLineColor:'#4338ca',noteBkgColor:'#1e1b4b',noteTextColor:'#e0e7ff',noteBorderColor:'#4338ca'
  },
  flowchart:{htmlLabels:true,curve:'basis',useMaxWidth:false,padding:24,nodeSpacing:60,rankSpacing:70},
  sequence:{mirrorActors:false,useMaxWidth:false,actorFontSize:15,noteFontSize:14,messageFontSize:14,boxMargin:12},
  mindmap:{useMaxWidth:false,padding:20}
});
var src=document.getElementById('src').textContent.trim();
mermaid.render('mmd',src).then(function(r){document.getElementById('diagram').innerHTML=r.svg;}).catch(function(e){document.getElementById('diagram').innerHTML='<pre style="color:#f87171;padding:12px;">Diagram error: '+e.message+'<\\/pre>';});
<\/script>`;
            const encodedSrc = encodeURIComponent(mermaidHtml);

            // Detect diagram type for the label
            const firstLine = decoded.split('\n')[0].trim().toLowerCase();
            let diagramType = 'Diagram';
            if (firstLine.startsWith('graph') || firstLine.startsWith('flowchart')) diagramType = 'Flowchart';
            else if (firstLine.startsWith('sequence')) diagramType = 'Sequence';
            else if (firstLine.startsWith('class')) diagramType = 'Class Diagram';
            else if (firstLine.startsWith('state')) diagramType = 'State Machine';
            else if (firstLine.startsWith('mindmap')) diagramType = 'Mind Map';
            else if (firstLine.startsWith('timeline')) diagramType = 'Timeline';
            else if (firstLine.startsWith('pie')) diagramType = 'Pie Chart';
            else if (firstLine.startsWith('er')) diagramType = 'ER Diagram';
            else if (firstLine.startsWith('gantt')) diagramType = 'Gantt Chart';

            return `<div class="viz-container viz-diagram">
                <div class="viz-header">
                    <span class="viz-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ${diagramType}</span>
                </div>
                <div class="html-preview">
                    <iframe sandbox="allow-scripts allow-same-origin" srcdoc="" data-src="${encodedSrc}" onload="initHtmlPreview(this)"></iframe>
                </div>
            </div>`;
        }
    );

    // Post-process: replace html code blocks with sandboxed iframe previews
    html = html.replace(
        /<pre><code class="language-html">([\s\S]*?)<\/code>\s*<\/pre>/g,
        (_, code) => {
            // Use a temporary element to reliably decode all HTML entities
            const tmp = document.createElement('textarea');
            tmp.innerHTML = code;
            const decoded = tmp.value;
            const encodedSrc = encodeURIComponent(decoded);
            return `<div class="viz-container viz-interactive">
                <div class="viz-header">
                    <span class="viz-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> Interactive</span>
                    <button class="viz-toggle" onclick="toggleVizCode(this)">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                        <span>Show code</span>
                    </button>
                </div>
                <div class="html-preview">
                    <iframe sandbox="allow-scripts allow-same-origin" srcdoc="" data-src="${encodedSrc}" onload="initHtmlPreview(this)"></iframe>
                </div>
                <div class="html-code-block" style="display:none;"><pre><code class="language-html">${code}</code></pre></div>
            </div>`;
        }
    );

    return html;
}

/** Apply Prism.js syntax highlighting + code header to all code blocks */
function highlightCode(container) {
    container.querySelectorAll('pre > code').forEach(block => {

        const pre = block.parentElement;
        // Don't add header twice
        if (pre.querySelector('.code-header')) return;

        // Extract language name from class
        const langClass = [...block.classList].find(c => c.startsWith('language-'));
        const lang = langClass ? langClass.replace('language-', '') : 'code';

        // Create header with language label + copy button with icon
        const header = document.createElement('div');
        header.className = 'code-header';
        header.innerHTML = `
            <span class="code-lang">${escapeHtml(lang)}</span>
            <button class="code-copy" onclick="copyCode(this)">
                <svg class="copy-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <svg class="check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:none"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Copy</span>
            </button>`;
        pre.insertBefore(header, block);

        Prism.highlightElement(block);
    });
}

/** Copy code block content to clipboard */
function copyCode(btn) {
    const pre = btn.closest('pre');
    const code = pre.querySelector('code');
    navigator.clipboard.writeText(code.textContent).then(() => {
        btn.querySelector('.copy-icon').style.display = 'none';
        btn.querySelector('.check-icon').style.display = '';
        btn.querySelector('span').textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.querySelector('.copy-icon').style.display = '';
            btn.querySelector('.check-icon').style.display = 'none';
            btn.querySelector('span').textContent = 'Copy';
            btn.classList.remove('copied');
        }, 2000);
    });
}

/** Initialize HTML preview iframe with proper styling */
function initHtmlPreview(iframe) {
    const encoded = iframe.getAttribute('data-src');
    if (!encoded) return;
    const htmlContent = decodeURIComponent(encoded);

    const hasFullDoc = htmlContent.includes('<html') || htmlContent.includes('<!DOCTYPE');
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    // Full design system injected into previews for modern rendering
    const themeStyles = `
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap">
        <style>
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

            :root {
                --bg: ${isLight ? '#ffffff' : '#0a0a12'};
                --bg-card: ${isLight ? '#ffffff' : '#141420'};
                --bg-surface: ${isLight ? '#f5f3ff' : '#1c1c2e'};
                --bg-hover: ${isLight ? '#ede9fe' : '#252538'};
                --text: ${isLight ? '#1e1b4b' : '#e0e7ff'};
                --text-secondary: ${isLight ? '#4338ca' : '#a5b4fc'};
                --text-muted: ${isLight ? '#6b7280' : '#6b7294'};
                --accent: #7c3aed;
                --accent-light: ${isLight ? '#ede9fe' : '#312e81'};
                --border: ${isLight ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.2)'};
                --radius: 12px;
                --shadow: ${isLight ? '0 1px 3px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.3)'};
                --success: #10b981;
                --warning: #f59e0b;
                --error: #ef4444;
                --info: #6366f1;
            }

            body {
                background: var(--bg);
                color: var(--text);
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 14px;
                line-height: 1.6;
                padding: 20px 24px;
                -webkit-font-smoothing: antialiased;
            }

            /* Typography */
            h1, h2, h3, h4, h5, h6 {
                color: var(--text);
                font-weight: 600;
                line-height: 1.3;
                margin-bottom: 0.5em;
            }
            h1 { font-size: 1.8em; letter-spacing: -0.02em; }
            h2 { font-size: 1.4em; letter-spacing: -0.01em; }
            h3 { font-size: 1.15em; }
            p { margin-bottom: 1em; color: var(--text); }
            a { color: var(--accent); text-decoration: none; transition: opacity 0.15s; }
            a:hover { opacity: 0.8; }
            strong { font-weight: 600; color: var(--text); }
            small { color: var(--text-muted); font-size: 0.85em; }

            /* Cards */
            .card, [class*="card"] {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 20px;
                box-shadow: var(--shadow);
                transition: border-color 0.2s, box-shadow 0.2s;
            }
            .card:hover { border-color: var(--accent); box-shadow: 0 4px 16px rgba(124,58,237,0.1); }

            /* Buttons */
            button, .btn, [class*="btn"] {
                font-family: inherit;
                font-size: 13px;
                font-weight: 500;
                padding: 8px 18px;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            button:not([class]), .btn {
                background: linear-gradient(135deg, #7c3aed, #6366f1);
                color: white;
                box-shadow: 0 2px 8px rgba(124,58,237,0.25);
            }
            button:not([class]):hover, .btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 16px rgba(124,58,237,0.35);
            }
            button:active { transform: translateY(0); }

            /* Inputs */
            input, select, textarea {
                font-family: inherit;
                font-size: 13px;
                padding: 8px 14px;
                border: 1px solid var(--border);
                border-radius: 8px;
                background: var(--bg-surface);
                color: var(--text);
                outline: none;
                transition: border-color 0.2s, box-shadow 0.2s;
                width: 100%;
            }
            input:focus, select:focus, textarea:focus {
                border-color: var(--accent);
                box-shadow: 0 0 0 3px rgba(124,58,237,0.12);
            }
            input::placeholder, textarea::placeholder { color: var(--text-muted); }

            /* Tables */
            table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                border: 1px solid var(--border);
                border-radius: var(--radius);
                overflow: hidden;
                font-size: 13px;
            }
            th {
                background: var(--bg-surface);
                color: var(--text-secondary);
                font-weight: 600;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                padding: 10px 16px;
                text-align: left;
                border-bottom: 1px solid var(--border);
            }
            td {
                padding: 10px 16px;
                border-bottom: 1px solid var(--border);
                color: var(--text);
            }
            tr:last-child td { border-bottom: none; }
            tr:hover td { background: var(--bg-hover); }

            /* Lists */
            ul, ol { padding-left: 1.5em; margin-bottom: 1em; }
            li { margin-bottom: 0.4em; }
            li::marker { color: var(--accent); }

            /* Code */
            code {
                font-family: 'SF Mono', 'Fira Code', monospace;
                font-size: 0.9em;
                background: var(--accent-light);
                padding: 2px 6px;
                border-radius: 4px;
                color: var(--text-secondary);
            }
            pre {
                background: var(--bg-surface);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 16px;
                overflow-x: auto;
                font-size: 13px;
                line-height: 1.6;
            }
            pre code { background: none; padding: 0; }

            /* Badges / Tags */
            .badge, .tag, [class*="badge"], [class*="tag"] {
                display: inline-flex;
                align-items: center;
                padding: 3px 10px;
                border-radius: 100px;
                font-size: 11px;
                font-weight: 600;
                background: var(--accent-light);
                color: var(--accent);
            }

            /* Progress bars */
            progress, .progress, [class*="progress"] {
                width: 100%;
                height: 8px;
                border-radius: 100px;
                overflow: hidden;
                background: var(--bg-surface);
                border: none;
                appearance: none;
            }
            progress::-webkit-progress-bar { background: var(--bg-surface); border-radius: 100px; }
            progress::-webkit-progress-value { background: linear-gradient(90deg, #7c3aed, #6366f1); border-radius: 100px; }

            /* Utility */
            .flex { display: flex; }
            .grid { display: grid; }
            .gap-2 { gap: 8px; }
            .gap-4 { gap: 16px; }
            .items-center { align-items: center; }
            .justify-between { justify-content: space-between; }
            .text-center { text-align: center; }
            .mb-4 { margin-bottom: 16px; }
            .mt-4 { margin-top: 16px; }
            .p-4 { padding: 16px; }
            .rounded { border-radius: var(--radius); }

            /* Divider */
            hr {
                border: none;
                height: 1px;
                background: var(--border);
                margin: 16px 0;
            }

            /* Scrollbar */
            ::-webkit-scrollbar { width: 4px; height: 4px; }
            ::-webkit-scrollbar-thumb { background: ${isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'}; border-radius: 4px; }

            /* Charts & SVG */
            svg text { font-family: 'Inter', sans-serif; fill: var(--text); }
            svg { max-width: 100%; }

            /* Animations */
            @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
            body > * { animation: fadeIn 0.3s ease both; }
            body > *:nth-child(2) { animation-delay: 0.05s; }
            body > *:nth-child(3) { animation-delay: 0.1s; }
            body > *:nth-child(4) { animation-delay: 0.15s; }
        </style>`;

    iframe.srcdoc = hasFullDoc ? htmlContent : `<!DOCTYPE html><html><head><meta charset="UTF-8">${themeStyles}</head><body>${htmlContent}</body></html>`;
    iframe.removeAttribute('data-src');

    // Auto-resize iframe to content height
    iframe.addEventListener('load', () => {
        try {
            const h = iframe.contentDocument.documentElement.scrollHeight;
            iframe.style.height = Math.min(h + 20, 900) + 'px';
        } catch (_) { /* cross-origin fallback */ }
    });
}

/** Toggle between code view and rendered view */
function toggleVizCode(btn) {
    const container = btn.closest('.viz-container');
    const preview = container.querySelector('.html-preview');
    const codeBlock = container.querySelector('.html-code-block');
    const label = btn.querySelector('span');

    if (codeBlock.style.display === 'none') {
        codeBlock.style.display = 'block';
        preview.style.display = 'none';
        label.textContent = 'Show preview';
    } else {
        codeBlock.style.display = 'none';
        preview.style.display = 'block';
        label.textContent = 'Show code';
    }
}

