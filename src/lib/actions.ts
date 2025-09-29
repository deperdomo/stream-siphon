'use server';

import YTDlpWrap from 'yt-dlp-wrap';
import { join } from 'path';
import type {
  AnalyzeYoutubeUrlInput,
  AnalyzeYoutubeUrlOutput,
  DownloadYoutubeVideoInput,
  DownloadYoutubeVideoOutput,
} from './types';

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
    
    // Initialize yt-dlp
    const ytDlpPath = join(process.cwd(), 'yt-dlp.exe');
    const ytDlp = new YTDlpWrap(ytDlpPath);
    
    // Get video info with timeout
    const info = await Promise.race([
      ytDlp.getVideoInfo(youtubeUrl),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Video analysis took too long')), 25000)
      )
    ]) as any;
    
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
    const formats = info.formats || info.requested_formats || [];
    
    console.log('Video formats found (all containers):', formats.filter((f: any) => f.vcodec && f.vcodec !== 'none'));

    // Mostrar TODAS las calidades de video disponibles (combinadas + solo-video)
    // Combinaremos automáticamente video de alta calidad con audio durante la descarga
    const combinedVideoFormats = formats
      .filter((f: any) => 
        f.vcodec && f.vcodec !== 'none' && 
        f.acodec && f.acodec !== 'none' && 
        (f.height || f.resolution) &&
        (f.ext === 'mp4' || f.ext === 'webm')
      )
      .map((f: any) => f.height ? `${f.height}p` : f.resolution)
      .filter(Boolean);

    console.log('All video formats (including video-only):', formats.filter((f: any) => f.vcodec && f.vcodec !== 'none'));

    const videoOnlyFormats = formats
      .filter((f: any) => 
        f.vcodec && f.vcodec !== 'none' && 
        (!f.acodec || f.acodec === 'none') && 
        (f.height || f.resolution) &&
        (f.ext === 'mp4' || f.ext === 'webm')
      )
      .map((f: any) => f.height ? `${f.height}p` : f.resolution)
      .filter(Boolean);

    // Incluir TODAS las calidades (combinadas + solo-video)
    // El backend se encargará de combinar video+audio automáticamente
    const allVideoFormats = [...combinedVideoFormats, ...videoOnlyFormats];
    const videoFormats = [...new Set(allVideoFormats)];

    console.log('Audio-only formats found:', formats.filter((f: any) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none')));
    console.log('Combined video formats found:', combinedVideoFormats);
    console.log('Video-only formats found:', videoOnlyFormats);

    // Get audio formats with better filtering - show ALL available bitrates
    const audioFormats = formats
      .filter((f: any) => 
        f.acodec && f.acodec !== 'none' && 
        (!f.vcodec || f.vcodec === 'none') && 
        f.abr &&
        (f.ext === 'mp4' || f.ext === 'webm' || f.ext === 'm4a' || f.ext === 'mp3')
      )
      .map((f: any) => `${Math.floor(Number(f.abr))}kbps`)
      .filter(Boolean);

    const uniqueVideoFormats = [...new Set(videoFormats)].sort(
      (a: unknown, b: unknown) => parseInt(String(b)) - parseInt(String(a))
    );
    const uniqueAudioFormats = [...new Set(audioFormats)].sort(
      (a: unknown, b: unknown) => parseInt(String(b)) - parseInt(String(a))
    );
    
    console.log('Combined video formats found:', combinedVideoFormats);
    console.log('Video-only formats found:', videoOnlyFormats);
    console.log('Final video formats (ALL QUALITIES - will output MP4 with video+audio):', uniqueVideoFormats);
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
    const thumbnailUrl = info.thumbnail || 
                        (info.thumbnails && info.thumbnails.length > 0 ? 
                         info.thumbnails[info.thumbnails.length - 1].url : 
                         '');

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

// Función para detectar si un formato de audio es en español
function isSpanishAudio(format: any): boolean {
  // Verificar en la URL si hay indicadores de idioma español
  if (format.url) {
    const url = format.url;
    if (url.includes('&lang=es') || 
        url.includes('&language=es') || 
        url.includes('&hl=es') ||
        url.includes('lang%3Des') ||
        url.includes('es-ES') ||
        url.includes('&es&') ||
        url.includes('spanish')) {
      return true;
    }
  }
  
  // Verificar en audioTrack (específico de YouTube)
  const audioTrack = format.audioTrack;
  if (audioTrack) {
    const displayName = audioTrack.displayName;
    const id = audioTrack.id;
    
    if (displayName && (
          displayName.includes('Spanish') ||
          displayName.includes('Español') ||
          displayName.includes('español') ||
          displayName.includes('spa'))) {
      return true;
    }
    
    if (id && (id.includes('es') || id.includes('spa'))) {
      return true;
    }
  }
  
  // Verificar en metadatos de idioma si existen
  if (format.language) {
    const lang = format.language.toLowerCase();
    return lang === 'es' || lang === 'spa' || lang === 'spanish' || lang === 'español';
  }
  
  return false;
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
    
    // Initialize yt-dlp
    const ytDlpPath = join(process.cwd(), 'yt-dlp.exe');
    const ytDlp = new YTDlpWrap(ytDlpPath);
    
    // Get video info
    const info = await ytDlp.getVideoInfo(youtubeUrl);
    
    // yt-dlp maneja la selección de formatos automáticamente
    // Solo validamos que el formato sea reconocible
    const isAudioFormat = format.includes('kbps');
    const isVideoFormat = format.includes('p');
    
    if (!isAudioFormat && !isVideoFormat) {
      throw new Error(`Formato no reconocido: ${format}`);
    }

    // Generate filename
    const isAudio = format.includes('kbps');
    const sanitizedTitle = info.videoDetails.title.replace(/[^\w\s-]/g, '').trim();
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
