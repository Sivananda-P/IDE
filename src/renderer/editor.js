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
        padding: { top: 16 },
        lineNumbers: 'on'
    });

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
