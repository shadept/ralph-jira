import path from 'node:path';
import { existsSync } from 'node:fs';

/**
 * @typedef {Object} AgentOptions
 * @property {string} name - The name of the agent.
 * @property {string} bin - The binary name or path to execute the agent.
 * @property {string} [model] - The model identifier for the agent.
 * @property {string[]} [extraArgs] - Additional command line arguments.
 * @property {string} [codingStyle] - Instructions regarding preferred coding style.
 * @property {string} [permissionMode] - (Claude specific) The permission mode for edits.
 */

/**
 * @typedef {Object} RunContext
 * @property {string} sandboxDir - The directory where the agent should run.
 * @property {(command: string, args: string[], cwd: string, options?: object) => Promise<{stdout: string, stderr: string, code: number}>} runCommand - Function to execute shell commands.
 * @property {(lines: string | string[]) => Promise<void>} appendSandboxLog - Function to append to the iteration log.
 * @property {number} iteration - The current iteration number.
 */

/**
 * Base class for all coding agents.
 */
export class Agent {
    /**
     * @param {AgentOptions} options
     */
    constructor(options) {
        this.name = options.name;
        this.bin = options.bin;
        this.model = options.model;
        this.extraArgs = options.extraArgs || [];
        this.codingStyle = options.codingStyle || '';
    }

    /**
     * Executes an iteration of the agent.
     * @param {RunContext} context
     * @returns {Promise<{ output: string, exitCode: number }>}
     */
    async run(context) {
        throw new Error('Method not implemented');
    }
}

/**
 * Agent implementation for Anthropic's Claude CLI.
 */
export class ClaudeAgent extends Agent {
    /**
     * @param {AgentOptions} options
     */
    constructor(options) {
        super(options);
        this.permissionMode = options.permissionMode || 'acceptEdits';
    }

    /**
     * @param {RunContext} context
     * @returns {Promise<{ output: string, exitCode: number }>}
     */
    async run({ sandboxDir, runCommand, appendSandboxLog, iteration }) {
        const promptLines = [
            '@plans/prd.json @progress.txt',
            '1. Find the highest-priority feature to work on and work only on that feature.',
            'This should be the one YOU decide has the highest priority - not necessarily the first in the list.',
            '2. Check that the types check via npm typecheck and that the tests pass via npm test.',
            '3. Update the PRD with the work that was done.',
            '4. Append your process to the progress.txt file.',
            'Use this to leave a note for the next person working in the codebase.',
            '5. make a git commit of the feature.',
            'ONLY WORK ON A SINGLE FEATURE.',
            'If, while implementing the feature, you notice the PRD is complete, output <promise>COMPLETE</promise>'
        ];

        let finalPrompt = promptLines.join('\n');

        if (this.codingStyle) {
            finalPrompt += `\n\n<coding-style>\n${this.codingStyle}\n</coding-style>`;
        }

        const args = [...this.extraArgs];

        if (!args.includes('--model') && this.model) {
            args.push('--model', this.model);
        }

        args.push(
            '--permission-mode', this.permissionMode,
            '--verbose',
            '--output-format', 'stream-json',
            '--include-partial-messages',
            '--print',
            finalPrompt
        );

        const describeInvocation = () => {
            const displayArgs = args.map(a => a === finalPrompt ? '[prompt omitted]' : a);
            return `${this.bin} ${displayArgs.join(' ')}`.trim();
        };

        await appendSandboxLog([
            `Running claude (iteration ${iteration})`,
            `Command: ${describeInvocation()}`,
        ]);

        let bin = this.bin;
        if (process.platform === 'win32' && bin === 'claude') {
            const userProfile = process.env.USERPROFILE || '';
            const possibleLocalBin = path.join(userProfile, '.local', 'bin', 'claude.exe');
            if (existsSync(possibleLocalBin)) {
                bin = possibleLocalBin;
            }
        }

        let stdoutBuffer = '';
        let fullContent = '';

        const onStdout = (chunk) => {
            stdoutBuffer += chunk.toString('utf-8');
            const lines = stdoutBuffer.split('\n');
            stdoutBuffer = lines.pop(); // Keep partial line

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const data = JSON.parse(line);
                    if (data.type === 'text' && data.text) {
                        appendSandboxLog(data.text).catch(() => { });
                        fullContent += data.text;
                    } else if (data.type === 'progress' && data.message) {
                        appendSandboxLog(`[Progress] ${data.message}`).catch(() => { });
                    } else if (data.type === 'error' && data.message) {
                        appendSandboxLog(`[Error] ${data.message}`).catch(() => { });
                    }
                } catch (e) {
                    // Not JSON or partial, just log as-is
                    appendSandboxLog(line).catch(() => { });
                }
            }
        };

        const result = await runCommand(bin, args, sandboxDir, { onStdout, timeout: 1800000 });

        // Final cleanup of content if needed, though stream-json should give us everything
        const finalOutput = fullContent || result.stdout;
        const combinedOutput = `${finalOutput}${result.stderr ? `\n${result.stderr}` : ''}`.trim();

        await appendSandboxLog(`Claude execution finished with code ${result.code}. Output length: ${combinedOutput.length}`);

        return { output: combinedOutput, exitCode: result.code ?? 0 };
    }
}

/**
 * Agent implementation for OpenCode.
 */
export class OpenCodeAgent extends Agent {
    /**
     * @param {RunContext} context
     * @returns {Promise<{ output: string, exitCode: number }>}
     */
    async run({ sandboxDir, runCommand, appendSandboxLog, iteration }) {
        const basePrompt = `READ all of @plans/prd.json. Pick ONE task. Verify via web/code search. Complete task, verify via CLI/Test output. Commit change. ONLY do one task. Update @plans/prd.json. If you learn a critical operational detail (e.g. how to build), update AGENTS.md. If all tasks done, sleep 5s and exit. NEVER GIT PUSH. ONLY COMMIT.`;

        const prompt = this.codingStyle
            ? `${basePrompt}\n\n<coding-style>\n${this.codingStyle}\n</coding-style>`
            : basePrompt;

        const args = ["run"];

        if (!args.includes('--model') && this.model) {
            args.push('--model', this.model);
        }

        args.push(...this.extraArgs, prompt);

        const describeInvocation = () => {
            return `${this.bin} ${args.map(a => a === prompt ? '[prompt omitted]' : a).join(' ')}`.trim();
        };

        await appendSandboxLog([
            `Running opencode (iteration ${iteration})`,
            `Command: ${describeInvocation()}`,
        ]);

        // Using shell: false to avoid parsing issues.
        const result = await runCommand(this.bin, args, sandboxDir, { timeout: 1800000 });
        const combinedOutput = `${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`.trim();

        return { output: combinedOutput, exitCode: result.code ?? 0 };
    }
}

/**
 * Factory function to create an agent by name.
 * @param {string} name - The type of agent to create ('claude' or 'opencode').
 * @param {AgentOptions} options - Configuration for the agent.
 * @returns {Agent}
 */
export function createAgent(name, options) {
    const normalizedName = name.toLowerCase();
    switch (normalizedName) {
        case 'claude':
            return new ClaudeAgent(options);
        case 'opencode':
            return new OpenCodeAgent(options);
        default:
            throw new Error(`Unsupported RUN_LOOP_AGENT "${name}". Set RUN_LOOP_AGENT to "claude" or "opencode".`);
    }
}
