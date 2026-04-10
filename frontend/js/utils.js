// --- Theme toggle ---
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('luni-theme', next);
    // Update mermaid theme
    mermaid.initialize({
        startOnLoad: false,
        suppressErrorRendering: true,
        securityLevel: 'loose',
        theme: next === 'light' ? 'default' : 'dark',
        themeVariables: next === 'light' ? mermaidLightVars : mermaidDarkVars,
        fontFamily: 'Inter, sans-serif',
        flowchart: { htmlLabels: true, curve: 'basis', useMaxWidth: true },
    });
    // Re-render all existing mermaid diagrams with the new theme
    reRenderMermaidBlocks();
}

/** Re-render all already-rendered mermaid diagrams (e.g. after theme switch) */
async function reRenderMermaidBlocks() {
    const blocks = document.querySelectorAll('.mermaid-block[data-processed]');
    for (const block of blocks) {
        // Retrieve original source from the SVG's aria-label or stored data
        let source = block.getAttribute('data-source');
        if (!source) continue;

        // Generate a fresh ID to avoid collisions
        const newId = `mermaid-re-${++mermaidIdCounter}`;
        try {
            const { svg } = await mermaid.render(newId + '-svg', source);
            block.innerHTML = svg;
        } catch (_) {
            // Leave the existing render in place if re-render fails
        }
    }
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

function showToast(msg, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// --- Prism autoloader CDN path ---
if (Prism.plugins.autoloader) {
    Prism.plugins.autoloader.languages_path = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/';
}

// --- Mermaid initialization ---
const mermaidDarkVars = {
    primaryColor: '#7c3aed',
    primaryTextColor: '#fafafa',
    primaryBorderColor: '#a78bfa',
    lineColor: '#a78bfa',
    secondaryColor: '#18181b',
    tertiaryColor: '#131316',
    background: '#09090b',
    mainBkg: '#18181b',
    nodeBorder: '#a78bfa',
    clusterBkg: '#131316',
    titleColor: '#fafafa',
    edgeLabelBackground: '#18181b',
};

const mermaidLightVars = {
    primaryColor: '#7c3aed',
    primaryTextColor: '#111122',
    primaryBorderColor: '#7c3aed',
    lineColor: '#6d28d9',
    secondaryColor: '#ede9fe',
    tertiaryColor: '#e8e8f0',
    background: '#ffffff',
    mainBkg: '#f3f0ff',
    nodeBorder: '#7c3aed',
    clusterBkg: '#f5f3ff',
    titleColor: '#111122',
    edgeLabelBackground: '#ffffff',
    nodeTextColor: '#111122',
    textColor: '#111122',
    labelTextColor: '#111122',
    signalTextColor: '#111122',
    actorTextColor: '#111122',
    noteBkgColor: '#f5f3ff',
    noteTextColor: '#111122',
    activationBorderColor: '#7c3aed',
    sequenceNumberColor: '#ffffff',
};

const savedTheme = localStorage.getItem('luni-theme') || 'dark';
mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,
    securityLevel: 'loose',
    theme: savedTheme === 'light' ? 'default' : 'dark',
    themeVariables: savedTheme === 'light' ? mermaidLightVars : mermaidDarkVars,
    fontFamily: 'Inter, sans-serif',
    flowchart: { htmlLabels: true, curve: 'basis', useMaxWidth: true },
});

