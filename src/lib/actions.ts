'use server';

import ytdl from '@distube/ytdl-core';
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
    if (!ytdl.validateURL(youtubeUrl)) {
      throw new Error('Invalid YouTube URL');
    }

    console.log('Analyzing URL:', youtubeUrl);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Platform:', process.platform);
    
    // Configure ytdl with Spanish language preference and timeout
    const info = await Promise.race([
      ytdl.getInfo(youtubeUrl, {
        lang: 'es',
        requestOptions: {
          headers: {
            'Accept-Language': 'es,es-ES;q=0.9,en;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Video analysis took too long')), 25000)
      )
    ]) as any;
    
    console.log('Video info retrieved successfully');

    // Mostrar TODAS las calidades de video disponibles (combinadas + solo-video)
    // Combinaremos automáticamente video de alta calidad con audio durante la descarga
    const combinedVideoFormats = info.formats
      .filter((f: any) => 
        f.hasVideo && 
        f.hasAudio && 
        f.qualityLabel && 
        f.qualityLabel.includes('p') &&
        (f.container === 'mp4' || f.container === 'webm')
      )
      .map((f: any) => f.qualityLabel)
      .filter(Boolean);

    const videoOnlyFormats = info.formats
      .filter((f: any) => 
        f.hasVideo && 
        !f.hasAudio && 
        f.qualityLabel && 
        f.qualityLabel.includes('p') &&
        (f.container === 'mp4' || f.container === 'webm')
      )
      .map((f: any) => f.qualityLabel)
      .filter(Boolean);

    // Incluir TODAS las calidades (combinadas + solo-video)
    // El backend se encargará de combinar video+audio automáticamente
    const allVideoFormats = [...combinedVideoFormats, ...videoOnlyFormats];
    const videoFormats = [...new Set(allVideoFormats)];

    // Get audio formats with better filtering - show ALL available bitrates
    const audioFormats = info.formats
      .filter((f: any) => 
        f.hasAudio && 
        !f.hasVideo && 
        f.audioBitrate &&
        (f.container === 'mp4' || f.container === 'webm' || f.mimeType?.includes('audio'))
      )
      .map((f: any) => `${Math.floor(Number(f.audioBitrate))}kbps`)
      .filter(Boolean);

    console.log('All available formats:', info.formats.length);
    console.log('Video formats found (all containers):', info.formats
      .filter((f: any) => f.hasVideo && f.hasAudio && f.qualityLabel)
      .map((f: any) => ({ quality: f.qualityLabel, container: f.container, codec: f.codecs }))
    );
    console.log('All video formats (including video-only):', info.formats
      .filter((f: any) => f.hasVideo && f.qualityLabel)
      .map((f: any) => ({ 
        quality: f.qualityLabel, 
        container: f.container, 
        hasAudio: f.hasAudio,
        hasVideo: f.hasVideo,
        codec: f.codecs 
      }))
    );
    console.log('Audio-only formats found:', info.formats
      .filter((f: any) => f.hasAudio && !f.hasVideo)
      .map((f: any) => ({ 
        bitrate: f.audioBitrate ? `${Math.floor(Number(f.audioBitrate))}kbps` : 'unknown',
        container: f.container,
        url: f.url?.substring(0, 50) + '...'
      }))
    );

    const uniqueVideoFormats = [...new Set(videoFormats)].sort(
      (a: unknown, b: unknown) => parseInt(String(b)) - parseInt(String(a))
    );
    const uniqueAudioFormats = [...new Set(audioFormats)].sort(
      (a: unknown, b: unknown) => parseInt(String(b)) - parseInt(String(a))
    );
    
    console.log('Combined video formats found:', combinedVideoFormats);
    console.log('Video-only formats found:', videoOnlyFormats);
    console.log('Final video formats (ALL QUALITIES):', uniqueVideoFormats);
    console.log('Audio formats found:', uniqueAudioFormats);
    
    return {
      title: info.videoDetails.title,
      duration: secondsToHms(Number(info.videoDetails.lengthSeconds)),
      thumbnailUrl:
        info.videoDetails.thumbnails[
          info.videoDetails.thumbnails.length - 1
        ].url,
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
    if (!ytdl.validateURL(youtubeUrl)) {
      throw new Error('Invalid YouTube URL');
    }

    console.log('Preparing download info:', youtubeUrl, format);
    
    // Configure ytdl with Spanish language preference
    const info = await ytdl.getInfo(youtubeUrl, {
      lang: 'es',
      requestOptions: {
        headers: {
          'Accept-Language': 'es,es-ES;q=0.9,en;q=0.8'
        }
      }
    });
    
    // Find the requested format to validate it exists
    let selectedFormat;
    
    if (format.includes('kbps')) {
      // Audio format - prioritize Spanish or default language
      const audioFormats = info.formats.filter(f => 
        f.hasAudio && 
        !f.hasVideo && 
        f.audioBitrate && 
        (f.container === 'mp4' || f.container === 'webm' || f.mimeType?.includes('audio')) &&
        `${Math.floor(Number(f.audioBitrate))}kbps` === format
      );
      
      // Try to find Spanish audio first, then fall back to any available
      selectedFormat = audioFormats.find(f => isSpanishAudio(f)) || audioFormats[0];
      
    } else {
      // Video format - permitir tanto combinados como solo-video (se combinará automáticamente)
      selectedFormat = info.formats.find(f => 
        f.hasVideo && 
        f.hasAudio && 
        f.qualityLabel === format &&
        (f.container === 'mp4' || f.container === 'webm')
      );
      
      // Si no hay formato combinado, buscar formato solo-video
      if (!selectedFormat) {
        selectedFormat = info.formats.find(f => 
          f.hasVideo && 
          !f.hasAudio && 
          f.qualityLabel === format &&
          (f.container === 'mp4' || f.container === 'webm')
        );
      }
    }

    if (!selectedFormat) {
      throw new Error(`El formato solicitado (${format}) no está disponible. Por favor selecciona una calidad diferente.`);
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
