// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import YTDlpWrap from 'yt-dlp-wrap';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWriteStream, createReadStream, unlinkSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { sendProgressUpdate, sendCompletion, sendError } from './progress/route';
import { exec } from 'child_process';
import { promisify } from 'util';

// Create ytdl agent with better options to avoid 403
const ytdlAgent = ytdl.createAgent(undefined, {
  localAddress: undefined
});

// Function to refresh ytdl cache when YouTube structure changes
async function refreshYtdlCache() {
  try {
    // Clear any cached data
    console.log('🔄 Refreshing ytdl cache...');
    
    // Create a test request to refresh internal caches
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll - always available
    await ytdl.getBasicInfo(testUrl, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    });
    
    console.log('✅ ytdl cache refreshed successfully');
    return true;
  } catch (error) {
    console.log('❌ Failed to refresh ytdl cache:', error);
    return false;
  }
}

// Utility function to retry downloads with different strategies
async function retryDownloadWithFallback(youtubeUrl: string, format: any, maxRetries = 2): Promise<any> {
  const strategies = [
    // Strategy 1: Enhanced headers with agent
    {
      agent: ytdlAgent,
      format: format,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        }
      }
    },
    // Strategy 2: Minimal headers
    {
      format: format,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        }
      }
    },
    // Strategy 3: Default options
    {
      format: format
    }
  ];

  for (let i = 0; i < Math.min(strategies.length, maxRetries + 1); i++) {
    try {
      console.log(`Trying download strategy ${i + 1}...`);
      const stream = ytdl(youtubeUrl, strategies[i]);
      
      // Test if the stream works by waiting for the first data chunk
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Stream timeout'));
        }, 10000);
        
        stream.once('data', () => {
          clearTimeout(timeout);
          resolve(stream);
        });
        
        stream.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      
      console.log(`Strategy ${i + 1} successful!`);
      return ytdl(youtubeUrl, strategies[i]); // Return a fresh stream
      
    } catch (error) {
      console.log(`Strategy ${i + 1} failed:`, error instanceof Error ? error.message : String(error));
      if (i === Math.min(strategies.length, maxRetries + 1) - 1) {
        throw error; // Re-throw the last error
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}


export async function POST(request: NextRequest) {
  try {
    const { youtubeUrl, format, downloadType, sessionId } = await request.json();
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

    console.log('Starting download for:', youtubeUrl, format, 'Type:', downloadType);
    
    // Handle dual download (video + audio separately)
    if (downloadType === 'dual') {
      return await handleDualDownload(youtubeUrl, sessionId);
    }
    
    // Send initial progress
    if (sessionId) {
      sendProgressUpdate(sessionId, 5, 'Analizando video...');
    }

    // Configure ytdl with enhanced options and error handling
    const ytdlOptions = {
      lang: 'es',
      agent: ytdlAgent,
      requestOptions: {
        headers: {
          'Accept-Language': 'es,es-ES;q=0.9,en;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      }
    };

    let info;
    try {
      info = await ytdl.getInfo(youtubeUrl, ytdlOptions);
    } catch (parseError) {
      console.error('Primary getInfo failed:', parseError);
      
      // Try fallback approaches
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      if (errorMessage.includes('parsing watch.html') || errorMessage.includes('YouTube made a change')) {
        console.log('Attempting fallback parsing methods...');
        
        // Try refreshing ytdl cache first
        await refreshYtdlCache();
        
        // Advanced fallback strategies with delays and different approaches
        const fallbackStrategies = [
          {
            name: 'Googlebot',
            options: {
              requestOptions: {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                  'Accept': '*/*',
                  'Accept-Language': 'en-US,en;q=0.5'
                }
              }
            }
          },
          {
            name: 'Mobile Safari',
            options: {
              requestOptions: {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.5'
                }
              }
            }
          },
          {
            name: 'Firefox Desktop',
            options: {
              requestOptions: {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.5'
                }
              }
            }
          },
          {
            name: 'Basic Info Only',
            useBasicInfo: true,
            options: {
              requestOptions: {
                headers: {
                  'User-Agent': 'youtube-dl/2021.12.17',
                  'Accept-Language': 'en-us,en;q=0.5'
                }
              }
            }
          }
        ];
        
        let fallbackSuccess = false;
        
        for (let i = 0; i < fallbackStrategies.length; i++) {
          const strategy = fallbackStrategies[i];
          
          try {
            console.log(`🔄 Trying fallback ${i + 1}: ${strategy.name}...`);
            
            // Add delay between attempts to avoid rate limiting
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 2000 * i));
            }
            
            if (strategy.useBasicInfo) {
              // Try basic info first, then full info
              const basicInfo = await ytdl.getBasicInfo(youtubeUrl, strategy.options);
              info = await ytdl.getInfo(youtubeUrl, strategy.options);
            } else {
              info = await ytdl.getInfo(youtubeUrl, strategy.options);
            }
            
            console.log(`✅ Fallback ${i + 1} (${strategy.name}) successful!`);
            fallbackSuccess = true;
            break;
            
          } catch (fallbackError) {
            const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
            console.log(`❌ Fallback ${i + 1} (${strategy.name}) failed:`, fallbackMsg.substring(0, 100));
            
            // If it's still a parsing error, continue to next strategy
            // If it's a different error (like network), it might be worth retrying
            if (!fallbackMsg.includes('parsing watch.html') && !fallbackMsg.includes('YouTube made a change')) {
              console.log('⚠️ Non-parsing error detected, might be temporary network issue');
            }
          }
        }
        
        if (!fallbackSuccess) {
          console.log('❌ All advanced fallback methods failed');
          
          // Last resort: Try to use available formats from analysis if they exist
          // This could happen when analysis works but download parsing fails
          console.log('🔄 Attempting last resort: Check if we have format data from analysis...');
          
          // Check if this video was recently analyzed and we have format data
          try {
            // Try a very basic approach with just the URL and no format restrictions
            const basicOptions = {
              requestOptions: {
                headers: {
                  'User-Agent': 'yt-dlp/2023.01.06'
                }
              }
            };
            
            // Try one more time with minimal options and a short timeout
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout')), 8000); // 8 second timeout
            });
            
            const infoPromise = ytdl.getInfo(youtubeUrl, basicOptions);
            
            info = await Promise.race([infoPromise, timeoutPromise]) as any;
            console.log('✅ Last resort method succeeded!');
            fallbackSuccess = true;
            
          } catch (lastResortError) {
            console.log('❌ Last resort method also failed');
            
            // Return detailed user-friendly error with instructions
            console.log('🚨 YouTube parser error - all methods exhausted');
            
            const userMessage = `
YouTube ha actualizado su estructura web y la descarga no está disponible temporalmente.

🔧 Soluciones inmediatas:
• Espera 10-15 minutos e intenta nuevamente
• Verifica que el video sea público y accesible
• Intenta con un video diferente para probar
• Si el problema persiste, reporta el ID del video: ${youtubeUrl.split('=')[1] || 'N/A'}

⚠️ Esto suele resolverse automáticamente cuando YouTube actualiza sus sistemas.
            `.trim();
            
            if (sessionId) {
              sendError(sessionId, userMessage);
            }
            
            return NextResponse.json(
              { 
                error: 'YouTube parsing error',
                message: userMessage,
                code: 'YOUTUBE_STRUCTURE_CHANGED',
                videoId: youtubeUrl.split('=')[1] || 'unknown',
                suggestions: [
                  'Wait 10-15 minutes and try again',
                  'Verify the video is public and accessible',
                  'Try a different video to test the service',
                  'Report persistent issues with video ID'
                ],
                technical_details: {
                  primary_error: 'YouTube structure parsing failed',
                  fallback_attempts: fallbackStrategies.length,
                  last_error: lastResortError instanceof Error ? lastResortError.message.substring(0, 100) : 'Unknown'
                }
              },
              { status: 503 }
            );
          }
        }
      } else {
        // Re-throw other types of errors
        throw parseError;
      }
    }

    // Ensure info is defined after fallback attempts
    if (!info) {
      console.error('❌ Failed to get video info after all attempts');
      if (sessionId) {
        sendError(sessionId, 'No se pudo obtener información del video después de múltiples intentos.');
      }
      return NextResponse.json(
        { error: 'Failed to get video information' },
        { status: 503 }
      );
    }

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

    // Stream the video/audio content with enhanced options
    const streamOptions = { 
      format: selectedFormat,
      requestOptions: ytdlOptions.requestOptions,
      begin: Date.now()
    };
    
    console.log('Streaming with options:', streamOptions);
    
    if (sessionId) {
      sendProgressUpdate(sessionId, 15, isAudio ? 'Descargando audio...' : 'Descargando video...');
    }
    
    // Use retry mechanism for better reliability
    let videoStream;
    try {
      videoStream = await retryDownloadWithFallback(youtubeUrl, selectedFormat);
    } catch (retryError) {
      console.error('All retry strategies failed:', retryError);
      if (sessionId) {
        sendError(sessionId, 'Error: YouTube ha bloqueado las descargas temporalmente. Inténtalo más tarde.');
      }
      return NextResponse.json(
        { error: 'YouTube temporarily blocked downloads. Please try again later.' },
        { status: 503 }
      );
    }

    // Add progress tracking for simple downloads
    let downloadProgress = 0;
    videoStream.on('progress', (chunkLength: number, downloaded: number, total: number) => {
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
        videoStream.on('data', (chunk: any) => {
          controller.enqueue(chunk);
        });
        
        videoStream.on('end', () => {
          if (sessionId) {
            sendCompletion(sessionId, 'Descarga completada exitosamente');
          }
          controller.close();
        });
        
        videoStream.on('error', (error: Error) => {
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
    
    // Download video stream to temp file with enhanced options
    const enhancedOptions = {
      format: videoFormat,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      },
      begin: Date.now()
    };
    
    const videoStream = ytdl(youtubeUrl, enhancedOptions);
    const videoFile = createWriteStream(videoPath);
    
    let videoProgress = 0;
    videoStream.on('progress', (chunkLength: number, downloaded: number, total: number) => {
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
      
      // Download audio stream to temp file with enhanced options
      const audioEnhancedOptions = {
        format: audioFormat,
        requestOptions: enhancedOptions.requestOptions,
        begin: Date.now()
      };
      
      const audioStream = ytdl(youtubeUrl, audioEnhancedOptions);
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
    
    videoStream.on('error', (err: Error) => {
      console.error('Video download error:', err);
      
      // Provide more specific error message for 403 errors
      let errorMessage = err.message;
      if (err.message.includes('403') || (err as any).statusCode === 403) {
        errorMessage = 'YouTube ha bloqueado temporalmente las descargas. Por favor, inténtalo de nuevo en unos minutos.';
        console.log('⚠️ YouTube 403 error - temporary block detected');
      }
      
      if (sessionId) {
        sendError(sessionId, 'Error al descargar video: ' + errorMessage);
      }
      reject(new NextResponse(JSON.stringify({ 
        error: 'Failed to download video: ' + errorMessage 
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

// Función para manejar descargas duales (video + audio por separado)
async function handleDualDownload(youtubeUrl: string, sessionId?: string): Promise<NextResponse> {
  try {
    if (sessionId) {
      sendProgressUpdate(sessionId, 5, 'Analizando video para descarga dual...');
    }

    // Get video info with enhanced error handling
    let info;
    try {
      info = await ytdl.getInfo(youtubeUrl, {
        lang: 'es',
        agent: ytdlAgent,
        requestOptions: {
          headers: {
            'Accept-Language': 'es,es-ES;q=0.9,en;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        }
      });
    } catch (parseError) {
      console.error('Dual download getInfo failed:', parseError);
      
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      if (errorMessage.includes('parsing watch.html') || errorMessage.includes('YouTube made a change')) {
        
        // Try refresh and fallback for dual download
        await refreshYtdlCache();
        
        try {
          info = await ytdl.getInfo(youtubeUrl, {
            requestOptions: {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
              }
            }
          });
        } catch (fallbackError) {
          if (sessionId) {
            sendError(sessionId, 'Error: YouTube ha actualizado su estructura. La descarga dual no está disponible temporalmente.');
          }
          return NextResponse.json(
            { 
              error: 'Dual download temporarily unavailable',
              message: 'YouTube structure changed - dual download not available'
            },
            { status: 503 }
          );
        }
      } else {
        throw parseError;
      }
    }

    // Find best video format
    const bestVideoFormat = info.formats
      .filter(f => f.hasVideo && f.hasAudio && f.qualityLabel && (f.container === 'mp4' || f.container === 'webm'))
      .sort((a, b) => {
        const aHeight = parseInt(a.qualityLabel?.replace(/\D/g, '') || '0');
        const bHeight = parseInt(b.qualityLabel?.replace(/\D/g, '') || '0');
        return bHeight - aHeight;
      })[0];

    // Find best audio format
    const bestAudioFormat = info.formats
      .filter(f => f.hasAudio && !f.hasVideo && f.audioBitrate && (f.container === 'mp4' || f.container === 'webm'))
      .sort((a, b) => {
        // Priorizar audio en español
        const aIsSpanish = isSpanishAudio(a);
        const bIsSpanish = isSpanishAudio(b);
        
        if (aIsSpanish && !bIsSpanish) return -1;
        if (!aIsSpanish && bIsSpanish) return 1;
        
        // Si ambos son españoles o ninguno, ordenar por calidad
        return Number(b.audioBitrate) - Number(a.audioBitrate);
      })[0];

    if (!bestVideoFormat || !bestAudioFormat) {
      throw new Error('No se encontraron formatos de video o audio adecuados');
    }

    if (sessionId) {
      sendProgressUpdate(sessionId, 10, 'Preparando descarga de video...');
    }

    // Create response with both files data
    const sanitizedTitle = info.videoDetails.title
      .replace(/[^\w\s-]/g, '')
      .trim()
      .substring(0, 100);

    const responseData = {
      type: 'dual',
      title: sanitizedTitle,
      video: {
        format: bestVideoFormat.qualityLabel,
        filename: `${sanitizedTitle}_video.mp4`
      },
      audio: {
        format: `${Math.floor(Number(bestAudioFormat.audioBitrate))}kbps`,
        filename: `${sanitizedTitle}_audio.mp3`
      }
    };

    if (sessionId) {
      sendProgressUpdate(sessionId, 20, 'Iniciando descarga de video...');
    }

    // For dual downloads, we'll return a JSON response with download metadata
    // The frontend will use this to make two separate download requests
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Dual download error:', error);
    
    if (sessionId) {
      sendError(sessionId, 'Error en descarga dual: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
    
    return NextResponse.json(
      { error: 'Failed to prepare dual download' },
      { status: 500 }
    );
  }
}