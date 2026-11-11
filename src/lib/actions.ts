'use server';

import type { AnalysisResult } from './types';
import { isYoutubeUrl } from './utils';
import { baseArgs, friendlyError, ytDlp } from './ytdlp';

function formatDuration(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(Math.floor(total % 60)).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// Devuelve { error } en vez de lanzar: Next oculta los mensajes de las
// excepciones de server actions en producción.
export async function performYoutubeAnalysis(youtubeUrl: string): Promise<AnalysisResult> {
  if (!isYoutubeUrl(youtubeUrl)) return { error: 'La URL no es un enlace de YouTube válido.' };

  const controller = new AbortController();
  try {
    const timer = setTimeout(() => controller.abort(), 45_000);
    let stdout: string;
    try {
      stdout = await ytDlp.execPromise([...baseArgs(), '-J', youtubeUrl], {}, controller.signal);
    } finally {
      clearTimeout(timer);
    }
    const info = JSON.parse(stdout);

    const heights = new Set<number>();
    for (const f of info.formats ?? []) {
      if (f.vcodec && f.vcodec !== 'none' && Number(f.height) > 0) heights.add(Number(f.height));
    }

    return {
      title: info.title || 'Video sin título',
      duration: info.duration ? formatDuration(Number(info.duration)) : '',
      thumbnailUrl: info.thumbnail ?? info.thumbnails?.at(-1)?.url ?? '',
      heights: [...heights].sort((a, b) => b - a),
    };
  } catch (error) {
    console.error('Error analyzing YouTube URL:', error);
    return { error: friendlyError(controller.signal.aborted ? 'timeout' : error) };
  }
}
