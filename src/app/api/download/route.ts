import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWriteStream, createReadStream, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';
import { sendProgressUpdate, sendCompletion, sendError } from './progress/route';
import { exec } from 'child_process';
import { promisify } from 'util';

export async function POST(request: NextRequest) {
  try {
    const { youtubeUrl, format, sessionId } = await request.json();
    const ffmpegAvailable = await checkFFmpegAvailability();
    if (!ffmpegAvailable) {
      console.log('⚠️ FFmpeg not available, will skip video+audio combination');
    }
    if (!youtubeUrl || !format) {
      return NextResponse.json(
        { error: 'YouTube URL and format are required' },
        { status: 400 }
      );
    }

    // Validate YouTube URL
    if (!ytdl.validateURL(youtubeUrl)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    console.log('Starting download for:', youtubeUrl, format);
    
    // Send initial progress
    if (sessionId) {
      sendProgressUpdate(sessionId, 5, 'Analizando video...');
    }

    // Configure ytdl with Spanish language preference
    const info = await ytdl.getInfo(youtubeUrl, {
      lang: 'es',
      requestOptions: {
        headers: {
          'Accept-Language': 'es,es-ES;q=0.9,en;q=0.8'
        }
      }
    });

    if (sessionId) {
      sendProgressUpdate(sessionId, 10, 'Seleccionando mejor formato...');
    }

    // Find the requested format
    let selectedFormat;
    
    if (format.includes('kbps')) {
      // Audio format - prioritize Spanish audio
      const audioFormats = info.formats.filter(f => 
        f.hasAudio && 
        !f.hasVideo && 
        f.audioBitrate && 
        (f.container === 'mp4' || f.container === 'webm' || f.mimeType?.includes('audio')) &&
        `${Math.floor(Number(f.audioBitrate))}kbps` === format
      );
      
      console.log('Looking for audio format:', format);
      console.log('Available audio formats:', audioFormats.map(f => ({
        bitrate: `${Math.floor(Number(f.audioBitrate))}kbps`,
        container: f.container,
        hasSpanish: f.url?.includes('&lang=es') || f.url?.includes('&language=es') || f.url?.includes('&hl=es'),
        audioTrack: (f as any).audioTrack ? {
          displayName: (f as any).audioTrack.displayName,
          id: (f as any).audioTrack.id,
          isAutoDubbed: (f as any).audioTrack.isAutoDubbed
        } : null
      })));
      
      // Try to find Spanish audio first, then fall back to any available
      selectedFormat = audioFormats.find(f => isSpanishAudio(f)) || audioFormats[0];
      
    } else {
      // Video format - buscar formato combinado primero, luego combinar video+audio
      selectedFormat = info.formats.find(f => 
        f.hasVideo && 
        f.hasAudio && 
        f.qualityLabel === format &&
        (f.container === 'mp4' || f.container === 'webm')
      );
      
      // Si no hay formato combinado, encontrar el mejor video y mejor audio para combinar
      if (!selectedFormat) {
        const videoFormat = info.formats.find(f => 
          f.hasVideo && 
          !f.hasAudio && 
          f.qualityLabel === format &&
          f.container === 'mp4' // Preferir MP4 para mejor compatibilidad
        );
        
        const audioFormat = info.formats
          .filter(f => 
            f.hasAudio && 
            !f.hasVideo && 
            f.container === 'mp4' &&
            f.audioBitrate
          )
          .sort((a, b) => {
            // Priorizar audio en español
            const aIsSpanish = isSpanishAudio(a);
            const bIsSpanish = isSpanishAudio(b);
            
            if (aIsSpanish && !bIsSpanish) return -1;
            if (!aIsSpanish && bIsSpanish) return 1;
            
            // Si ambos son españoles o ninguno, ordenar por calidad
            return Number(b.audioBitrate) - Number(a.audioBitrate);
          })[0]; // Mejor calidad de audio (priorizando español)

        if (videoFormat && audioFormat) {
          console.log(`Combining video ${format} with audio ${audioFormat.audioBitrate}kbps`);
          console.log('Selected audio format details:', {
            bitrate: audioFormat.audioBitrate + 'kbps',
            container: audioFormat.container,
            isSpanish: isSpanishAudio(audioFormat),
            audioTrack: (audioFormat as any).audioTrack ? {
              displayName: (audioFormat as any).audioTrack.displayName,
              id: (audioFormat as any).audioTrack.id
            } : 'N/A'
          });
          return await combineVideoAudio(youtubeUrl, videoFormat, audioFormat, sessionId);
        }
      }
      
      console.log('Looking for video format:', format);
      console.log('Selected format details:', {
        quality: selectedFormat?.qualityLabel,
        hasAudio: selectedFormat?.hasAudio,
        hasVideo: selectedFormat?.hasVideo,
        container: selectedFormat?.container
      });
      console.log('Available video-only formats:', info.formats
        .filter(f => f.hasVideo && !f.hasAudio && f.qualityLabel)
        .map(f => ({ 
          quality: f.qualityLabel, 
          container: f.container
        }))
      );
    }

    if (!selectedFormat) {
      return NextResponse.json(
        { error: 'Requested format not found' },
        { status: 404 }
      );
    }

    // Generate filename
    const isAudio = format.includes('kbps');
    const sanitizedTitle = info.videoDetails.title
      .replace(/[^\w\s-]/g, '')
      .trim()
      .substring(0, 100); // Limit filename length
    const fileName = `${sanitizedTitle}.${isAudio ? 'mp3' : 'mp4'}`;

    // Stream the video/audio content
    const streamOptions = { 
      format: selectedFormat
    };
    
    console.log('Streaming with options:', streamOptions);
    
    if (sessionId) {
      sendProgressUpdate(sessionId, 15, isAudio ? 'Descargando audio...' : 'Descargando video...');
    }
    
    const videoStream = ytdl(youtubeUrl, streamOptions);

    // Add progress tracking for simple downloads
    let downloadProgress = 0;
    videoStream.on('progress', (chunkLength, downloaded, total) => {
      const progress = Math.floor((downloaded / total) * 100);
      if (progress > downloadProgress && sessionId) {
        downloadProgress = progress;
        const message = isAudio ? `Descargando audio... ${progress}%` : `Descargando video... ${progress}%`;
        sendProgressUpdate(sessionId, 15 + (progress * 0.8), message);
      }
    });

    // Set appropriate headers for file download
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
    headers.set('Content-Type', isAudio ? 'audio/mp4' : 'video/mp4');

    // Create a readable stream for the response
    const readableStream = new ReadableStream({
      start(controller) {
        videoStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        
        videoStream.on('end', () => {
          if (sessionId) {
            sendCompletion(sessionId, 'Descarga completada exitosamente');
          }
          controller.close();
        });
        
        videoStream.on('error', (error) => {
          console.error('Stream error:', error);
          if (sessionId) {
            sendError(sessionId, 'Error durante la descarga: ' + error.message);
          }
          controller.error(error);
        });
      },
    });

    return new Response(readableStream, {
      headers,
    });

  } catch (error) {
    console.error('Download error:', error);
    
    // Get sessionId from the request if available
    try {
      const body = await request.clone().json();
      if (body.sessionId) {
        sendError(body.sessionId, 'Error durante la descarga: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    } catch (e) {
      // Ignore JSON parsing errors in error handler
    }
    
    return NextResponse.json(
      { error: 'Failed to download video' },
      { status: 500 }
    );
  }
  const execAsync = promisify(exec);
  // Función para verificar si FFmpeg está disponible
async function checkFFmpegAvailability(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version');
    console.log('✅ FFmpeg is available');
    return true;
  } catch (error) {
    console.log('❌ FFmpeg is not available:', error);
    return false;
  }
}
}

// Función para combinar video y audio usando FFmpeg con archivos temporales
async function combineVideoAudio(youtubeUrl: string, videoFormat: any, audioFormat: any, sessionId?: string): Promise<NextResponse> {
  const tempId = randomUUID();
  const tempDir = tmpdir();
  const videoPath = join(tempDir, `video_${tempId}.mp4`);
  const audioPath = join(tempDir, `audio_${tempId}.mp4`);
  const outputPath = join(tempDir, `output_${tempId}.mp4`);

  return new Promise((resolve, reject) => {
    console.log('Starting video and audio download to temp files...');
    
    // Send progress update
    if (sessionId) {
      sendProgressUpdate(sessionId, 15, 'Descargando video...');
    }
    
    // Download video stream to temp file
    const videoStream = ytdl(youtubeUrl, { format: videoFormat });
    const videoFile = createWriteStream(videoPath);
    
    let videoProgress = 0;
    videoStream.on('progress', (chunkLength, downloaded, total) => {
      const progress = Math.floor((downloaded / total) * 100);
      if (progress > videoProgress && sessionId) {
        videoProgress = progress;
        sendProgressUpdate(sessionId, 15 + (progress * 0.35), `Descargando video... ${progress}%`);
      }
    });
    
    videoStream.pipe(videoFile);
    
    videoStream.on('end', () => {
      console.log('Video download completed, starting audio download...');
      
      if (sessionId) {
        sendProgressUpdate(sessionId, 50, 'Descargando audio...');
      }
      
      // Download audio stream to temp file
      const audioStream = ytdl(youtubeUrl, { format: audioFormat });
      const audioFile = createWriteStream(audioPath);
      
      let audioProgress = 0;
      audioStream.on('progress', (chunkLength, downloaded, total) => {
        const progress = Math.floor((downloaded / total) * 100);
        if (progress > audioProgress && sessionId) {
          audioProgress = progress;
          sendProgressUpdate(sessionId, 50 + (progress * 0.25), `Descargando audio... ${progress}%`);
        }
      });
      
      audioStream.pipe(audioFile);
      
      audioStream.on('end', () => {
        console.log('Audio download completed, starting FFmpeg combination...');
        
        if (sessionId) {
          sendProgressUpdate(sessionId, 75, 'Mezclando audio y video... 0%');
        }
        
        // Combine using FFmpeg
        ffmpeg()
          .input(videoPath)
          .input(audioPath)
          .outputOptions([
            '-c:v', 'copy',  // Copy video codec
            '-c:a', 'aac',   // Convert audio to AAC
            '-strict', 'experimental'
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('FFmpeg started:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent && sessionId) {
              const ffmpegProgress = Math.floor(progress.percent);
              sendProgressUpdate(sessionId, 75 + (ffmpegProgress * 0.24), `Mezclando audio y video... ${ffmpegProgress}%`);
              console.log(`Processing: ${progress.percent.toFixed(1)}% done`);
            }
          })
          .on('end', () => {
            console.log('FFmpeg combination completed successfully');
            
            if (sessionId) {
              sendProgressUpdate(sessionId, 99, 'Finalizando descarga...');
            }
            
            // Stream the result back to client
            const outputStream = createReadStream(outputPath);
            const fileName = `video_${videoFormat.qualityLabel}_combined.mp4`;
            
            const headers = new Headers({
              'Content-Type': 'video/mp4',
              'Content-Disposition': `attachment; filename="${fileName}"`,
              'Cache-Control': 'no-cache',
            });
            
            // Clean up temp files after streaming
            outputStream.on('end', () => {
              setTimeout(() => {
                try {
                  unlinkSync(videoPath);
                  unlinkSync(audioPath);
                  unlinkSync(outputPath);
                  console.log('Temp files cleaned up');
                } catch (err) {
                  console.error('Error cleaning temp files:', err);
                }
              }, 1000);
            });
            
            if (sessionId) {
              sendCompletion(sessionId, 'Descarga completada exitosamente');
            }
            
            resolve(new NextResponse(outputStream as any, { headers }));
          })
          .on('error', (err) => {
            console.error('FFmpeg error:', err.message);
            
            if (sessionId) {
              sendError(sessionId, 'Error al combinar video y audio: ' + err.message);
            }
            
            // Clean up temp files on error
            try {
              unlinkSync(videoPath);
              unlinkSync(audioPath);
              if (outputPath) unlinkSync(outputPath);
            } catch (cleanupErr) {
              console.error('Error cleaning temp files:', cleanupErr);
            }
            
            reject(new NextResponse(JSON.stringify({ 
              error: 'Failed to combine video and audio: ' + err.message 
            }), { 
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            }));
          })
          .run();
      });
      
      audioStream.on('error', (err) => {
        console.error('Audio download error:', err);
        if (sessionId) {
          sendError(sessionId, 'Error al descargar audio: ' + err.message);
        }
        reject(new NextResponse(JSON.stringify({ 
          error: 'Failed to download audio: ' + err.message 
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }));
      });
    });
    
    videoStream.on('error', (err) => {
      console.error('Video download error:', err);
      if (sessionId) {
        sendError(sessionId, 'Error al descargar video: ' + err.message);
      }
      reject(new NextResponse(JSON.stringify({ 
        error: 'Failed to download video: ' + err.message 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }));
    });
  });
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
  
  // Verificar en el audioCodec o mimeType si hay indicadores
  if (format.audioCodec) {
    const codec = format.audioCodec.toLowerCase();
    if (codec.includes('es') || codec.includes('spanish')) {
      return true;
    }
  }
  
  return false;
}