const searchInput = document.getElementById('search-input');
const searchResultsList = document.getElementById('search-results-list');
const searchSummary = document.getElementById('search-results-summary');

const optCase = document.getElementById('search-case');
const optWord = document.getElementById('search-word');
const optRegex = document.getElementById('search-regex');

let searchOptions = {
    isCaseSensitive: false,
    isWholeWord: false,
    isRegex: false
};

// UI Listeners
optCase.onclick = () => { optCase.classList.toggle('active'); searchOptions.isCaseSensitive = !searchOptions.isCaseSensitive; performSearch(); };
optWord.onclick = () => { optWord.classList.toggle('active'); searchOptions.isWholeWord = !searchOptions.isWholeWord; performSearch(); };
optRegex.onclick = () => { optRegex.classList.toggle('active'); searchOptions.isRegex = !searchOptions.isRegex; performSearch(); };

let searchTimeout = null;
searchInput.oninput = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 300);
};

async function performSearch() {
    const query = searchInput.value;
    const workspacePath = window.currentRootPath;

    if (!query || !workspacePath) {
        searchResultsList.innerHTML = '';
        searchSummary.innerText = '';
        return;
    }

    searchSummary.innerText = 'Searching...';
    const results = await window.electronAPI.searchProject(workspacePath, query, searchOptions);
    renderSearchResults(results);
}

function renderSearchResults(results) {
    searchResultsList.innerHTML = '';

    if (results.error) {
        searchSummary.innerText = 'Error performing search.';
        return;
    }

    searchSummary.innerText = `${results.length} results found`;

    if (results.length === 0) {
        searchResultsList.innerHTML = '<div class="placeholder-content">No results found.</div>';
        return;
    }

    // Group by file
    const grouped = {};
    results.forEach(res => {
        if (!grouped[res.relativePath]) grouped[res.relativePath] = [];
        grouped[res.relativePath].push(res);
    });

    for (const relPath in grouped) {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'search-file-group';

        const fileHeader = document.createElement('div');
        fileHeader.className = 'search-file-header';
        fileHeader.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
            <span class="file-name">${relPath}</span>
            <span class="count-badge">${grouped[relPath].length}</span>
        `;
        fileDiv.appendChild(fileHeader);

        const matchesContainer = document.createElement('div');
        matchesContainer.className = 'search-matches';

        grouped[relPath].forEach(match => {
            const matchDiv = document.createElement('div');
            matchDiv.className = 'search-match-item';
            matchDiv.innerHTML = `
                <span class="line-number">${match.line}</span>
                <span class="match-preview">${escapeHtml(match.content)}</span>
            `;
            matchDiv.onclick = () => {
                window.openFile(match.path);
                // Future: Jump to specific line. Monaco handles this via setPosition/revealLine.
                // We'll need a minor update to window.openFile to support this.
                if (window.editor) {
                    setTimeout(() => {
                        window.editor.setSelection({
                            startLineNumber: match.line,
                            startColumn: 1,
                            endLineNumber: match.line,
                            endColumn: 1000
                        });
                        window.editor.revealLineInCenter(match.line);
                    }, 100);
                }
            };
            matchesContainer.appendChild(matchDiv);
        });

        fileDiv.appendChild(matchesContainer);
        searchResultsList.appendChild(fileDiv);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
