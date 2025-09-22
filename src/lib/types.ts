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
}

export interface DownloadYoutubeVideoOutput {
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  error?: string;
}