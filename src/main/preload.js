const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    listDirectory: (path) => ipcRenderer.invoke('list-directory', path),
    readFile: (path) => ipcRenderer.invoke('read-file', path),
    writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
    openDirectory: () => ipcRenderer.invoke('open-directory'),
    createTerminal: () => ipcRenderer.invoke('create-terminal'),
    closeTerminal: (id) => ipcRenderer.invoke('close-terminal', id),
    terminalToPty: (id, data) => ipcRenderer.send('terminal-to-pty', id, data),
    onTerminalFromPty: (id, callback) => {
        const channel = `terminal-from-pty-${id}`;
        // Remove existing listeners to avoid memory leaks if re-initialized
        ipcRenderer.removeAllListeners(channel);
        ipcRenderer.on(channel, (event, data) => callback(data));
    },
    onTerminalExit: (callback) => {
        ipcRenderer.removeAllListeners('terminal-exit');
        ipcRenderer.on('terminal-exit', (event, id) => callback(id));
    },
    chatWithAI: (input, workspacePath) => ipcRenderer.invoke('chat-with-ai', input, workspacePath),
    createFile: (path) => ipcRenderer.invoke('create-file', path),
    createFolder: (path) => ipcRenderer.invoke('create-folder', path),
    deleteItem: (path) => ipcRenderer.invoke('delete-item', path),
    renameItem: (oldPath, newPath) => ipcRenderer.invoke('rename-item', oldPath, newPath),
    onMenuAction: (callback) => {
        ipcRenderer.on('menu-new-file', () => callback('new-file'));
        ipcRenderer.on('menu-new-folder', () => callback('new-folder'));
        ipcRenderer.on('menu-open-folder', () => callback('open-folder'));
    },
    showContextMenu: (options) => ipcRenderer.invoke('show-context-menu', options),
    joinPath: (...args) => ipcRenderer.invoke('path-join', ...args),
    dirname: (p) => ipcRenderer.invoke('path-dirname', p),
    setWorkspacePath: (path) => ipcRenderer.invoke('set-workspace-path', path),
    onAgentFileChanged: (callback) => ipcRenderer.on('agent-file-changed', (event, data) => callback(data)),
    onAgentCommandStarted: (callback) => ipcRenderer.on('agent-command-started', (event, data) => callback(data)),
    onAgentCommandFinished: (callback) => ipcRenderer.on('agent-command-finished', (event, data) => callback(data)),
});