let mermaidIdCounter = 0;

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

    // Post-process: replace mermaid code blocks with render containers
    html = html.replace(
        /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
        (_, code) => {
            const id = `mermaid-${++mermaidIdCounter}`;
            const decoded = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
            return `<div class="viz-container">
                <div class="viz-header">
                    <span class="viz-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Diagram</span>
                </div>
                <div class="mermaid-block" id="${id}">${decoded}</div>
            </div>`;
        }
    );

    // Post-process: replace html code blocks with sandboxed iframe previews
    html = html.replace(
        /<pre><code class="language-html">([\s\S]*?)<\/code><\/pre>/g,
        (_, code) => {
            const decoded = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
            const encodedSrc = encodeURIComponent(decoded);
            return `<div class="viz-container">
                <div class="viz-header">
                    <span class="viz-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> Interactive</span>
                    <button class="viz-toggle" onclick="toggleVizCode(this)">Show code</button>
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
        if (block.classList.contains('language-mermaid')) return;
        const pre = block.parentElement;
        // Don't add header twice
        if (pre.querySelector('.code-header')) return;

        // Extract language name from class
        const langClass = [...block.classList].find(c => c.startsWith('language-'));
        const lang = langClass ? langClass.replace('language-', '') : 'code';

        // Create header with language label + copy button
        const header = document.createElement('div');
        header.className = 'code-header';
        header.innerHTML = `<span class="code-lang">${escapeHtml(lang)}</span><button class="code-copy" onclick="copyCode(this)">Copy</button>`;
        pre.insertBefore(header, block);

        Prism.highlightElement(block);
    });
}

/** Copy code block content to clipboard */
function copyCode(btn) {
    const pre = btn.closest('pre');
    const code = pre.querySelector('code');
    navigator.clipboard.writeText(code.textContent).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
        }, 2000);
    });
}

/** Initialize HTML preview iframe with proper styling */
function initHtmlPreview(iframe) {
    const encoded = iframe.getAttribute('data-src');
    if (!encoded) return;
    const htmlContent = decodeURIComponent(encoded);

    // Wrap in a themed container if it doesn't already have <html>
    const hasFullDoc = htmlContent.includes('<html') || htmlContent.includes('<!DOCTYPE');
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const themeStyles = `
        <style>
            body {
                background: ${isLight ? '#ffffff' : '#09090b'};
                color: ${isLight ? '#1a1a2e' : '#fafafa'};
                font-family: Inter, -apple-system, sans-serif;
                margin: 0;
                padding: 16px;
            }
        </style>`;

    iframe.srcdoc = hasFullDoc ? htmlContent : `<!DOCTYPE html><html><head>${themeStyles}</head><body>${htmlContent}</body></html>`;
    iframe.removeAttribute('data-src');

    // Auto-resize iframe to content height
    iframe.addEventListener('load', () => {
        try {
            const h = iframe.contentDocument.documentElement.scrollHeight;
            iframe.style.height = Math.min(h + 20, 600) + 'px';
        } catch (_) { /* cross-origin fallback */ }
    });
}

/** Toggle between code view and rendered view */
function toggleVizCode(btn) {
    const container = btn.closest('.viz-container');
    const preview = container.querySelector('.html-preview');
    const codeBlock = container.querySelector('.html-code-block');

    if (codeBlock.style.display === 'none') {
        codeBlock.style.display = 'block';
        preview.style.display = 'none';
        btn.textContent = 'Show preview';
    } else {
        codeBlock.style.display = 'none';
        preview.style.display = 'block';
        btn.textContent = 'Show code';
    }
}

/** Render all pending mermaid blocks in a container element (parallel for speed) */
async function renderMermaidBlocks(container) {
    const blocks = container.querySelectorAll('.mermaid-block:not([data-processed])');
    const promises = [...blocks].map(async (block) => {
        block.setAttribute('data-processed', 'true');
        const source = block.textContent.trim();
        // Store original source for re-rendering on theme switch
        block.setAttribute('data-source', source);

        // Validate syntax first — mermaid.parse throws on bad syntax
        try {
            await mermaid.parse(source);
        } catch (_) {
            // Invalid mermaid — convert back to a normal code block
            convertToCodeBlock(block, source);
            return;
        }

        try {
            const { svg } = await mermaid.render(block.id + '-svg', source);
            block.innerHTML = svg;
        } catch (err) {
            // Render failed — remove any error elements mermaid injected
            document.querySelectorAll('#d' + block.id + '-svg').forEach(el => el.remove());
            convertToCodeBlock(block, source);
        }
    });
    await Promise.all(promises);

    // Clean up any stray mermaid error elements
    document.querySelectorAll('[id^="d"][id$="-svg"]').forEach(el => {
        if (el.classList.contains('mermaid') || el.querySelector('.error-icon')) {
            el.remove();
        }
    });
}

/** Convert a failed mermaid block back to a normal syntax-highlighted code block */
function convertToCodeBlock(block, source) {
    const vizContainer = block.closest('.viz-container');
    if (vizContainer) {
        // Replace the entire viz container with a plain pre/code block
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.className = 'language-text';
        code.textContent = source;
        pre.appendChild(code);
        vizContainer.replaceWith(pre);
        highlightCode(pre.parentElement || pre);
    } else {
        block.innerHTML = `<pre><code class="language-text">${escapeHtml(source)}</code></pre>`;
    }
}