export interface AnalyzeYoutubeUrlInput {
  youtubeUrl: string;
}

export interface AnalyzeYoutubeUrlOutput {
  title: string;
  duration: string;
  thumbnailUrl: string;
  formats: string[];
}

export interface DownloadYoutubeVideoInput {
  youtubeUrl: string;
  format: string;
  downloadType?: 'single' | 'dual'; // single = video OR audio, dual = video AND audio
}

export interface DownloadYoutubeVideoOutput {
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  error?: string;
}