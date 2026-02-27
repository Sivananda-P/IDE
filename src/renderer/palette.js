const paletteOverlay = document.getElementById('command-palette');
const paletteInput = document.getElementById('palette-input');
const paletteResults = document.getElementById('palette-results');

let selectedIndex = 0;
let filteredCommands = [];

// Command Registry
const commands = [
    { id: 'file.new', label: 'New File', category: 'File', key: 'Ctrl+N', action: () => document.getElementById('main-new-file').click() },
    { id: 'file.newFolder', label: 'New Folder', category: 'File', key: 'Ctrl+Alt+N', action: () => document.getElementById('main-new-folder').click() },
    { id: 'view.explorer', label: 'Show Explorer', category: 'View', key: 'Ctrl+Shift+E', action: () => document.querySelector('[data-view="explorer"]').click() },
    { id: 'view.search', label: 'Show Search', category: 'View', key: 'Ctrl+Shift+F', action: () => document.querySelector('[data-view="search"]').click() },
    { id: 'view.git', label: 'Show Source Control', category: 'View', key: 'Ctrl+Shift+G', action: () => document.querySelector('[data-view="git"]').click() },
    { id: 'git.refresh', label: 'Refresh Git Status', category: 'Git', key: 'Ctrl+R', action: () => window.refreshGit() },
    { id: 'terminal.new', label: 'New Terminal', category: 'Terminal', key: 'Ctrl+`', action: () => window.createTerminal() },
    { id: 'editor.save', label: 'Save File', category: 'Editor', key: 'Ctrl+S', action: () => window.saveCurrentFile() },
    { id: 'app.reload', label: 'Reload Window', category: 'Developer', action: () => window.location.reload() },
];

function showPalette() {
    paletteOverlay.classList.remove('hidden');
    paletteInput.value = '';
    paletteInput.focus();
    updateResults();
}

function hidePalette() {
    paletteOverlay.classList.add('hidden');
}

function updateResults() {
    const query = paletteInput.value.toLowerCase();

    filteredCommands = commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.category.toLowerCase().includes(query)
    );

    renderResults();
}

function renderResults() {
    paletteResults.innerHTML = '';
    selectedIndex = Math.min(selectedIndex, filteredCommands.length - 1);
    if (selectedIndex < 0) selectedIndex = 0;

    filteredCommands.forEach((cmd, index) => {
        const div = document.createElement('div');
        div.className = `palette-item ${index === selectedIndex ? 'selected' : ''}`;

        div.innerHTML = `
            <div class="item-info">
                <span class="item-category">${cmd.category}</span>
                <span class="item-label">${cmd.label}</span>
            </div>
            ${cmd.key ? `<span class="item-key">${cmd.key}</span>` : ''}
        `;

        div.onclick = () => executeCommand(cmd);
        div.onmouseenter = () => {
            selectedIndex = index;
            renderResults();
        };

        paletteResults.appendChild(div);
    });

    // Ensure selected item is visible
    const selectedItem = paletteResults.children[selectedIndex];
    if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
    }
}

function executeCommand(cmd) {
    hidePalette();
    if (cmd.action) {
        cmd.action();
    }
}

// Global Event Listeners
window.addEventListener('keydown', (e) => {
    // Ctrl+Shift+P
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        showPalette();
    }

    // Escape to close
    if (e.key === 'Escape' && !paletteOverlay.classList.contains('hidden')) {
        hidePalette();
    }

    // Navigation inside palette
    if (!paletteOverlay.classList.contains('hidden')) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % filteredCommands.length;
            renderResults();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
            renderResults();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredCommands[selectedIndex]) {
                executeCommand(filteredCommands[selectedIndex]);
            }
        }
    }
});

paletteInput.oninput = () => {
    selectedIndex = 0;
    updateResults();
};

// Close when clicking outside
paletteOverlay.onclick = (e) => {
    if (e.target === paletteOverlay) {
        hidePalette();
    }
};
