import { NextResponse } from 'next/server';
import { projectRegistry, ProjectNotFoundError } from '@/lib/projects/registry';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await projectRegistry.regenerateProject(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error('Failed to regenerate project:', error);
    return NextResponse.json({ error: 'Failed to regenerate project' }, { status: 400 });
  }
}
