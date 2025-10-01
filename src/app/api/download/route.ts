import { NextRequest, NextResponse } from 'next/server';
import YTDlpWrap from 'yt-dlp-wrap';
import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import { join, extname } from 'path';
import { unlinkSync, existsSync, readFileSync, readdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { sendProgressUpdate, sendCompletion, sendError } from './progress/stream-manager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Initialize yt-dlp with the binary path
const ytDlpPath = join(process.cwd(), 'yt-dlp.exe');
let ytDlp: YTDlpWrap;

try {
  ytDlp = new YTDlpWrap(ytDlpPath);
  console.log('✅ yt-dlp initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize yt-dlp:', error);
}

// Utility function to get video info with yt-dlp
async function getVideoInfo(youtubeUrl: string, retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔍 Getting video info (attempt ${attempt}/${retries})...`);

      const info = await ytDlp.getVideoInfo(youtubeUrl);
      console.log('✅ Successfully got video info');
      return info;

    } catch (error) {
      console.log(`❌ Attempt ${attempt} failed:`, error instanceof Error ? error.message : String(error));
      
      if (attempt === retries) {
        throw new Error(`Failed to get video info after ${retries} attempts: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Function to merge video and audio using FFmpeg
async function mergeVideoAndAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[mergeVideoAndAudio] Starting merge', {
      videoPath,
      audioPath,
      outputPath,
    });

    const command = ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        '-c:v copy',        // Copy video codec (no re-encoding)
        '-c:a aac',         // Use AAC for audio
        '-b:a 192k',        // Audio bitrate
        '-shortest',        // Finish encoding when the shortest stream ends
        '-movflags', '+faststart' // Enable fast start for better streaming
      ])
      .output(outputPath);

    command.on('start', (commandLine) => {
      console.log('[mergeVideoAndAudio] FFmpeg command:', commandLine);
    });

    command.on('progress', (progress) => {
      if (onProgress && progress.percent) {
        console.log(`[mergeVideoAndAudio] Progress: ${progress.percent.toFixed(1)}%`);
        onProgress(progress.percent);
      }
    });

    command.on('end', () => {
      console.log('[mergeVideoAndAudio] Merge completed successfully');
      resolve();
    });

    command.on('error', (err, stdout, stderr) => {
      console.error('[mergeVideoAndAudio] FFmpeg error:', err.message);
      console.error('[mergeVideoAndAudio] FFmpeg stderr:', stderr);
      reject(new Error(`Failed to merge video and audio: ${err.message}`));
    });

    command.run();
  });
}

