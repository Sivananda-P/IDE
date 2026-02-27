const fileTree = document.getElementById('file-tree');
const explorerView = document.getElementById('view-explorer');
const statusLog = document.getElementById('explorer-status');
let currentRootPath = localStorage.getItem('lastRootPath') || '';
window.currentRootPath = currentRootPath;
const expandedFolders = new Set();
let isCreating = false;

console.log('%c [EXPLORER V2.3.1] REINFORCED ', 'background: #222; color: #00ffff; font-size: 1.2em;');

function logStatus(msg, isError = false) {
    if (statusLog) {
        statusLog.innerText = msg;
        statusLog.style.color = isError ? '#ff5555' : '#888';
    }
    console.log(`[STATUS] ${msg}`);
}

// Ensure the button exists
let openFolderBtn = document.getElementById('open-folder-btn');
if (!openFolderBtn) {
    openFolderBtn = document.createElement('button');
    openFolderBtn.innerText = 'Open Folder';
    openFolderBtn.id = 'open-folder-btn';
    openFolderBtn.className = 'primary-btn';
    if (explorerView && fileTree) {
        explorerView.insertBefore(openFolderBtn, fileTree);
    }
}

function init() {
    logStatus('Explorer Initializing...');

    const newFileBtn = document.getElementById('main-new-file');
    const newFolderBtn = document.getElementById('main-new-folder');

    if (newFileBtn) {
        newFileBtn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            console.log('Header New File clicked');
            createItemInline('file');
        };
    }
    if (newFolderBtn) {
        newFolderBtn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            createItemInline('folder');
        };
    }

    if (openFolderBtn) {
        openFolderBtn.onclick = async () => {
            try {
                const path = await window.electronAPI.openDirectory();
                if (path) openProject(path);
            } catch (e) { logStatus('Open Cancelled', true); }
        };
    }

    // Capture background clicks for context menu
    fileTree.oncontextmenu = async (e) => {
        if (e.target === fileTree) {
            e.preventDefault();
            const res = await window.electronAPI.showContextMenu({ isDirectory: true, path: currentRootPath });
            if (res.action === 'new-file') createItemInline('file', res.path);
            else if (res.action === 'new-folder') createItemInline('folder', res.path);
        }
    };

    if (currentRootPath) {
        logStatus('Restoring session...');
        openProject(currentRootPath);
    } else {
        logStatus('Ready - No Folder Open');
    }

    // Section Collapse/Expand for Outline
    const outlineHeader = document.querySelector('#explorer-outline-section .git-section-header');
    if (outlineHeader) {
        outlineHeader.onclick = () => {
            const container = document.getElementById('outline-list');
            const icon = outlineHeader.querySelector('.arrow-icon');
            const isHidden = container.style.display === 'none';
            container.style.display = isHidden ? 'block' : 'none';
            if (icon) icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
        };
    }
}

async function openProject(path) {
    currentRootPath = path;
    window.currentRootPath = path; // expose to chat.js
    localStorage.setItem('lastRootPath', path);
    const folderName = path.split(/[\\/]/).pop();
    const titleEl = document.getElementById('explorer-title');
    if (titleEl) titleEl.innerHTML = `EXPLORER <small style="font-size: 0.6em; opacity: 0.5;">v2.3.1</small><br>${folderName.toUpperCase()}`;
    openFolderBtn.style.display = 'none';
    loadDirectory(path);
    if (window.refreshGit) window.refreshGit();
    if (window.createTerminal) window.createTerminal(path);
    logStatus('Folder Loaded: ' + folderName);
}

async function createItemInline(type, targetPath) {
    if (isCreating) return;
    const parentDir = targetPath || currentRootPath;
    if (!parentDir) {
        alert('Please CLICK "Open Folder" first!');
        return;
    }

    isCreating = true;
    logStatus(`Type name for new ${type}...`);

    const inputContainer = document.createElement('div');
    inputContainer.className = 'tree-item inline-input-container';
    inputContainer.style.padding = '2px 10px';
    inputContainer.style.background = '#37373d';

    const icon = document.createElement('span');
    icon.className = 'item-icon';
    icon.innerHTML = type === 'file' ?
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>' :
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';

    const input = document.createElement('input');
    input.type = 'text';
    input.style.cssText = 'width: 100%; height: 24px; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid var(--accent); outline: none; font-size: 12px; margin-left: 8px; padding: 0 8px; border-radius: 4px;';

    inputContainer.appendChild(icon);
    inputContainer.appendChild(input);

    // Insert at top of container
    const container = findContainerForPath(targetPath) || fileTree;
    container.insertBefore(inputContainer, container.firstChild);
    input.focus();

    const finish = async () => {
        const name = input.value.trim();
        inputContainer.remove();
        isCreating = false;

        if (name) {
            logStatus(`Creating ${name}...`);
            try {
                const fullPath = await window.electronAPI.joinPath(parentDir, name);
                const result = (type === 'file') ?
                    await window.electronAPI.createFile(fullPath) :
                    await window.electronAPI.createFolder(fullPath);

                if (result && result.success) {
                    logStatus(`Success: ${name}`);
                    if (targetPath) expandedFolders.add(targetPath);
                    refreshTree();
                } else {
                    logStatus('Failed to create', true);
                    alert('Error: ' + (result ? result.error : 'Access Denied'));
                }
            } catch (err) { logStatus('IPC Error', true); }
        } else {
            logStatus('Cancelled.');
        }
    };

    input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(); }
        if (e.key === 'Escape') { input.value = ''; finish(); }
    };
    input.onblur = () => finish();
}

