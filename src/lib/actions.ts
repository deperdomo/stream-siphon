'use server';

import YTDlpWrap from 'yt-dlp-wrap';
import { join } from 'path';
import type {
  AnalyzeYoutubeUrlInput,
  AnalyzeYoutubeUrlOutput,
  DownloadYoutubeVideoInput,
  DownloadYoutubeVideoOutput,
} from './types';

type YtDlpFormat = {
  vcodec?: string;
  acodec?: string;
  ext?: string;
  height?: number | string;
  resolution?: string | number;
  fps?: number | string;
  dynamic_range?: string;
  abr?: number | string;
  url?: string;
  audioTrack?: {
    displayName?: string;
    id?: string;
  };
  language?: string;
};

type YtDlpThumbnail = {
  url?: string;
};

type YtDlpVideoDetails = {
  title: string;
  lengthSeconds?: number | string;
};

type YtDlpVideoInfo = {
  title?: string;
  fulltitle?: string;
  duration?: number | string;
  thumbnail?: string;
  thumbnails?: YtDlpThumbnail[];
  formats?: YtDlpFormat[];
  requested_formats?: YtDlpFormat[];
  videoDetails?: YtDlpVideoDetails;
};

function secondsToHms(d: number): string {
  d = Number(d);
  const h = Math.floor(d / 3600);
  const m = Math.floor((d % 3600) / 60);
  const s = Math.floor((d % 3600) % 60);

  const hDisplay = h > 0 ? h + (h === 1 ? ' hour, ' : ' hours, ') : '';
  const mDisplay = m > 0 ? m + (m === 1 ? ' minute, ' : ' minutes, ') : '';
  const sDisplay = s > 0 ? s + (s === 1 ? ' second' : ' seconds') : '';
  return (hDisplay + mDisplay + sDisplay).replace(/, $/, '');
}