// Function to download video with yt-dlp
async function downloadWithYtDlp(
  youtubeUrl: string,
  outputPath: string,
  format: 'video' | 'audio',
  quality: string = 'best',
  onProgress?: (progress: number) => void
): Promise<{ filePath: string; extension: string; filename: string }> {
  try {
    const sanitizedTitle = 'download-' + randomUUID();
    const outputTemplate = join(outputPath, `${sanitizedTitle}.%(ext)s`);
    
    let formatSelector: string;
    let preferredExtensions: string[];
    
    if (format === 'video') {
      // Download ONLY video stream without audio for maximum quality
      // This allows access to highest resolutions (1080p60, 4K, 8K, etc.)
      if (quality === 'best') {
        // Prioritize video-only formats with highest resolution
        // Use format sorting to ensure we get the best quality
        formatSelector = 'bv*[height>=1080]/bv*[height>=720]/bv*[height>=480]/bv*/bestvideo';
      } else {
        const height = quality.replace('p', '');
        formatSelector = `bv*[height<=${height}]/bestvideo[height<=${height}]/bv*[height<=${height}]/bestvideo[height<=${height}]`;
      }
      preferredExtensions = ['.mp4', '.webm', '.mkv', '.m4v'];
    } else {
      // Download best audio and convert to MP3
      // Prioritize original language or Spanish audio tracks over English
      // Try non-English first, then Spanish variants, then any available audio
      formatSelector = 'bestaudio[language!=en][ext=m4a]/bestaudio[language=es]/bestaudio[language=es-419]/bestaudio[language=es-US]/bestaudio[ext=m4a]/bestaudio/best';
      preferredExtensions = ['.mp3', '.m4a', '.webm', '.opus'];
    }

    console.log(`🚀 Starting download with format: ${formatSelector}`);
    console.log(`📁 Output template: ${outputTemplate}`);
    console.log(`🎯 Preferred extensions: ${preferredExtensions.join(', ')}`);
    
    const args = [
      '--format', formatSelector,
      '--output', outputTemplate,
      '--no-playlist',
      // Add verbose logging to see which format is selected
      '--print-to-file', 'Selected format: %(format_id)s - %(format)s - %(resolution)s - %(vcodec)s/%(acodec)s', join(outputPath, 'format-debug.txt'),
      // Force quality sorting - prioritize resolution, fps, codec quality, and Spanish language
      '--format-sort', 'res:1080,fps,vcodec:h264,acodec,lang:es',
      // Add headers and user agent to avoid 403 errors
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--referer', 'https://www.youtube.com/',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--add-header', 'Accept-Encoding:gzip, deflate, br',
      '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      '--add-header', 'Connection:keep-alive',
      '--add-header', 'Upgrade-Insecure-Requests:1',
      '--add-header', 'Sec-Fetch-Dest:document',
      '--add-header', 'Sec-Fetch-Mode:navigate',
      '--add-header', 'Sec-Fetch-Site:none',
      // Network options to avoid rate limiting
      '--sleep-interval', '1',
      '--max-sleep-interval', '3',
      '--socket-timeout', '30',
      // Add retry options
      '--retries', '5',
      '--fragment-retries', '5',
      // Use android_vr client for better format access and set language preference
      // Prioritize Spanish (es), Latin American Spanish (es-419), then undefined (original)
      '--extractor-args', 'youtube:player_client=android_vr,android;lang=es,es-419,und',
      // Skip unavailable fragments instead of failing
      '--skip-unavailable-fragments'
    ];

    // Add format-specific options
    if (format === 'video') {
      // For video: merge video+audio to MP4
      args.push('--merge-output-format', 'mp4');
    } else {
      // For audio: extract audio and convert to MP3
      args.push('--extract-audio', '--audio-format', 'mp3', '--audio-quality', '192K');
    }

    args.push(youtubeUrl);

    const downloadPromise = ytDlp.exec(args);

    // Monitor progress with simulated progress (yt-dlp-wrap doesn't expose stdout directly)
    let progressInterval: NodeJS.Timeout | undefined;
    let currentProgress = 0;
    
    if (onProgress) {
      progressInterval = setInterval(() => {
        // Gradual progress simulation with more realistic behavior
        currentProgress = Math.min(95, currentProgress + Math.random() * 3 + 1);
        onProgress(currentProgress);
      }, 2000);
    }

    try {
      await new Promise<void>((resolve, reject) => {
        downloadPromise.on('close', (code: number | null) => {
          if (progressInterval) clearInterval(progressInterval);
          if (code === 0 || code === null) {
            if (onProgress) onProgress(100);
            resolve();
          } else {
            reject(new Error(`yt-dlp exited with code ${code}`));
          }
        });
        
        downloadPromise.on('error', (error: any) => {
          if (progressInterval) clearInterval(progressInterval);
          reject(error);
        });
      });
    } catch (error) {
      throw error;
    }
    
    // Read debug info about selected format
    const debugFilePath = join(outputPath, 'format-debug.txt');
    if (existsSync(debugFilePath)) {
      try {
        const formatDebugInfo = readFileSync(debugFilePath, 'utf-8');
        console.log(`🔍 Format selected by yt-dlp: ${formatDebugInfo.trim()}`);
      } catch (err) {
        console.log('Could not read format debug file:', err);
      }
    }
    
    // Find the downloaded file - look for the expected extension
    const directoryFiles = readdirSync(outputPath)
      .filter((fileName) => fileName.includes(sanitizedTitle) && !fileName.endsWith('.part') && !fileName.endsWith('.txt'));

    console.log(`📂 Files found in download directory:`, directoryFiles);

    if (directoryFiles.length === 0) {
      throw new Error('Download completed but no output file found');
    }

    const normalizedPreferences = preferredExtensions.map((ext) => ext.toLowerCase());
    const selectedFile = directoryFiles.find((fileName) =>
      normalizedPreferences.includes(extname(fileName).toLowerCase())
    ) ?? directoryFiles[0];

    const resolvedPath = join(outputPath, selectedFile);
    const fileExtension = extname(selectedFile).replace('.', '').toLowerCase();

    if (!existsSync(resolvedPath)) {
      throw new Error('Download completed but output file not accessible');
    }

    console.log(`✅ Download completed: ${resolvedPath} (${fileExtension || 'unknown'}).`);

    return {
      filePath: resolvedPath,
      extension: fileExtension,
      filename: selectedFile
    };
    
  } catch (error) {
    console.error('❌ Download failed:', error);
    throw error;
  }
}

