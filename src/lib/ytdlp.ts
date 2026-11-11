import YTDlpWrap from 'yt-dlp-wrap';
import ffmpegPath from 'ffmpeg-static';
import { existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function binaryPath(): string {
  if (process.env.YT_DLP_PATH) return process.env.YT_DLP_PATH;
  if (process.platform === 'win32') return join(process.cwd(), 'yt-dlp.exe');
  const local = join(process.cwd(), 'bin', 'yt-dlp'); // descargado por scripts/fetch-yt-dlp.js
  return existsSync(local) ? local : 'yt-dlp';
}

export const ytDlp = new YTDlpWrap(binaryPath());

/** Argumentos comunes a todas las llamadas a yt-dlp. */
export function baseArgs(): string[] {
  const args = [
    '--no-playlist',
    '--no-warnings',
    // YouTube exige un runtime JS; reutilizamos el Node que ya ejecuta la app
    '--js-runtimes', `node:${process.execPath}`,
  ];
  if (ffmpegPath && existsSync(ffmpegPath)) args.push('--ffmpeg-location', ffmpegPath);
  // Opcional: contenido de un cookies.txt (formato Netscape) para cuando YouTube
  // bloquea la IP del servidor con "Sign in to confirm you're not a bot".
  if (process.env.YT_DLP_COOKIES) {
    const file = join(tmpdir(), 'yt-dlp-cookies.txt');
    writeFileSync(file, process.env.YT_DLP_COOKIES);
    args.push('--cookies', file);
  }
  return args;
}

/** Traduce errores de yt-dlp a un mensaje claro para el usuario. */
export function friendlyError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const m = msg.toLowerCase();
  if (m.includes('enoent')) return 'yt-dlp no está disponible en el servidor.';
  if (m.includes('not a bot') || m.includes('sign in to confirm'))
    return 'YouTube está bloqueando a este servidor (verificación anti-bot). Inténtalo más tarde.';
  if (m.includes('private video')) return 'Este video es privado.';
  if (m.includes('age')) return 'Este video tiene restricción de edad y no se puede descargar.';
  if (m.includes('unavailable') || m.includes('404')) return 'Video no disponible. Verifica la URL.';
  if (m.includes('429')) return 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
  if (m.includes('403')) return 'YouTube denegó el acceso al video. Inténtalo más tarde.';
  if (m.includes('timeout') || m.includes('timed out')) return 'La operación tardó demasiado. Inténtalo de nuevo.';
  const line = msg.split('\n').find((l) => l.startsWith('ERROR:'));
  return line ? line.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/, '') : 'No se pudo procesar el video.';
}
