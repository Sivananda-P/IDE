const gitBranchName = document.getElementById('branch-name');
const gitStagedList = document.getElementById('git-staged-list');
const gitChangesList = document.getElementById('git-changes-list');
const gitLogList = document.getElementById('git-log-list');
const gitStagedCount = document.getElementById('git-staged-count');
const gitChangesCount = document.getElementById('git-changes-count');
const gitNoRepo = document.getElementById('git-no-repo');
const gitStatusCountBadge = document.getElementById('git-status-count');
const gitCommitMessage = document.getElementById('git-commit-message');
const gitCommitBtn = document.getElementById('git-commit-btn');

let lastBranch = '';
let lastStatus = [];
let lastLog = [];

async function updateGitInfo() {
    const workspacePath = window.currentRootPath;
    if (!workspacePath) {
        gitBranchName.innerText = 'no repo';
        gitStagedList.innerHTML = '';
        gitChangesList.innerHTML = '';
        gitLogList.innerHTML = '';
        gitNoRepo.classList.remove('hidden');
        gitStatusCountBadge.innerText = '0';
        return;
    }

    try {
        const branch = await window.electronAPI.getGitBranch(workspacePath);
        const status = await window.electronAPI.getGitStatus(workspacePath);
        const log = await window.electronAPI.getGitLog(workspacePath);

        const isRepo = (branch !== null) || (status !== null);

        if (branch !== lastBranch) {
            gitBranchName.innerText = branch || (isRepo ? 'initial' : 'no repo');
            lastBranch = branch;
        }

        // Render Status
        if (status) {
            const statusString = JSON.stringify(status);
            if (statusString !== JSON.stringify(lastStatus)) {
                renderGitStatus(status);
                lastStatus = status;
            }
        } else {
            gitStagedList.innerHTML = '';
            gitChangesList.innerHTML = '';
            gitStagedCount.innerText = '0';
            gitChangesCount.innerText = '0';
            gitStatusCountBadge.innerText = '0';
        }

        // Render Log
        if (log) {
            const logString = JSON.stringify(log);
            if (logString !== JSON.stringify(lastLog)) {
                renderGitLog(log);
                lastLog = log;
            }
        }

        if (isRepo) {
            gitNoRepo.classList.add('hidden');
        } else {
            gitNoRepo.classList.remove('hidden');
        }

    } catch (err) {
        console.error('Error fetching git info:', err);
    }
}

function renderGitStatus(statusList) {
    gitStagedList.innerHTML = '';
    gitChangesList.innerHTML = '';

    const stagedFiles = statusList.filter(f => f.isStaged);
    const unstagedFiles = statusList.filter(f => !f.isStaged);

    gitStagedCount.innerText = stagedFiles.length;
    gitChangesCount.innerText = unstagedFiles.length;
    gitStatusCountBadge.innerText = statusList.length;

    renderList(stagedFiles, gitStagedList, true);
    renderList(unstagedFiles, gitChangesList, false);
}

function renderGitLog(log) {
    if (!gitLogList) return;
    gitLogList.innerHTML = '';

    if (!log || log.length === 0) {
        gitLogList.innerHTML = '<div class="placeholder-content" style="padding: 12px; opacity: 0.5; font-size: 11px;">No history</div>';
        return;
    }

    log.forEach((commit, index) => {
        const div = document.createElement('div');
        div.className = 'git-log-item';
        div.title = `Commit: ${commit.hash}\nAuthor: ${commit.author}\nDate: ${commit.date}\n\n${commit.message}`;

        const branchPill = (index === 0 && lastBranch) ? `
            <span class="log-pill">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="4"></circle><line x1="12" y1="2" x2="12" y2="8"></line><line x1="12" y1="16" x2="12" y2="22"></line></svg>
                ${lastBranch}
            </span>
        ` : '';

        div.innerHTML = `
            <div class="log-left">
                <div class="log-node"></div>
                <div class="log-line"></div>
            </div>
            <div class="log-content">
                <div class="log-message">${commit.message} ${branchPill}</div>
                <div class="log-meta">
                    <span class="log-author">${commit.author}</span>
                    <span class="log-hash">${commit.hash.substring(0, 7)}</span>
                    <span class="log-date">${commit.relativeDate}</span>
                </div>
            </div>
        `;
        gitLogList.appendChild(div);
    });
}

function renderList(files, container, isStaged) {
    container.innerHTML = '';
    if (!files || files.length === 0) {
        container.innerHTML = '<div class="placeholder-content" style="padding: 4px 16px; opacity: 0.5; font-size: 11px;">No changes</div>';
        return;
    }

    files.forEach(item => {
        const div = document.createElement('div');
        div.className = 'git-change-item';

        const pathParts = item.path.split(/[\\/]/);
        const name = pathParts.pop();
        const folder = pathParts.join('\\');

        const statusRaw = item.status ? item.status.trim().toUpperCase() : '?';
        const statusLetter = statusRaw === '??' ? 'U' : statusRaw.substring(0, 1);
        const statusClass = statusLetter.toLowerCase();

        const actionIcon = isStaged ?
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>` : // Minus
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`; // Plus

        const actionTitle = isStaged ? 'Unstage' : 'Stage';

        div.innerHTML = `
            <span class="item-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #e37933">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
            </span>
            <span class="item-label">${name}</span>
            <span class="item-path">${folder}</span>
            <div class="git-actions">
                <div class="git-action-icon" title="Open File"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></div>
                <div class="git-action-icon" title="Discard Changes"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg></div>
                <div class="git-action-icon" title="${actionTitle}" onclick="handleGitAction(event, '${item.path}', ${isStaged})">
                    ${actionIcon}
                </div>
            </div>
            <span class="git-status-badge status-${statusClass}">${statusLetter}</span>
        `;

        div.title = item.path;
        div.onclick = (e) => {
            if (e.target.closest('.git-action-icon')) return;
            const fullPath = window.currentRootPath + '/' + item.path;
            window.openFile(fullPath);
        };

        container.appendChild(div);
    });
}

// Section Collapse/Expand
document.querySelectorAll('.git-section-header').forEach(header => {
    header.addEventListener('click', () => {
        const section = header.parentElement;
        const container = section.querySelector('.git-items-container');
        const icon = header.querySelector('.arrow-icon');

        const isHidden = container.style.display === 'none';
        container.style.display = isHidden ? 'block' : 'none';
        icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
    });
});

async function handleGitAction(event, filePath, isStaged) {
    event.stopPropagation();
    const workspacePath = window.currentRootPath;
    if (isStaged) {
        await window.electronAPI.gitUnstage(workspacePath, filePath);
    } else {
        await window.electronAPI.gitStage(workspacePath, filePath);
    }
    updateGitInfo();
}

gitCommitBtn.onclick = async () => {
    const message = gitCommitMessage.value.trim();
    if (!message) {
        return;
    }

    const workspacePath = window.currentRootPath;
    const result = await window.electronAPI.gitCommit(workspacePath, message);

    if (result.success) {
        gitCommitMessage.value = '';
        updateGitInfo();
    } else {
        alert('Commit failed: ' + result.error);
    }
};

// Ctrl+Enter to commit
gitCommitMessage.onkeydown = (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        gitCommitBtn.click();
    }
};

// Update every 5 seconds or on manual trigger
setInterval(updateGitInfo, 5000);

// Also update when workbench path changes
window.addEventListener('load', updateGitInfo);

// Expose update function
window.refreshGit = updateGitInfo;