function getContentType(extension: string, format: 'video' | 'audio'): string {
  const normalizedExtension = extension.toLowerCase();
  const mimeMap: Record<string, string> = {
    mp4: 'video/mp4',
    mkv: 'video/x-matroska',
    webm: 'video/webm',
    m4v: 'video/mp4',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    opus: 'audio/ogg',
    weba: 'audio/webm',
  };

  if (mimeMap[normalizedExtension]) {
    return mimeMap[normalizedExtension];
  }

  return format === 'video' ? 'video/mp4' : 'audio/mpeg';
}

export async function POST(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { youtubeUrl, downloadType = 'single' } = body;

    console.log('[Download API] Incoming POST', {
      sessionId,
      body,
      format: body.format,
      quality: body.quality,
    });

    if (!youtubeUrl) {
      await sendError(sessionId, 'URL de YouTube es requerida');
      return NextResponse.json(
        { error: 'URL de YouTube es requerida' },
        { status: 400 }
      );
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/;
    if (!youtubeRegex.test(youtubeUrl)) {
      await sendError(sessionId, 'URL de YouTube inválida');
      return NextResponse.json(
        { error: 'URL de YouTube inválida' },
        { status: 400 }
      );
    }

    await sendProgressUpdate(sessionId, 10, 'Obteniendo información del video...');

    // Get video information
    let videoInfo;
    try {
      videoInfo = await getVideoInfo(youtubeUrl);
    } catch (error) {
      let errorMsg = 'Error al obtener información del video';
      let statusCode = 500;
      
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        
        if (errorStr.includes('403') || errorStr.includes('forbidden')) {
          errorMsg = 'Acceso denegado al video. YouTube está bloqueando las descargas. Intenta con otro video o más tarde.';
          statusCode = 403;
        } else if (errorStr.includes('404') || errorStr.includes('not found')) {
          errorMsg = 'Video no encontrado. Verifica que la URL sea correcta y que el video esté disponible.';
          statusCode = 404;
        } else if (errorStr.includes('429') || errorStr.includes('too many requests')) {
          errorMsg = 'Demasiadas solicitudes. Espera un momento antes de intentar de nuevo.';
          statusCode = 429;
        } else if (errorStr.includes('private') || errorStr.includes('unavailable')) {
          errorMsg = 'Este video es privado o no está disponible.';
          statusCode = 403;
        } else if (errorStr.includes('age') || errorStr.includes('restricted')) {
          errorMsg = 'Este video tiene restricciones de edad. No se puede descargar.';
          statusCode = 403;
        } else {
          errorMsg = `${errorMsg}: ${error.message}`;
        }
      }
      
      await sendError(sessionId, errorMsg);
      return NextResponse.json(
        { error: errorMsg },
        { status: statusCode }
      );
    }

    const videoTitle = videoInfo.title || 'video';
    const videoId = videoInfo.id || randomUUID();

    if (downloadType === 'dual') {
      return await handleDualDownload(youtubeUrl, videoInfo, sessionId);
    } else {
      return await handleSingleDownload(youtubeUrl, videoInfo, sessionId, body.format, body.quality);
    }

  } catch (error) {
    console.error('Error in download API:', error);
    await sendError(sessionId, 'Error interno del servidor');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

async function handleSingleDownload(
  youtubeUrl: string,
  videoInfo: any,
  sessionId: string,
  format: string,
  quality: string
) {
  try {
    console.log('[handleSingleDownload] Called with', {
      sessionId,
      format,
      quality,
      formatType: typeof format,
      formatValue: JSON.stringify(format),
    });

    const videoTitle = videoInfo.title || 'video';
    const tempDir = tmpdir();
    const downloadDir = join(tempDir, `download-${randomUUID()}`);
    
    // Create download directory
    await execPromise(`mkdir "${downloadDir}"`);

    await sendProgressUpdate(sessionId, 30, 'Iniciando descarga...');

    let downloadResult: { filePath: string; extension: string; filename: string };
    let finalFilename: string;
    let contentType: string;
    const safeTitle = `${videoTitle.replace(/[<>:"/\\|?*]/g, '_')}`;

    // Determine if this is audio or video based on the format string
    // Audio formats end with 'kbps', video formats are resolutions or 'best'
    const isAudioFormat = format && format.toLowerCase().includes('kbps');
    const actualQuality = quality || format || 'best';
    
    console.log('[handleSingleDownload] Format detection', {
      format,
      quality,
      isAudioFormat,
      actualQuality,
      willDownloadVideo: !isAudioFormat,
    });

    if (!isAudioFormat) {
      // This is a VIDEO download
      // For video: download video and audio separately, then merge for maximum quality
      await sendProgressUpdate(sessionId, 30, 'Descargando video en máxima calidad...');
      
      const videoResult = await downloadWithYtDlp(
        youtubeUrl,
        downloadDir,
        'video',
        actualQuality,
        (progress) => {
          const adjustedProgress = 30 + (progress * 0.3); // 30% to 60%
          sendProgressUpdate(sessionId, adjustedProgress, `Descargando video: ${progress.toFixed(1)}%`);
        }
      );

      await sendProgressUpdate(sessionId, 60, 'Descargando audio en máxima calidad...');
      
      const audioResult = await downloadWithYtDlp(
        youtubeUrl,
        downloadDir,
        'audio',
        'best', // Always get best audio quality
        (progress) => {
          const adjustedProgress = 60 + (progress * 0.15); // 60% to 75%
          sendProgressUpdate(sessionId, adjustedProgress, `Descargando audio: ${progress.toFixed(1)}%`);
        }
      );

      await sendProgressUpdate(sessionId, 75, 'Combinando video y audio para máxima calidad...');

      // Merge video and audio
      const outputExtension = 'mp4'; // Use MP4 for better compatibility
      const mergedFilePath = join(downloadDir, `merged-${randomUUID()}.${outputExtension}`);
      
      await mergeVideoAndAudio(
        videoResult.filePath,
        audioResult.filePath,
        mergedFilePath,
        (progress) => {
          const adjustedProgress = 75 + (progress * 0.2); // 75% to 95%
          sendProgressUpdate(sessionId, adjustedProgress, `Combinando: ${progress.toFixed(1)}%`);
        }
      );

      downloadResult = {
        filePath: mergedFilePath,
        extension: outputExtension,
        filename: `${safeTitle}.${outputExtension}`
      };
      
      finalFilename = `${safeTitle}.${outputExtension}`;
      contentType = getContentType(outputExtension, 'video');
      
      console.log('[handleSingleDownload] Video merged successfully', {
        videoFile: videoResult.filePath,
        audioFile: audioResult.filePath,
        mergedFile: mergedFilePath,
      });
    } else {
      // This is an AUDIO download
      downloadResult = await downloadWithYtDlp(
        youtubeUrl,
        downloadDir,
        'audio',
        actualQuality,
        (progress) => {
          const adjustedProgress = 30 + (progress * 0.65); // 30% to 95%
          sendProgressUpdate(sessionId, adjustedProgress, `Descargando y convirtiendo audio: ${progress.toFixed(1)}%`);
        }
      );
      const detectedExtension = downloadResult.extension || 'mp3';
      finalFilename = `${safeTitle}.${detectedExtension}`;
      contentType = getContentType(detectedExtension, 'audio');
    }

    await sendProgressUpdate(sessionId, 95, 'Preparando descarga...');

    // Read file using readFileSync for simplicity
    const fileBuffer = readFileSync(downloadResult.filePath);

    // Cleanup
    try {
      await execPromise(`rmdir /s /q "${downloadDir}"`);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp directory:', cleanupError);
    }

    await sendCompletion(sessionId, 'Descarga completada exitosamente');

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(finalFilename)}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        // Add headers to prevent corruption
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    let errorMsg = 'Error en la descarga';
    let statusCode = 500;
    
    if (error instanceof Error) {
      const errorStr = error.message.toLowerCase();
      
      if (errorStr.includes('403') || errorStr.includes('forbidden')) {
        errorMsg = 'YouTube está bloqueando las descargas. Esto puede suceder por:\n• Uso excesivo del servicio\n• Video con restricciones\n• Bloqueo geográfico\n\nIntenta con otro video o espera unos minutos.';
        statusCode = 403;
      } else if (errorStr.includes('404') || errorStr.includes('not found')) {
        errorMsg = 'Video no encontrado o no disponible para descarga.';
        statusCode = 404;
      } else if (errorStr.includes('timeout')) {
        errorMsg = 'La descarga tardó demasiado tiempo. Intenta de nuevo.';
        statusCode = 408;
      } else if (errorStr.includes('network') || errorStr.includes('connection')) {
        errorMsg = 'Error de conexión. Verifica tu conexión a internet e intenta de nuevo.';
        statusCode = 503;
      } else {
        errorMsg = `Error en la descarga: ${error.message}`;
      }
    }
    
    await sendError(sessionId, errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: statusCode }
    );
  }
}

