import { NextResponse } from 'next/server';
import YTDlpWrap from 'yt-dlp-wrap';
import { join } from 'path';

// Health check endpoint to test YouTube connectivity
export async function GET() {
  try {
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll test video
    
    console.log('🔍 Running YouTube connectivity test...');
    
    // Test basic info fetch
    const startTime = Date.now();
    
    try {
      const ytDlpPath = join(process.cwd(), 'yt-dlp.exe');
      const ytDlp = new YTDlpWrap(ytDlpPath);
      
      const basicInfo = await ytDlp.getVideoInfo(testUrl);
      
      const responseTime = Date.now() - startTime;
      
      return NextResponse.json({
        status: 'healthy',
        youtube_connectivity: 'working',
        response_time_ms: responseTime,
        test_video: {
          title: basicInfo.videoDetails.title,
          duration: basicInfo.videoDetails.lengthSeconds,
          available_formats: basicInfo.formats.length
        },
        timestamp: new Date().toISOString(),
        ytdl_version: '4.16.12' // Update this when ytdl-core updates
      });
      
    } catch (ytdlError) {
      console.error('YouTube test failed:', ytdlError);
      
      const errorMessage = ytdlError instanceof Error ? ytdlError.message : String(ytdlError);
      let status = 'degraded';
      let issue = 'unknown_error';
      
      if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        issue = 'rate_limited';
        status = 'blocked';
      } else if (errorMessage.includes('parsing watch.html') || errorMessage.includes('YouTube made a change')) {
        issue = 'structure_changed';
        status = 'parsing_error';
      } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
        issue = 'network_error';
        status = 'connection_error';
      }
      
      return NextResponse.json({
        status: status,
        youtube_connectivity: 'error',
        error: {
          type: issue,
          message: errorMessage,
          suggestions: getSuggestions(issue)
        },
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      error: {
        type: 'health_check_failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function getSuggestions(issue: string): string[] {
  switch (issue) {
    case 'rate_limited':
      return [
        'Wait 10-15 minutes before trying again',
        'YouTube is temporarily blocking requests',
        'This is usually resolved automatically'
      ];
    case 'structure_changed':
      return [
        'YouTube updated their page structure',
        'Wait for ytdl-core library update',
        'Try again in a few hours'
      ];
    case 'network_error':
      return [
        'Check your internet connection',
        'Verify firewall settings',
        'Try using a VPN if blocked regionally'
      ];
    default:
      return [
        'Wait a few minutes and try again',
        'Check if the video is publicly accessible',
        'Report persistent issues'
      ];
  }
}