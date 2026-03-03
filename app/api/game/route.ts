import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const dataDir = path.join(process.cwd(), '.data');
const saveFile = path.join(dataDir, 'game.json');

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

export async function GET() {
  try {
    const content = await fs.readFile(saveFile, 'utf8');
    return NextResponse.json(JSON.parse(content));
  } catch {
    return NextResponse.json({ messages: [], gameState: null });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await ensureDataDir();
    await fs.writeFile(saveFile, JSON.stringify(body, null, 2), 'utf8');
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'save failed' }, { status: 500 });
  }
}
