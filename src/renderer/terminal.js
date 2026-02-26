console.log('Terminal script loading...');
const terminalContent = document.getElementById('terminal-content');
const terminalTabs = document.getElementById('terminal-tabs');
const addTerminalBtn = document.getElementById('add-terminal-btn');

const terminals = new Map();
let activeTerminalId = null;

if (typeof Terminal === 'undefined') {
    terminalContent.innerHTML = '<div style="color:red; padding: 10px;">Xterm.js failed to load. Check console.</div>';
} else {
    // UI Events
    addTerminalBtn.addEventListener('click', () => createTerminal());

    // Initialize first terminal
    createTerminal();

    // Create a special non-pty AI Console
    createAIConsole();

    // IPC Events
    window.electronAPI.onTerminalExit((id) => {
        closeTerminal(id, false);
    });
}

async function createAIConsole() {
    const id = 'ai-console';

    const tab = document.createElement('div');
    tab.className = 'terminal-tab ai-tab';
    tab.innerHTML = `<span>AI Console</span>`;
    tab.onclick = () => switchToTerminal(id);
    terminalTabs.appendChild(tab);

    const container = document.createElement('div');
    container.className = 'terminal-instance';
    container.id = `terminal-instance-${id}`;
    terminalContent.appendChild(container);

    const term = new Terminal({
        backgroundColor: '#1e1e1e',
        cursorBlink: false,
        fontSize: 12,
        fontFamily: 'Consolas, "Courier New", monospace',
        disableStdin: true,
        theme: { background: '#1e1e1e', foreground: '#d4d4d4' }
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    term.write('\x1b[1;36m[Cognifyr AI Console Initialized]\x1b[0m\r\n\n');

    terminals.set(id, { term, fitAddon, tab, container });

    window.electronAPI.onAgentCommandStarted((data) => {
        term.write(`\r\n\x1b[1;33m> Running:\x1b[0m ${data.command}\r\n`);
    });

    window.electronAPI.onAgentCommandFinished((data) => {
        if (data.result.stdout) {
            term.write(`\x1b[32m${data.result.stdout}\x1b[0m`);
        }
        if (data.result.stderr) {
            term.write(`\x1b[31m${data.result.stderr}\x1b[0m`);
        }
        if (data.result.error) {
            term.write(`\r\n\x1b[1;31mError: ${data.result.error}\x1b[0m\r\n`);
        }
        term.write('\x1b[90m----------------------------------------\x1b[0m\r\n');

        // Auto-switch to AI console if a command is run
        switchToTerminal(id);
    });
}

async function createTerminal() {
    const id = await window.electronAPI.createTerminal();

    // Create UI Tab
    const tab = document.createElement('div');
    tab.className = 'terminal-tab';
    tab.innerHTML = `<span>powershell</span><button class="close-terminal-btn" data-id="${id}">×</button>`;
    tab.onclick = (e) => {
        if (!e.target.classList.contains('close-terminal-btn')) {
            switchToTerminal(id);
        }
    };

    const closeBtn = tab.querySelector('.close-terminal-btn');
    closeBtn.onclick = () => closeTerminal(id, true);

    terminalTabs.appendChild(tab);

    // Create container for Xterm
    const container = document.createElement('div');
    container.className = 'terminal-instance';
    container.id = `terminal-instance-${id}`;
    terminalContent.appendChild(container);

    // Initialize Xterm
    const term = new Terminal({
        backgroundColor: '#000000',
        cursorBlink: true,
        fontSize: 12,
        fontFamily: 'Consolas, "Courier New", monospace',
        theme: { background: '#000000', foreground: '#ffffff' }
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    term.onData((data) => {
        window.electronAPI.terminalToPty(id, data);
    });

    window.electronAPI.onTerminalFromPty(id, (data) => {
        term.write(data);
    });

    terminals.set(id, { term, fitAddon, tab, container });
    switchToTerminal(id);
}

function switchToTerminal(id) {
    if (!terminals.has(id)) return;

    // Hide all
    terminals.forEach((t) => {
        t.tab.classList.remove('active');
        t.container.style.display = 'none';
    });

    // Show active
    const activeInfo = terminals.get(id);
    activeInfo.tab.classList.add('active');
    activeInfo.container.style.display = 'block';

    activeTerminalId = id;

    // Need a tiny timeout so the DOM display:block takes effect before fitting
    setTimeout(() => {
        activeInfo.fitAddon.fit();
        activeInfo.term.focus();
    }, 10);
}

function closeTerminal(id, notifyBackend) {
    if (!terminals.has(id)) return;

    if (notifyBackend) {
        window.electronAPI.closeTerminal(id);
    }

    const info = terminals.get(id);
    info.term.dispose();
    info.tab.remove();
    info.container.remove();
    terminals.delete(id);

    if (activeTerminalId === id) {
        activeTerminalId = null;
        if (terminals.size > 0) {
            // Switch to the first available terminal
            const firstId = terminals.keys().next().value;
            switchToTerminal(firstId);
        }
    }
}

// Re-fit on window resize
window.addEventListener('resize', () => {
    if (activeTerminalId && terminals.has(activeTerminalId)) {
        terminals.get(activeTerminalId).fitAddon.fit();
    }
});