export async function performYoutubeAnalysis(
  input: AnalyzeYoutubeUrlInput
): Promise<AnalyzeYoutubeUrlOutput> {
  try {
    const { youtubeUrl } = input;
    
    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/;
    if (!youtubeRegex.test(youtubeUrl)) {
      throw new Error('Invalid YouTube URL');
    }

    console.log('Analyzing URL:', youtubeUrl);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Platform:', process.platform);
    
    // Initialize yt-dlp (platform-aware path)
    const ytDlpPath = process.platform === 'win32' 
      ? join(process.cwd(), 'yt-dlp.exe')
      : 'yt-dlp';
    const ytDlp = new YTDlpWrap(ytDlpPath);
    
    // Get video info with timeout
      const info = await Promise.race<YtDlpVideoInfo | never>([
        ytDlp.getVideoInfo(youtubeUrl) as Promise<YtDlpVideoInfo>,
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout: Video analysis took too long')), 25000)
        )
      ]);
    
    console.log('Video info retrieved successfully');
    console.log('Video title:', info?.title);
    console.log('Info keys:', Object.keys(info || {}));
    console.log('First few characters of info:', JSON.stringify(info).substring(0, 500));
    console.log('All available formats:', info?.formats?.length);
    
    // Verify info structure and provide fallbacks
    if (!info) {
      throw new Error('No video information received from yt-dlp');
    }
    
    // yt-dlp returns different structure, let's handle both formats and requested_formats
  const formats: YtDlpFormat[] = (info.formats ?? info.requested_formats ?? []) as YtDlpFormat[];

    const supportedVideoContainers = new Set(['mp4', 'webm', 'mkv', 'mov', 'm4v']);

  const getHeightValue = (f: YtDlpFormat | undefined): number => {
      if (!f) return 0;
      const height = f.height;
      if (typeof height === 'number' && !Number.isNaN(height)) return height;
      if (typeof height === 'string') {
        const parsed = parseInt(height, 10);
        if (!Number.isNaN(parsed)) return parsed;
      }

  const resolution = f?.resolution;
      if (typeof resolution === 'string') {
        const match = resolution.toLowerCase().match(/(\d+)[x×](\d+)/);
        if (match) {
          const maybeHeight = parseInt(match[2], 10);
          if (!Number.isNaN(maybeHeight)) {
            return maybeHeight;
          }
          const maybeWidth = parseInt(match[1], 10);
          if (!Number.isNaN(maybeWidth)) {
            return maybeWidth;
          }
        }
      }

      if (typeof resolution === 'number' && !Number.isNaN(resolution)) {
        return resolution;
      }

      return 0;
    };

    const getFpsValue = (f: YtDlpFormat | undefined): number | null => {
      const fps = f?.fps;
      if (typeof fps === 'number' && fps > 0) {
        return Math.round(fps);
      }
      if (typeof fps === 'string') {
        const parsed = parseFloat(fps);
        if (!Number.isNaN(parsed) && parsed > 0) {
          return Math.round(parsed);
        }
      }
      return null;
    };

    const buildVideoLabel = (f: YtDlpFormat | undefined): { label: string; heightScore: number } | null => {
      if (!f || !f.vcodec || f.vcodec === 'none') return null;
      const extension = f.ext;
      if (!extension || !supportedVideoContainers.has(extension)) return null;

      const height = getHeightValue(f);
      const fps = getFpsValue(f);
      const baseResolution = height > 0
        ? `${height}p${fps && fps > 30 ? fps : ''}`
        : (typeof f.resolution === 'string' ? f.resolution : 'Unknown');
      const attributes: string[] = [];

      if (typeof f.dynamic_range === 'string' && f.dynamic_range.toUpperCase().includes('HDR')) {
        attributes.push('HDR');
      }

      if (typeof f.vcodec === 'string' && f.vcodec !== 'none') {
        const codec = f.vcodec.split('.')[0]?.toUpperCase();
        if (codec) {
          attributes.push(codec);
        }
      }

      if (typeof extension === 'string') {
        attributes.push(extension.toUpperCase());
      }

      const label = attributes.length > 0
        ? `${baseResolution} (${attributes.filter(Boolean).join(' / ')})`
        : baseResolution;

      return {
        label,
        heightScore: height,
      };
    };

    const videoFormatMap = new Map<string, { label: string; heightScore: number }>();

    for (const fmt of formats) {
      const entry = buildVideoLabel(fmt);
      if (!entry) continue;
      if (!videoFormatMap.has(entry.label)) {
        videoFormatMap.set(entry.label, entry);
      } else {
        const existing = videoFormatMap.get(entry.label)!;
        if (entry.heightScore > existing.heightScore) {
          videoFormatMap.set(entry.label, entry);
        }
      }
    }

    let uniqueVideoFormats = Array.from(videoFormatMap.values())
      .sort((a, b) => {
        if (b.heightScore === a.heightScore) {
          return a.label.localeCompare(b.label);
        }
        return b.heightScore - a.heightScore;
      })
      .map((entry) => entry.label);

    console.log('Video format options (enhanced):', uniqueVideoFormats);

    // Always offer a "best available" option first
    if (!uniqueVideoFormats.includes('best')) {
      uniqueVideoFormats = ['best', ...uniqueVideoFormats];
    }

    // Get audio formats with better filtering - show ALL available bitrates
    const audioFormats = formats
      .filter((f: YtDlpFormat) => 
        f.acodec && f.acodec !== 'none' && 
        (!f.vcodec || f.vcodec === 'none') && 
        f.abr &&
        (f.ext === 'mp4' || f.ext === 'webm' || f.ext === 'm4a' || f.ext === 'mp3')
      )
      .map((f) => `${Math.floor(Number(f.abr))}kbps` as string)
      .filter(Boolean);

    const uniqueAudioFormats = Array.from(new Set(audioFormats)) as string[];
    uniqueAudioFormats.sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
    
    console.log('Final video formats (ALL QUALITIES - high res supported):', uniqueVideoFormats);
    console.log('Audio formats found (will output MP3):', uniqueAudioFormats);
    
    // Si no encontramos formatos, agregar algunos predeterminados
    if (uniqueVideoFormats.length === 0) {
      uniqueVideoFormats.push('720p', '480p', '360p');
      console.log('No formats found, using defaults:', uniqueVideoFormats);
    }
    
    if (uniqueAudioFormats.length === 0) {
      uniqueAudioFormats.push('128kbps', '96kbps', '64kbps');
      console.log('No audio formats found, using defaults:', uniqueAudioFormats);
    }
    
    // yt-dlp uses different property names
    const title = info.title || info.fulltitle || 'Video sin título';
    const duration = info.duration ? secondsToHms(Number(info.duration)) : 'Duración desconocida';
    const thumbnailUrl =
      info.thumbnail ??
      (Array.isArray(info.thumbnails) && info.thumbnails.length > 0
        ? info.thumbnails[info.thumbnails.length - 1]?.url ?? ''
        : '');

    return {
      title,
      duration,
      thumbnailUrl,
      formats: [...uniqueVideoFormats, ...uniqueAudioFormats],
    };
  } catch (error) {
    console.error('Detailed error analyzing YouTube URL:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      url: input.youtubeUrl,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      platform: process.platform
    });
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Timeout')) {
        throw new Error('El análisis del video tardó demasiado tiempo. Inténtalo de nuevo.');
      }
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        throw new Error('Acceso denegado al video. Puede estar restringido geográficamente.');
      }
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        throw new Error('Video no encontrado. Verifica que la URL sea correcta.');
      }
      if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        throw new Error('Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.');
      }
      if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
        throw new Error('Error de conexión. Verifica tu conexión a internet.');
      }
    }
    
    throw new Error(
      "Error al analizar la URL de YouTube. Verifica que sea un enlace válido y accesible."
    );
  }
}

export async function downloadYoutubeVideo(
  input: DownloadYoutubeVideoInput
): Promise<DownloadYoutubeVideoOutput> {
  try {
    const { youtubeUrl, format } = input;
    
    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/;
    if (!youtubeRegex.test(youtubeUrl)) {
      throw new Error('Invalid YouTube URL');
    }

    console.log('Preparing download info:', youtubeUrl, format);
    
    // Initialize yt-dlp (platform-aware path)
    const ytDlpPath = process.platform === 'win32' 
      ? join(process.cwd(), 'yt-dlp.exe')
      : 'yt-dlp';
    const ytDlp = new YTDlpWrap(ytDlpPath);
    
    // Get video info
      const info = await ytDlp.getVideoInfo(youtubeUrl) as YtDlpVideoInfo;
    
    // yt-dlp maneja la selección de formatos automáticamente
    // Solo validamos que el formato sea reconocible
    const isAudioFormat = format.includes('kbps');
    const isVideoFormat = format.includes('p');
    
    if (!isAudioFormat && !isVideoFormat) {
      throw new Error(`Formato no reconocido: ${format}`);
    }

    // Generate filename
    const isAudio = format.includes('kbps');
      const rawTitle = info.videoDetails?.title ?? info.title ?? 'video';
      const sanitizedTitle = rawTitle.replace(/[^\w\s-]/g, '').trim();
    const fileName = `${sanitizedTitle}.${isAudio ? 'mp3' : 'mp4'}`;

    return {
      success: true,
      fileName: fileName,
      downloadUrl: `/api/download`, // Will be used for POST request
    };
  } catch (error) {
    console.error('Error preparing download:', error);
    return {
      success: false,
      error: 'Failed to prepare download.',
    };
  }
}
