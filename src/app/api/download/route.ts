import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import type { DownloadRequest } from '@/lib/types';
import { isYoutubeUrl } from '@/lib/utils';
import { baseArgs, friendlyError, ytDlp } from '@/lib/ytdlp';

export const maxDuration = 300;

// ponytail: los archivos viven en el /tmp de esta instancia hasta que el navegador
// los recoge con GET. En serverless con varias instancias el GET puede caer en otra;
// si eso ocurre, pasar a almacenamiento compartido (S3/Blob).
const ROOT = join(tmpdir(), 'stream-siphon');
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

function purgeOld() {
  try {
    for (const name of readdirSync(ROOT)) {
      const dir = join(ROOT, name);
      if (Date.now() - statSync(dir).mtimeMs > 60 * 60 * 1000) rmSync(dir, { recursive: true, force: true });
    }
  } catch {}
}

/** Ejecuta yt-dlp dejando un único archivo en un directorio nuevo. Devuelve su id. */
function run(args: string[], url: string, passes: number, onPercent: (p: number) => void) {
  const id = randomUUID();
  const dir = join(ROOT, id);
  mkdirSync(dir, { recursive: true });
  return new Promise<{ id: string; filename: string }>((resolve, reject) => {
    // Un video son dos descargas (video + audio): cada vez que el % retrocede, empieza la siguiente
    let pass = 0;
    let last = 0;
    ytDlp
      .exec([...baseArgs(), ...args, '--newline', '-o', join(dir, '%(title).150B.%(ext)s'), url])
      .on('progress', ({ percent }) => {
        if (typeof percent !== 'number' || Number.isNaN(percent)) return;
        if (percent < last && pass < passes - 1) pass++;
        last = percent;
        onPercent((pass * 100 + percent) / passes);
      })
      .on('error', (error) => {
        rmSync(dir, { recursive: true, force: true });
        reject(error);
      })
      .on('close', () => {
        const filename = readdirSync(dir).find((f) => !f.endsWith('.part'));
        if (filename) return resolve({ id, filename });
        rmSync(dir, { recursive: true, force: true });
        reject(new Error('La descarga terminó sin generar ningún archivo.'));
      });
  });
}

// En ambos selectores se prefiere la pista de audio en español cuando el video tiene varias.

function videoArgs(height?: number) {
  const h = height ? `[height<=${height}]` : '';
  return [
    '-f', `bv*${h}+ba[language^=es]/bv*${h}+ba/b${h}/b`,
    // A igual resolución y fps, H.264 + AAC: lo que mejor se reproduce dentro de un MP4
    '-S', 'res,fps,vcodec:h264,acodec:aac',
    '--merge-output-format', 'mp4',
  ];
}

function audioArgs(kbps = 192) {
  return ['-f', 'ba[language^=es]/ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', `${kbps}K`];
}

/** Inicia la descarga. Responde en streaming NDJSON: {progress,message}… y al final {files} o {error}. */
export async function POST(req: NextRequest) {
  let body: DownloadRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 });
  }
  const { youtubeUrl, kind } = body;
  const height = Number.isInteger(body.height) && body.height! > 0 ? body.height : undefined;
  const kbps = Number.isInteger(body.kbps) && body.kbps! >= 32 && body.kbps! <= 320 ? body.kbps : undefined;

  if (typeof youtubeUrl !== 'string' || !isYoutubeUrl(youtubeUrl)) {
    return NextResponse.json({ error: 'URL de YouTube inválida' }, { status: 400 });
  }
  if (!['video', 'audio', 'dual'].includes(kind)) {
    return NextResponse.json({ error: 'Tipo de descarga inválido' }, { status: 400 });
  }

  purgeOld();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
        } catch {} // el cliente cerró la conexión
      };
      // from..to: tramo de la barra que ocupa esta fase
      const step = (label: string, from: number, to: number) => (p: number) =>
        send({
          progress: from + (p * (to - from)) / 100,
          message: p >= 100 ? 'Procesando…' : `${label} ${Math.floor(p)} %`,
        });

      try {
        send({ progress: 0, message: 'Conectando con YouTube…' });
        const files = [];
        if (kind === 'video') {
          files.push(await run(videoArgs(height), youtubeUrl, 2, step('Descargando video', 0, 100)));
        } else if (kind === 'audio') {
          files.push(await run(audioArgs(kbps), youtubeUrl, 1, step('Descargando audio', 0, 100)));
        } else {
          files.push(await run(videoArgs(height), youtubeUrl, 2, step('Descargando video', 0, 70)));
          files.push(await run(audioArgs(kbps), youtubeUrl, 1, step('Descargando audio', 70, 100)));
        }
        send({ files });
      } catch (error) {
        console.error('[download] failed:', error);
        send({ error: friendlyError(error) });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

/** Entrega (y elimina) un archivo ya preparado. Solo acepta ids generados por POST. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!UUID.test(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 });

  const dir = join(ROOT, id);
  let filename: string | undefined;
  try {
    filename = readdirSync(dir)[0];
  } catch {}
  if (!filename) return NextResponse.json({ error: 'El archivo ya no está disponible' }, { status: 404 });

  const path = join(dir, filename);
  const file = createReadStream(path);
  file.on('close', () => rmSync(dir, { recursive: true, force: true }));

  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return new Response(Readable.toWeb(file) as ReadableStream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(statSync(path).size),
      'Cache-Control': 'no-store',
    },
  });
}