async function handleDualDownload(
  youtubeUrl: string,
  videoInfo: any,
  sessionId: string
) {
  try {
    const videoTitle = videoInfo.title || 'video';
    const tempDir = tmpdir();
    const downloadDir = join(tempDir, `download-dual-${randomUUID()}`);
    
    // Create download directory
    await execPromise(`mkdir "${downloadDir}"`);

    await sendProgressUpdate(sessionId, 20, 'Descargando video...');

    // Download video
    const videoResult = await downloadWithYtDlp(
      youtubeUrl,
      downloadDir,
      'video',
      'best',
      (progress) => {
        const adjustedProgress = 20 + (progress * 0.3); // 20% to 50%
        sendProgressUpdate(sessionId, adjustedProgress, `Descargando video: ${progress.toFixed(1)}%`);
      }
    );

    await sendProgressUpdate(sessionId, 55, 'Descargando audio...');

    // Download audio
    const audioResult = await downloadWithYtDlp(
      youtubeUrl,
      downloadDir,
      'audio',
      'best',
      (progress) => {
        const adjustedProgress = 55 + (progress * 0.25); // 55% to 80%
        sendProgressUpdate(sessionId, adjustedProgress, `Descargando audio: ${progress.toFixed(1)}%`);
      }
    );

    const safeTitle = `${videoTitle.replace(/[<>:"/\\|?*]/g, '_')}`;
    const videoExtension = videoResult.extension || 'mp4';
    let audioExtension = audioResult.extension || 'mp3';
    let audioFilePath = audioResult.filePath;

    if (audioExtension !== 'mp3') {
      await sendProgressUpdate(sessionId, 85, 'Convirtiendo audio a MP3...');

      const mp3File = join(downloadDir, `${safeTitle}-${randomUUID()}.mp3`);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(audioFilePath)
          .toFormat('mp3')
          .audioBitrate('192k')
          .save(mp3File)
          .on('end', () => {
            console.log('✅ MP3 conversion completed');
            resolve();
          })
          .on('error', (err) => {
            console.error('❌ MP3 conversion failed:', err);
            reject(err);
          });
      });

      audioFilePath = mp3File;
      audioExtension = 'mp3';
    } else {
      await sendProgressUpdate(sessionId, 85, 'Preparando archivos...');
    }

    await sendProgressUpdate(sessionId, 95, 'Preparando archivos...');

    // Return metadata for sequential downloads
    const videoFilename = `${safeTitle}.${videoExtension}`;
    const audioFilename = `${safeTitle}.${audioExtension}`;

    // Store files temporarily for sequential download
    const videoTempPath = join(tempDir, `temp-video-${randomUUID()}.${videoExtension}`);
    const audioTempPath = join(tempDir, `temp-audio-${randomUUID()}.${audioExtension}`);

    // Copy files to temp paths
    await execPromise(`copy "${videoResult.filePath}" "${videoTempPath}"`);
    await execPromise(`copy "${audioFilePath}" "${audioTempPath}"`);

    // Cleanup download directory
    try {
      await execPromise(`rmdir /s /q "${downloadDir}"`);
    } catch (cleanupError) {
      console.warn('Failed to cleanup download directory:', cleanupError);
    }

    await sendCompletion(sessionId, 'Ambos archivos preparados');

    return NextResponse.json({
      success: true,
      message: 'Ambos archivos están listos para descarga',
      files: [
        {
          type: 'video',
          filename: videoFilename,
          tempPath: videoTempPath,
          contentType: getContentType(videoExtension, 'video')
        },
        {
          type: 'audio', 
          filename: audioFilename,
          tempPath: audioTempPath,
          contentType: getContentType(audioExtension, 'audio')
        }
      ]
    });

  } catch (error) {
    const errorMsg = `Error en la descarga dual: ${error instanceof Error ? error.message : String(error)}`;
    await sendError(sessionId, errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

// Handler para descargar archivos individuales de la descarga dual
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const tempPath = searchParams.get('tempPath');
  const filename = searchParams.get('filename');
  const contentType = searchParams.get('contentType');

  if (!tempPath || !filename || !contentType) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  try {
    if (!existsSync(tempPath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Read file using readFileSync for simplicity
    const fileBuffer = readFileSync(tempPath);

    // Cleanup temp file
    try {
      unlinkSync(tempPath);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp file:', cleanupError);
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json(
      { error: 'Error serving file' },
      { status: 500 }
    );
  }
}