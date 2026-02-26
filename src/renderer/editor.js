require.config({ paths: { 'vs': '../../node_modules/monaco-editor/min/vs' } });

require(['vs/editor/editor.main'], function () {
    window.editor = monaco.editor.create(document.getElementById('editor'), {
        value: '',
        language: 'plaintext',
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
        fontLigatures: true,
        minimap: { enabled: true },
        padding: { top: 16 },
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        scrollbar: {
            vertical: 'hidden',
            horizontal: 'auto',
            useShadows: false,
        }
    });


    // Add Save Shortcut (Ctrl+S)
    window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function () {
        saveCurrentFile();
    });
});

async function saveCurrentFile() {
    if (!window.currentFilePath) {
        console.log('No file open to save');
        return;
    }
    const content = window.editor.getValue();
    const result = await window.electronAPI.writeFile(window.currentFilePath, content);

    if (result.success) {
        console.log('File saved successfully:', window.currentFilePath);
        // We could add a UI notification here
    } else {
        console.error('Failed to save file:', result.error);
        alert('Failed to save file: ' + result.error);
    }
}
