const Groq = require('groq-sdk');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const EventEmitter = require('events');
require('dotenv').config();

class AIAgent extends EventEmitter {
    constructor() {
        super();
        this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        this.messages = [];
        this.workspacePath = process.cwd();
        this.systemPrompt = `You are Cognifyr AI, an elite agentic software engineer.
Your goal is to assist the user by planning and executing complex software engineering tasks.

Capabilities:
- You can navigate the codebase using list_files and grep_search.
- You can read and write files. Use replace_lines for targeted edits when possible.
- You can run terminal commands.

Operating Guidelines:
1. **Think First**: For complex requests, always start with an implementation plan.
2. **Exploration**: If unsure about the project structure or a specific piece of logic, use list_files or grep_search.
3. **Precision**: Use replace_lines to modify specific parts of a file. This is safer than rewriting the entire file.
4. **Context**: Summarize your progress periodically in your responses.
5. **Error Handling**: If a command or tool fails, analyze the output and attempt a correction.
6. **Paths**: Always use relative paths for tools — they will be resolved relative to the current workspace.

Current workspace: will be set per message`;

        this.tools = [
            {
                type: 'function',
                function: {
                    name: 'write_file',
                    description: 'Write, update, or save a file in the project.',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'The relative path to the file.' },
                            content: { type: 'string', description: 'The new content of the file.' }
                        },
                        required: ['path', 'content']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'read_file',
                    description: 'Read the contents of a file.',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'The relative path to the file.' }
                        },
                        required: ['path']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'run_command',
                    description: 'Run a command in the terminal.',
                    parameters: {
                        type: 'object',
                        properties: {
                            command: { type: 'string', description: 'The command to execute.' }
                        },
                        required: ['command']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'list_files',
                    description: 'List files in a directory to understand project structure.',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'The relative path to the directory.' }
                        },
                        required: ['path']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'grep_search',
                    description: 'Search for a string across all files in a directory (recursive).',
                    parameters: {
                        type: 'object',
                        properties: {
                            directory: { type: 'string', description: 'The directory to search in.' },
                            query: { type: 'string', description: 'The string to search for.' }
                        },
                        required: ['directory', 'query']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'replace_lines',
                    description: 'Replace specific lines in a file by providing the line range.',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'The path to the file.' },
                            startLine: { type: 'number', description: 'The starting line number (1-indexed).' },
                            endLine: { type: 'number', description: 'The ending line number (1-indexed).' },
                            content: { type: 'string', description: 'The new content to insert.' }
                        },
                        required: ['path', 'startLine', 'endLine', 'content']
                    }
                }
            }
        ];
    }

    async sendMessage(userInput, workspacePath) {
        // Update workspace path if provided
        if (workspacePath && workspacePath.trim()) {
            this.workspacePath = workspacePath.trim();
        }
        // Inject current workspace into system prompt
        const systemPromptWithWorkspace = this.systemPrompt.replace(
            'Current workspace: will be set per message',
            `Current workspace: ${this.workspacePath}\nAll relative paths you provide to tools are resolved relative to this workspace.`
        );
        if (userInput) {
            this.messages.push({ role: 'user', content: userInput });
        }

        // Sliding window context management
        const MAX_MESSAGES = 20;
        if (this.messages.length > MAX_MESSAGES) {
            const pruneNote = { role: 'user', content: '[System: Previous conversation pruned for context. Focus on current task.]' };
            this.messages = [pruneNote, ...this.messages.slice(-10)];
        }

        const MAX_TOOL_CALLS = 10;
        let toolCallCount = 0;

        try {
            while (toolCallCount < MAX_TOOL_CALLS) {
                const response = await this.groq.chat.completions.create({
                    model: 'llama-3.3-70b-versatile',
                    max_tokens: 4096,
                    messages: [
                        { role: 'system', content: systemPromptWithWorkspace },
                        ...this.messages
                    ],
                    tools: this.tools,
                    tool_choice: 'auto'
                });

                const choice = response.choices[0];
                const message = choice.message;

                // Add assistant message to history
                this.messages.push(message);

                // No tool calls — return final text
                if (!message.tool_calls || message.tool_calls.length === 0) {
                    return message.content;
                }

                // Execute all tool calls
                toolCallCount++;
                for (const toolCall of message.tool_calls) {
                    const { name, arguments: argsStr } = toolCall.function;
                    let args;
                    try {
                        args = JSON.parse(argsStr);
                    } catch (e) {
                        args = {};
                    }

                    console.log(`Executing tool: ${name}`, args);
                    const result = await this.executeTool(name, args);
                    console.log(`Tool result for ${name}:`, result);

                    this.messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(result)
                    });
                }
            }

            return 'Max tool call limit reached. Please try a simpler request.';
        } catch (error) {
            console.error('AI Agent Error:', error);
            return `Error: ${error.message}`;
        }
    }

    async executeTool(name, input) {
        const resolvePath = (p) => path.isAbsolute(p) ? p : path.join(this.workspacePath, p);

        switch (name) {
            case 'write_file':
                try {
                    const fullPath = resolvePath(input.path);
                    await fs.writeFile(fullPath, input.content);
                    this.emit('file-changed', { path: fullPath, type: 'write' });
                    return { status: 'success', message: `File ${input.path} written to: ${fullPath}` };
                } catch (err) {
                    return { error: err.message };
                }

            case 'read_file':
                try {
                    const fullPath = resolvePath(input.path);
                    const content = await fs.readFile(fullPath, 'utf-8');
                    return { content };
                } catch (err) {
                    return { error: err.message };
                }

            case 'run_command':
                return new Promise((resolve) => {
                    this.emit('command-started', { command: input.command });
                    exec(input.command, { cwd: this.workspacePath }, (error, stdout, stderr) => {
                        const result = {
                            stdout: stdout || '',
                            stderr: stderr || '',
                            error: error ? error.message : null
                        };
                        this.emit('command-finished', { command: input.command, result });
                        resolve(result);
                    });
                });

            case 'list_files':
                try {
                    const fullPath = resolvePath(input.path);
                    const files = await fs.readdir(fullPath, { withFileTypes: true });
                    return {
                        files: files.map(f => ({
                            name: f.name,
                            isDirectory: f.isDirectory()
                        }))
                    };
                } catch (err) {
                    return { error: err.message };
                }

            case 'grep_search':
                return new Promise((resolve) => {
                    const searchDir = resolvePath(input.directory);
                    const cmd = `powershell -Command "Get-ChildItem -Path '${searchDir}' -Recurse | Select-String -Pattern '${input.query}' | Select-Object LineNumber, Line, Path | ConvertTo-Json"`;
                    exec(cmd, { cwd: this.workspacePath }, (error, stdout, stderr) => {
                        try {
                            const results = stdout ? JSON.parse(stdout) : [];
                            resolve({ results: Array.isArray(results) ? results.slice(0, 50) : [results] });
                        } catch (e) {
                            resolve({ status: 'no_results', message: 'No matches found.' });
                        }
                    });
                });

            case 'replace_lines':
                try {
                    const fullPath = resolvePath(input.path);
                    const fullContent = await fs.readFile(fullPath, 'utf-8');
                    const lines = fullContent.split('\n');
                    lines.splice(input.startLine - 1, input.endLine - input.startLine + 1, input.content);
                    await fs.writeFile(fullPath, lines.join('\n'));
                    this.emit('file-changed', { path: fullPath, type: 'replace' });
                    return { status: 'success', message: `Lines ${input.startLine}-${input.endLine} replaced in ${input.path}.` };
                } catch (err) {
                    return { error: err.message };
                }

            default:
                return { error: 'Unknown tool' };
        }
    }
}

module.exports = AIAgent;
