import { NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { getProjectStorage, handleProjectRouteError } from '@/lib/projects/server';

export async function POST(request: Request) {
  try {
    const { storage } = await getProjectStorage(request);
    const { action, boardId, data } = await request.json();

    const board = await storage.readBoard(boardId);
    const settings = await storage.readSettings();

    switch (action) {
      case 'generate-tasks': {
        const { description, count = 5, category = 'functional' } = data;

        const result = await generateObject({
          model: openai(settings.aiPreferences.defaultModel || 'gpt-4-turbo'),
          schema: z.object({
            tasks: z.array(z.object({
              category: z.string(),
              description: z.string(),
              steps: z.array(z.string()),
              priority: z.enum(['low', 'medium', 'high', 'urgent']),
              estimate: z.number().optional(),
              tags: z.array(z.string()),
            })),
          }),
          prompt: `Generate ${count} specific, actionable tasks for the following feature or requirement:

"${description}"

Context:
- Project: ${settings.projectName}
- Tech Stack: ${settings.techStack.join(', ')}

Each task should:
- Have a clear, testable description
- Include 3-7 concrete acceptance steps
- Be scoped to take less than 1 day of work
- Include relevant tags
- Have realistic priority and story point estimate

Category: ${category}`,
        });

        // Convert to full task objects
        const now = new Date().toISOString();
        const newTasks = result.object.tasks.map((t, idx) => ({
          ...t,
          id: `task-${Date.now()}-${idx}`,
          passes: false,
          status: 'backlog' as const,
          createdAt: now,
          updatedAt: now,
          filesTouched: [],
        }));

        // Add to board
        board.tasks.push(...newTasks);
        board.updatedAt = now;
        if (board.metrics) {
          board.metrics.total = board.tasks.length;
        }

        await storage.writeBoard(board);

        return NextResponse.json({ success: true, tasks: newTasks });
      }

      case 'prioritize': {
        const { criteria } = data;

        const result = await generateObject({
          model: openai(settings.aiPreferences.defaultModel || 'gpt-4-turbo'),
          schema: z.object({
            prioritized: z.array(z.object({
              taskId: z.string(),
              priority: z.enum(['low', 'medium', 'high', 'urgent']),
              reasoning: z.string(),
            })),
          }),
          prompt: `Prioritize these tasks based on: ${criteria || 'business value, dependencies, and risk'}

Tasks:
${board.tasks.map(t => `- [${t.id}] ${t.description} (current: ${t.priority})`).join('\n')}

Project context: ${settings.projectDescription}`,
        });

        // Update task priorities
        result.object.prioritized.forEach(({ taskId, priority }) => {
          const task = board.tasks.find(t => t.id === taskId);
          if (task) {
            task.priority = priority;
            task.updatedAt = new Date().toISOString();
          }
        });

        await storage.writeBoard(board);

        return NextResponse.json({
          success: true,
          prioritized: result.object.prioritized
        });
      }

      case 'split-sprints': {
        const result = await generateObject({
          model: openai(settings.aiPreferences.defaultModel || 'gpt-4-turbo'),
          schema: z.object({
            sprints: z.array(z.object({
              name: z.string(),
              goal: z.string(),
              taskIds: z.array(z.string()),
              durationWeeks: z.number(),
            })),
          }),
          prompt: `Split these ${board.tasks.length} tasks into logical sprints (2-3 week iterations).

Tasks:
${board.tasks.map(t => `- [${t.id}] ${t.description} (${t.priority}, ${t.estimate || '?'} pts)`).join('\n')}

Consider:
- Dependencies between tasks
- Priority and risk
- Team velocity (assume ~20-30 pts per sprint)
- Logical groupings`,
        });

        return NextResponse.json({
          success: true,
          sprints: result.object.sprints
        });
      }

      case 'improve-acceptance': {
        const result = await generateText({
          model: openai(settings.aiPreferences.defaultModel || 'gpt-4-turbo'),
          prompt: `Review and improve the acceptance criteria for these tasks. Make them more specific, testable, and comprehensive.

Tasks:
${board.tasks.slice(0, 10).map(t => `
Task: ${t.description}
Current steps:
${t.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
`).join('\n---\n')}

Provide improved acceptance criteria that are SMART (Specific, Measurable, Achievable, Relevant, Time-bound).`,
        });

        return NextResponse.json({
          success: true,
          improvements: result.text
        });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AI board action error:', error);
    return handleProjectRouteError(error);
  }
}
