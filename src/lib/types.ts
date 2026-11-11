export interface VideoAnalysis {
  title: string;
  duration: string;
  thumbnailUrl: string;
  /** Alturas de video disponibles, de mayor a menor (p. ej. [2160, 1080, 720]). */
  heights: number[];
}

export type AnalysisResult = VideoAnalysis | { error: string };

export interface DownloadRequest {
  youtubeUrl: string;
  kind: 'video' | 'audio' | 'dual';
  /** Altura máxima del video; omitir para la mejor disponible. */
  height?: number;
  /** Bitrate del MP3. */
  kbps?: number;
}
