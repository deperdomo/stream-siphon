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
    
    const info = await ytdl.getInfo(youtubeUrl);
    console.log('Video info retrieved successfully');

    // Get video formats with better filtering
    const videoFormats = info.formats
      .filter(f => 
        f.hasVideo && 
        f.hasAudio && 
        f.container === 'mp4' && 
        f.qualityLabel && 
        f.qualityLabel.includes('p')
      )
      .map(f => f.qualityLabel)
      .filter(Boolean);

    // Get audio formats with better filtering  
    const audioFormats = info.formats
      .filter(f => 
        f.hasAudio && 
        !f.hasVideo && 
        f.container === 'mp4' && 
        f.audioBitrate
      )
      .map(f => `${Math.floor(Number(f.audioBitrate))}kbps`)
      .filter(Boolean);

    const uniqueVideoFormats = [...new Set(videoFormats)].sort(
      (a, b) => parseInt(b!) - parseInt(a!)
    );
    const uniqueAudioFormats = [...new Set(audioFormats)].sort(
      (a, b) => parseInt(b) - parseInt(a)
    );
    
    console.log('Video formats found:', uniqueVideoFormats);
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
    console.error('Error analyzing YouTube URL:', error);
    throw new Error(
      "Failed to analyze YouTube URL. Please ensure it's a valid link."
    );
  }
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

    console.log('Getting info for download:', youtubeUrl, format);
    const info = await ytdl.getInfo(youtubeUrl);
    
    // Find the requested format
    let selectedFormat;
    
    if (format.includes('kbps')) {
      // Audio format
      selectedFormat = info.formats.find(f => 
        f.hasAudio && 
        !f.hasVideo && 
        f.container === 'mp4' && 
        f.audioBitrate && 
        `${Math.floor(Number(f.audioBitrate))}kbps` === format
      );
    } else {
      // Video format
      selectedFormat = info.formats.find(f => 
        f.hasVideo && 
        f.hasAudio && 
        f.container === 'mp4' && 
        f.qualityLabel === format
      );
    }

    if (!selectedFormat) {
      throw new Error('Requested format not found');
    }

    console.log('Selected format:', selectedFormat.qualityLabel || selectedFormat.audioBitrate);

    // Generate filename
    const isAudio = format.includes('kbps');
    const sanitizedTitle = info.videoDetails.title.replace(/[^\w\s-]/g, '').trim();
    const fileName = `${sanitizedTitle}.${isAudio ? 'mp3' : 'mp4'}`;

    return {
      success: true,
      downloadUrl: selectedFormat.url,
      fileData: selectedFormat.url, // For direct download
      fileName: fileName,
    };
  } catch (error) {
    console.error('Error downloading YouTube video:', error);
    return {
      success: false,
      error: 'Failed to download YouTube video.',
    };
  }
}
