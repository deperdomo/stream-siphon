import { NextResponse } from 'next/server';
import { ytDlp } from '@/lib/ytdlp';

export const dynamic = 'force-dynamic';

// Comprueba que el binario de yt-dlp existe y arranca (sin depender de YouTube).
export async function GET() {
  try {
    const version = (await ytDlp.execPromise(['--version'])).trim();
    return NextResponse.json({ status: 'healthy', yt_dlp: version });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : String(error) },
      { status: 503 }
    );
  }
}
