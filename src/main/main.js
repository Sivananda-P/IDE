const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const pty = require('node-pty');
const os = require('os');
const AIAgent = require('./agent');
const aiAgent = new AIAgent();

// Forward agent events to renderer
aiAgent.on('file-changed', (data) => {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('agent-file-changed', data);
    });
});

aiAgent.on('command-started', (data) => {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('agent-command-started', data);
    });
});

aiAgent.on('command-finished', (data) => {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('agent-command-finished', data);
    });
});

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New File',
                    accelerator: 'CmdOrCtrl+N',
                    click: (menuItem, browserWindow) => {
                        browserWindow.webContents.send('menu-new-file');
                    }
                },
                {
                    label: 'New Folder',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: (menuItem, browserWindow) => {
                        browserWindow.webContents.send('menu-new-folder');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Open Folder',
                    accelerator: 'CmdOrCtrl+O',
                    click: (menuItem, browserWindow) => {
                        browserWindow.webContents.send('menu-open-folder');
                    }
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click: () => dialog.showMessageBox({ title: 'About', message: 'Agentic IDE v1.0.0' })
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function createWindow() {
    const win = new BrowserWindow({
        title: 'Cognifyr IDE - MAX PARITY V2.4',
        width: 1200,
        height: 800,
        backgroundColor: '#1e1e1e',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    win.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Force close DevTools if it tries to open

    // Setup Multi-PTY handlers are defined outside
}

const terminals = new Map();
let nextTerminalId = 1;

// Terminal IPC Handlers
ipcMain.handle('create-terminal', (event) => {
    const id = nextTerminalId++;
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || process.env.USERPROFILE,
        env: process.env
    });

    ptyProcess.onData((data) => {
        event.sender.send(`terminal-from-pty-${id}`, data);
    });

    ptyProcess.onExit(() => {
        event.sender.send('terminal-exit', id);
        terminals.delete(id);
    });

    terminals.set(id, ptyProcess);
    return id;
});

ipcMain.handle('close-terminal', (event, id) => {
    const ptyProcess = terminals.get(id);
    if (ptyProcess) {
        ptyProcess.kill();
        terminals.delete(id);
    }
    return true;
});

ipcMain.on('terminal-to-pty', (event, id, data) => {
    const ptyProcess = terminals.get(id);
    if (ptyProcess) {
        ptyProcess.write(data);
    }
});

// IPC Handlers
ipcMain.handle('list-directory', async (event, dirPath) => {
    try {
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        return files.map(file => ({
            name: file.name,
            isDirectory: file.isDirectory(),
            path: path.join(dirPath, file.name)
        }));
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
        await fs.writeFile(filePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('open-directory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (canceled) {
        return null;
    } else {
        return filePaths[0];
    }
});

ipcMain.handle('chat-with-ai', async (event, userInput, workspacePath) => {
    return await aiAgent.sendMessage(userInput, workspacePath);
});

ipcMain.handle('set-workspace-path', async (event, path) => {
    console.log(`[MAIN] Setting AI Workspace Path to: ${path}`);
    aiAgent.workspacePath = path;
    return true;
});

ipcMain.handle('create-file', async (event, filePath) => {
    try {
        const normalizedPath = path.resolve(filePath);
        console.log('Main Process: Creating file at', normalizedPath);
        await fs.writeFile(normalizedPath, '', 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('Main Process Error (create-file):', error);
        return { error: error.message };
    }
});

ipcMain.handle('create-folder', async (event, folderPath) => {
    try {
        const normalizedPath = path.resolve(folderPath);
        console.log('Main Process: Creating folder at', normalizedPath);
        await fs.mkdir(normalizedPath, { recursive: true });
        return { success: true };
    } catch (error) {
        console.error('Main Process Error (create-folder):', error);
        return { error: error.message };
    }
});

ipcMain.handle('delete-item', async (event, itemPath) => {
    try {
        const stats = await fs.stat(itemPath);
        if (stats.isDirectory()) {
            await fs.rm(itemPath, { recursive: true, force: true });
        } else {
            await fs.unlink(itemPath);
        }
        return { success: true };
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('rename-item', async (event, oldPath, newPath) => {
    try {
        await fs.rename(oldPath, newPath);
        return { success: true };
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('show-context-menu', (event, options) => {
    return new Promise((resolve) => {
        const { isDirectory, path: itemPath } = options;

        // If clicking on empty space, itemPath might be null or the root
        const creationPath = itemPath ? (isDirectory ? itemPath : path.dirname(itemPath)) : null;

        const template = [
            {
                label: 'New File',
                click: () => resolve({ action: 'new-file', path: creationPath })
            },
            {
                label: 'New Folder',
                click: () => resolve({ action: 'new-folder', path: creationPath })
            },
            { type: 'separator' },
            {
                label: 'Rename',
                click: () => resolve({ action: 'rename', path: itemPath })
            },
            {
                label: 'Delete',
                click: () => resolve({ action: 'delete', path: itemPath })
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        menu.popup({
            window: BrowserWindow.fromWebContents(event.sender),
            callback: () => resolve({ action: null })
        });
    });
});

ipcMain.handle('path-join', (event, ...args) => path.join(...args));
ipcMain.handle('path-dirname', (event, p) => path.dirname(p));

app.whenReady().then(() => {
    createMenu();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
