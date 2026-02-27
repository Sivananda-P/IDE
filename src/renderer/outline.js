const outlineList = document.getElementById('outline-list');

async function updateOutline(content, language) {
    if (!outlineList) return;
    outlineList.innerHTML = '';

    if (!content) {
        outlineList.innerHTML = '<div class="placeholder-content" style="padding: 10px; opacity: 0.5; font-size: 11px;">No symbols found</div>';
        return;
    }

    const symbols = extractSymbols(content, language);

    if (symbols.length === 0) {
        outlineList.innerHTML = '<div class="placeholder-content" style="padding: 10px; opacity: 0.5; font-size: 11px;">No symbols found</div>';
        return;
    }

    symbols.forEach(symbol => {
        const item = document.createElement('div');
        item.className = 'git-change-item';
        item.style.paddingLeft = '24px';

        let iconColor = '#b180d7'; // default purple for functions
        if (symbol.type === 'class') iconColor = '#ee9d28';
        if (symbol.type === 'variable' || symbol.type === 'const') iconColor = '#75beff';

        item.innerHTML = `
            <span class="item-icon" style="color: ${iconColor}">
                ${getSymbolIcon(symbol.type)}
            </span>
            <span class="item-label">${symbol.name}</span>
        `;

        item.onclick = () => {
            if (window.editor) {
                window.editor.revealLineInCenter(symbol.line);
                window.editor.setPosition({ lineNumber: symbol.line, column: 1 });
                window.editor.focus();
            }
        };

        outlineList.appendChild(item);
    });
}

function extractSymbols(content, language) {
    const symbols = [];
    const lines = content.split('\n');

    const patterns = {
        javascript: [
            { type: 'class', regex: /class\s+([a-zA-Z0-9_$]+)/ },
            { type: 'function', regex: /(?:function\s+([a-zA-Z0-9_$]+)|([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/ },
            { type: 'method', regex: /^\s+([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*{/ }
        ],
        css: [
            { type: 'class', regex: /\.([a-zA-Z0-9_-]+)\s*{/ },
            { type: 'id', regex: /#([a-zA-Z0-9_-]+)\s*{/ }
        ],
        html: [
            { type: 'id', regex: /id=["']([^"']+)["']/ }
        ]
    };

    const activePatterns = patterns[language] || [];

    lines.forEach((line, index) => {
        activePatterns.forEach(p => {
            const match = line.match(p.regex);
            if (match) {
                const name = match[1] || match[2];
                if (name) {
                    symbols.push({ name, type: p.type, line: index + 1 });
                }
            }
        });
    });

    return symbols;
}

function getSymbolIcon(type) {
    if (type === 'class') return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
    if (type === 'function' || type === 'method') return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>';
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>';
}

// Expose to global
window.updateOutline = updateOutline;

// Listen for editor changes
if (window.editor) {
    window.editor.onDidChangeModelContent(() => {
        const model = window.editor.getModel();
        if (model) {
            updateOutline(model.getValue(), model.getLanguageId());
        }
    });

    window.editor.onDidChangeModel(() => {
        const model = window.editor.getModel();
        if (model) {
            updateOutline(model.getValue(), model.getLanguageId());
        }
    });
}
