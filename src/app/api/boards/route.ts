import { NextResponse } from 'next/server';
import { getProjectStorage, handleProjectRouteError } from '@/lib/projects/server';

export async function GET(request: Request) {
  try {
    const { storage } = await getProjectStorage(request);
    const boardIds = await storage.listBoards();
    const boards = await Promise.all(boardIds.map(id => storage.readBoard(id)));

    return NextResponse.json({ boards });
  } catch (error) {
    console.error('Error fetching boards:', error);
    return handleProjectRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { storage } = await getProjectStorage(request);
    const board = await request.json();

    const now = new Date().toISOString();
    board.createdAt = board.createdAt || now;
    board.updatedAt = now;

    await storage.writeBoard(board);

    return NextResponse.json({ success: true, board });
  } catch (error) {
    console.error('Error creating board:', error);
    return handleProjectRouteError(error);
  }
}