function findContainerForPath(targetPath) {
    if (!targetPath || targetPath === currentRootPath) return fileTree;
    const allSubTrees = document.querySelectorAll('.sub-tree');
    for (let st of allSubTrees) {
        if (st.previousSibling && st.previousSibling.title === targetPath) return st;
    }
    return null;
}

async function loadDirectory(path, container = fileTree) {
    if (container === fileTree) {
        container.innerHTML = '';
        currentRootPath = path;
        window.currentRootPath = path; // Sync with renderer globals
        window.electronAPI.setWorkspacePath(path); // Sync with main process agent
    }

    const files = await window.electronAPI.listDirectory(path);
    if (files.error) {
        container.innerHTML = `<div class="error" style="padding: 10px; color: #ff5555;">${files.error}</div>`;
        return;
    }

    files.sort((a, b) => (b.isDirectory - a.isDirectory) || a.name.localeCompare(b.name));
    files.forEach(file => container.appendChild(createFileItem(file)));
}

function createFileItem(file) {
    const container = document.createElement('div');
    container.className = 'tree-item-container';

    const item = document.createElement('div');
    item.className = 'tree-item';
    item.title = file.path;

    const icon = document.createElement('span');
    icon.className = 'item-icon';
    if (file.isDirectory) {
        icon.innerHTML = expandedFolders.has(file.path) ?
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg>' : // Chevron Down
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"></path></svg>';    // Chevron Right
    } else {
        icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
    }

    const label = document.createElement('span');
    label.className = 'item-label';
    label.innerText = file.name;

    item.appendChild(icon);
    item.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'tree-actions';
    if (file.isDirectory) {
        const addFile = document.createElement('button');
        addFile.title = 'New File';
        addFile.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
        addFile.onclick = (e) => { e.stopPropagation(); createItemInline('file', file.path); };

        const addFolder = document.createElement('button');
        addFolder.title = 'New Folder';
        addFolder.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
        addFolder.onclick = (e) => { e.stopPropagation(); createItemInline('folder', file.path); };

        actions.appendChild(addFile);
        actions.appendChild(addFolder);
    }
    item.appendChild(actions);
    container.appendChild(item);

    let subContainer = null;
    if (file.isDirectory && expandedFolders.has(file.path)) {
        subContainer = document.createElement('div');
        subContainer.className = 'sub-tree';
        subContainer.style.paddingLeft = '15px';
        container.appendChild(subContainer);
        loadDirectory(file.path, subContainer);
    }

    item.onclick = async (e) => {
        e.stopPropagation();
        if (file.isDirectory) {
            if (expandedFolders.has(file.path)) {
                expandedFolders.delete(file.path);
                icon.innerText = '▶';
                if (subContainer) subContainer.remove();
            } else {
                expandedFolders.add(file.path);
                icon.innerText = '▼';
                subContainer = document.createElement('div');
                subContainer.className = 'sub-tree';
                subContainer.style.paddingLeft = '15px';
                container.appendChild(subContainer);
                await loadDirectory(file.path, subContainer);
            }
        } else {
            window.openFile(file.path);
        }
    };

    item.oncontextmenu = async (e) => {
        e.preventDefault(); e.stopPropagation();
        const res = await window.electronAPI.showContextMenu({ isDirectory: file.isDirectory, path: file.path });
        if (res.action === 'new-file') createItemInline('file', res.path);
        else if (res.action === 'new-folder') createItemInline('folder', res.path);
        else if (res.action === 'rename') renameItem(file.path, file.name);
        else if (res.action === 'delete') deleteItem(file.path, file.name);
    };

    return container;
}

async function renameItem(oldPath, oldName) {
    const parent = await window.electronAPI.dirname(oldPath);
    const newName = prompt('Rename to:', oldName);
    if (!newName || newName === oldName) return;
    const newPath = await window.electronAPI.joinPath(parent, newName);
    const result = await window.electronAPI.renameItem(oldPath, newPath);
    if (result.success) refreshTree();
}

async function deleteItem(path, name) {
    if (confirm(`Delete "${name}"?`)) {
        const result = await window.electronAPI.deleteItem(path);
        if (result.success) {
            if (window.closeTab) window.closeTab(path);
            refreshTree();
        }
    }
}

function refreshTree() { if (currentRootPath) loadDirectory(currentRootPath); }

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => {
    init();
    window.currentRootPath = currentRootPath;
});
else {
    init();
    window.currentRootPath = currentRootPath;
}

window.electronAPI.onMenuAction((action) => {
    if (action === 'new-file') createItemInline('file');
    else if (action === 'new-folder') createItemInline('folder');
    else if (action === 'open-folder' && openFolderBtn) openFolderBtn.click();
});

// Auto-refresh when AI agent modifies files
window.electronAPI.onAgentFileChanged((data) => {
    console.log('[EXPLORER] AI Agent modified file:', data.path);
    refreshTree();
});
