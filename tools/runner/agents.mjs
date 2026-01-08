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
        const prompt = [
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
        ].join(' ');

        const finalPrompt = this.codingStyle
            ? `${prompt} <coding-style>${this.codingStyle}</coding-style>`
            : prompt;

        const args = [...this.extraArgs];

        if (!args.includes('--model') && this.model) {
            args.push('--model', this.model);
        }

        args.push('--permission-mode', this.permissionMode, '--print', finalPrompt);

        const describeInvocation = () => {
            return `${this.bin} ${args.map(a => a === finalPrompt ? '[prompt omitted]' : a).join(' ')}`.trim();
        };

        await appendSandboxLog([
            `Running claude (iteration ${iteration})`,
            `Command: ${describeInvocation()}`,
        ]);

        const result = await runCommand(this.bin, args, sandboxDir, { shell: false });
        const combinedOutput = `${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`.trim();

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

        const result = await runCommand(this.bin, args, sandboxDir, { shell: false });
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
