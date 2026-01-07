# Quick Start Guide

## Installation (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local and add: OPENAI_API_KEY=sk-your-key-here

# 3. Start the app
npm run dev

# 4. Open browser
# Navigate to http://localhost:3000
```

## First Steps

### 1. View the Dashboard
- See the active board "Initial Sprint" with 3 sample tasks
- Click "Open Board" to view the Kanban interface

### 2. Manage Tasks
- Drag tasks between columns (Backlog → To Do → In Progress → Review → Done)
- Click any task to edit details
- Click "New Task" to create more tasks

### 3. Use AI Assistant
- Go to `/assistant`
- Describe a feature (e.g., "Add user authentication with email login")
- Click "Generate Tasks" - AI creates actionable tasks for you

### 4. Configure Settings
- Go to `/settings`
- Update project name, tech stack, test commands
- Set AI preferences and guardrails

### 5. Run the AI Loop
- Open any board and click **Run AI Loop** (top-right)
- Or send `POST /api/runs/start` with `{ "boardId": "prd" }`

The runner will:
- Clone the repo into `.pm/sandboxes/<runId>`
- Read only the `todo` + `in_progress` tasks from `plans/prd.json`
- Generate implementation notes via the Vercel AI SDK
- Run your configured test/typecheck commands inside the sandbox
- Update sandbox `plans/prd.json` and append to `progress.txt`
- Sync the results back into the main `plans/prd.json` and `progress.txt`

### 6. View Progress
- Go to `/files`
- See the progress log with all AI actions

## Key Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm start                # Run production build

# AI Runner
curl -X POST "http://localhost:3000/api/runs/start?projectId=current-workspace" \
  -H "Content-Type: application/json" \
  -d '{"boardId":"prd"}'

# Quality
npm run typecheck        # Type checking
npm run lint             # Linting

# Docker
docker compose up web                    # Run webapp
docker compose run runner                # Run AI runner
```

## Files to Know

- **`plans/prd.json`** - Your active board (edit via UI or directly)
- **`plans/settings.json`** - Project configuration
- **`progress.txt`** - AI execution log
- **`.env.local`** - Your API keys (gitignored)

## Common Tasks

### Create a New Sprint
1. Dashboard → "New Board"
2. Edit name, goal, deadline
3. Add tasks or use AI to generate them

### Generate Tasks with AI
1. `/assistant` → paste feature description
2. Click "Generate Tasks"
3. Tasks appear in your active board

### Run Autonomous Execution
1. Ensure tests and automation settings are configured in Settings
2. Click **Run AI Loop** on a board (or call `POST /api/runs/start`)
3. Watch the run drawer or `/runs` for live status/logs

### Deploy to Production
```bash
# Option 1: Vercel (web only)
# Connect repo to Vercel, add OPENAI_API_KEY env var

# Option 2: Docker
docker compose up -d web
```

## Troubleshooting

**"Failed to load board"**
- Check `plans/prd.json` exists and is valid JSON

**"AI action failed"**
- Verify `OPENAI_API_KEY` is set in `.env.local`
- Check API key is valid

**Runner won't start**
- Ensure `plans/prd.json` and `plans/settings.json` exist
- Verify `OPENAI_API_KEY` environment variable
- Confirm `plans/runs/` and `.pm/` are writable
- If using Docker mode, set `RUN_LOOP_EXECUTOR=docker` and rerun the request

**Type errors**
- Run `npm run typecheck` to see details
- Ensure all dependencies installed

## Next Steps

1. **Customize Settings** - Update tech stack, test commands, coding style
2. **Add Your Tasks** - Replace sample tasks with your project needs
3. **Test AI Generation** - Experiment with task generation prompts
4. **Run the Runner** - Try autonomous execution on a simple task
5. **Review Architecture** - Read `README.md` and `IMPLEMENTATION_SUMMARY.md`

## Tips

- **Start Small**: Test runner on simple tasks first
- **Review Logs**: Check `progress.txt` to understand AI decisions
- **Use Tags**: Organize tasks with tags (ui, api, testing, etc.)
- **Set Priorities**: High-priority tasks run first
- **Check Tests**: Ensure test commands work before running autonomously

## Support

- **Documentation**: See `README.md` for full details
- **Architecture**: See `IMPLEMENTATION_SUMMARY.md` for technical overview
- **Issues**: Check troubleshooting section in README

---

**You're ready to go!** Start with `npm run dev` and explore the interface.
