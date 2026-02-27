require.config({ paths: { 'vs': '../../node_modules/monaco-editor/min/vs' } });

const tabsContainer = document.getElementById('tabs-container');
const openTabs = new Map(); // path -> { model, name, isDirty }

require(['vs/editor/editor.main'], function () {
    window.editor = monaco.editor.create(document.getElementById('editor'), {
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
        minimap: { enabled: true },
        padding: { top: 32 }, // More padding for breadcrumbs
        lineNumbers: 'on'
    });

    // Update Outline if globally available
    if (window.updateOutline) {
        window.editor.onDidChangeModelContent(() => {
            const model = window.editor.getModel();
            if (model) window.updateOutline(model.getValue(), model.getLanguageId());
        });
        window.editor.onDidChangeModel(() => {
            const model = window.editor.getModel();
            if (model) window.updateOutline(model.getValue(), model.getLanguageId());
        });
    }

    // Update Status Bar on Cursor Change
    window.editor.onDidChangeCursorPosition((e) => {
        const cursorPosEl = document.getElementById('cursor-pos');
        if (cursorPosEl) {
            cursorPosEl.innerText = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
        }
    });

    // Update Status Bar on Model/Language Change
    window.editor.onDidChangeModel(() => {
        const langEl = document.getElementById('language-indicator');
        const model = window.editor.getModel();
        if (langEl && model) {
            langEl.innerText = model.getLanguageId();
        }
    });

    window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveCurrentFile());
});

window.openFile = async function (path) {
    if (openTabs.has(path)) {
        switchTab(path);
        return;
    }

    const content = await window.electronAPI.readFile(path);
    const name = path.split(/[\\/]/).pop();
    const ext = name.split('.').pop().toLowerCase();
    const langMap = { 'js': 'javascript', 'html': 'html', 'css': 'css', 'md': 'markdown', 'json': 'json', 'py': 'python', 'ts': 'typescript' };

    const model = monaco.editor.createModel(content, langMap[ext] || 'plaintext', monaco.Uri.file(path));

    // Track dirty state
    model.onDidChangeContent(() => {
        const tabData = openTabs.get(path);
        if (tabData && !tabData.isDirty) {
            tabData.isDirty = true;
            renderTabs();
        }
    });

    openTabs.set(path, { model, name, isDirty: false });

    renderTabs();
    switchTab(path);
};

function updateBreadcrumbs(path) {
    const container = document.getElementById('breadcrumbs-container');
    if (!container) return;
    container.innerHTML = '';

    if (!path) return;

    // Use currentRootPath to determine relative segments if possible
    const root = window.currentRootPath || '';
    let relativePath = path;
    if (path.startsWith(root)) {
        relativePath = path.slice(root.length).replace(/^[\\\/]/, '');
    }

    const segments = relativePath.split(/[\\\/]/);

    segments.forEach((segment, index) => {
        if (index > 0) {
            const sep = document.createElement('span');
            sep.className = 'breadcrumb-separator';
            sep.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
            container.appendChild(sep);
        }

        const item = document.createElement('div');
        item.className = 'breadcrumb-item';
        if (index === segments.length - 1) item.classList.add('file');

        const isFile = index === segments.length - 1;
        const icon = isFile ?
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #e37933"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>` :
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #dcb67a"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;

        item.innerHTML = `
            <span class="item-icon">${icon}</span>
            <span>${segment}</span>
        `;

        container.appendChild(item);
    });
}

function switchTab(path) {
    const tabData = openTabs.get(path);
    if (!tabData) return;

    window.currentFilePath = path;
    window.editor.setModel(tabData.model);

    // Update active UI state
    document.querySelectorAll('.tab-item').forEach(t => {
        t.classList.toggle('active', t.dataset.path === path);
    });

    // Highlight in explorer if possible
    const explorerItem = document.querySelector(`.tree-item[title="${CSS.escape(path)}"]`);
    if (explorerItem) {
        document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
        explorerItem.classList.add('active');
    }

    updateBreadcrumbs(path);
}

function closeTab(path, e) {
    if (e) e.stopPropagation();

    const tabData = openTabs.get(path);
    if (!tabData) return;

    if (tabData.isDirty) {
        if (!confirm(`${tabData.name} has unsaved changes. Close anyway?`)) return;
    }

    tabData.model.dispose();
    openTabs.delete(path);

    if (window.currentFilePath === path) {
        const remainingPaths = Array.from(openTabs.keys());
        if (remainingPaths.length > 0) {
            switchTab(remainingPaths[remainingPaths.length - 1]);
        } else {
            window.currentFilePath = null;
            window.editor.setModel(null);
        }
    }

    renderTabs();
}

function renderTabs() {
    tabsContainer.innerHTML = '';
    openTabs.forEach((data, path) => {
        const tab = document.createElement('div');
        tab.className = 'tab-item';
        if (data.isDirty) tab.classList.add('dirty');
        tab.dataset.path = path;

        const closeIcon = `
            <span class="tab-close">
                ${data.isDirty ?
                '<div class="dirty-dot"></div>' :
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'}
            </span>
        `;

        tab.innerHTML = `
            <span class="tab-label">${data.name}</span>
            ${closeIcon}
        `;

        tab.onclick = () => switchTab(path);
        tab.querySelector('.tab-close').onclick = (e) => closeTab(path, e);

        if (window.currentFilePath === path) tab.classList.add('active');
        tabsContainer.appendChild(tab);
    });
}

async function saveCurrentFile() {
    if (!window.currentFilePath) return;
    const content = window.editor.getValue();
    const result = await window.electronAPI.writeFile(window.currentFilePath, content);

    if (result.success) {
        const tabData = openTabs.get(window.currentFilePath);
        if (tabData) {
            tabData.isDirty = false;
            renderTabs();
        }
    } else {
        alert('Failed to save: ' + result.error);
    }
}
