import { NextResponse } from 'next/server';
import { getProjectStorage, handleProjectRouteError } from '@/lib/projects/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { storage } = await getProjectStorage(request);
    const board = await storage.readBoard(id);
    return NextResponse.json({ board });
  } catch (error) {
    console.error('Error fetching board:', error);
    return handleProjectRouteError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { storage } = await getProjectStorage(request);
    const updates = await request.json();

    const board = await storage.readBoard(id);

    const updatedBoard = {
      ...board,
      ...updates,
      id: board.id,
      updatedAt: new Date().toISOString(),
    };

    await storage.writeBoard(updatedBoard);

    return NextResponse.json({ success: true, board: updatedBoard });
  } catch (error) {
    console.error('Error updating board:', error);
    return handleProjectRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { storage } = await getProjectStorage(request);

    if (id === 'prd' || id === 'active') {
      return NextResponse.json(
        { error: 'Cannot delete the active board' },
        { status: 400 }
      );
    }

    await storage.deleteBoard(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting board:', error);
    return handleProjectRouteError(error);
  }
}
