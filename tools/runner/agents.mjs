export class Agent {
    constructor(options) {
        this.name = options.name;
        this.bin = options.bin;
        this.model = options.model;
        this.extraArgs = options.extraArgs || [];
        this.codingStyle = options.codingStyle || '';
    }

    /**
     * @param {object} context
     * @param {string} context.sandboxDir
     * @param {Function} context.runCommand
     * @param {Function} context.appendSandboxLog
     * @returns {Promise<{ output: string, exitCode: number }>}
     */
    async run(context) {
        throw new Error('Method not implemented');
    }
}

export class ClaudeAgent extends Agent {
    constructor(options) {
        super(options);
        this.permissionMode = options.permissionMode || 'acceptEdits';
    }

    async run({ sandboxDir, runCommand, appendSandboxLog, iteration }) {
        const basePrompt = `@plans/prd.json @progress.txt
1. Find the highest-priority feature to work on and work only on that feature.
This should be the one YOU decide has the highest priority - not necessarily the first in the list.
2. Check that the types check via npm typecheck and that the tests pass via npm test.
3. Updarte the PRD with the work that was done.
4. Append your process to the progress.txt file.
5. make a git commit of the feature.
ONLY WORK ON A SINGLE FEATURE.
If, while implementing the feature, you notice the PRD is complete, output <promise>COMPLETE</promise>`;

        const prompt = this.codingStyle
            ? `${basePrompt}\n<coding-style>\n${this.codingStyle}\n</coding-style>`
            : basePrompt;

        const args = [...this.extraArgs];

        if (!args.includes('--model') && this.model) {
            args.push('--model', this.model);
        }

        args.push('--permission-mode', this.permissionMode, '--print', prompt);

        const describeInvocation = () => {
            return `${this.bin} ${args.map(a => a === prompt ? '[prompt omitted]' : a).join(' ')}`.trim();
        };

        await appendSandboxLog([
            `Running claude (iteration ${iteration})`,
            `Command: ${describeInvocation()}`,
        ]);

        const result = await runCommand(this.bin, args, sandboxDir, { shell: true });
        const combinedOutput = `${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`.trim();

        return { output: combinedOutput, exitCode: result.code ?? 0 };
    }
}

export class OpenCodeAgent extends Agent {
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

        const result = await runCommand(this.bin, args, sandboxDir, { shell: true });
        const combinedOutput = `${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`.trim();

        return { output: combinedOutput, exitCode: result.code ?? 0 };
    }
}

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
