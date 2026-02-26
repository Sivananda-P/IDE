const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const aiStatus = document.getElementById('ai-status');

sendBtn.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text) return;

    addMessage('user', text);
    chatInput.value = '';

    // Disable input while AI is thinking
    chatInput.disabled = true;
    sendBtn.disabled = true;
    aiStatus.classList.remove('hidden');

    try {
        if (window.currentRootPath) {
            await window.electronAPI.setWorkspacePath(window.currentRootPath);
        }
        const response = await window.electronAPI.chatWithAI(text, window.currentRootPath || '');
        addMessage('ai', response);
    } catch (error) {
        addMessage('ai', 'Error: ' + error.message);
    } finally {
        chatInput.disabled = false;
        sendBtn.disabled = false;
        aiStatus.classList.add('hidden');
        chatInput.focus();
    }
});

function addMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}-message`;

    if (role === 'ai' && window.marked) {
        msgDiv.innerHTML = marked.parse(text);
    } else {
        msgDiv.innerText = text;
    }

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});
