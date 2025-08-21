# downloader.py
# Lógica de descarga refactorizada del script original

import yt_dlp
import os
import tempfile
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from config import Config
from utils import (
    sanitizar_nombre_archivo, 
    verificar_ffmpeg, 
    formatear_duracion, 
    formatear_tamaño,
    generar_nombre_archivo_seguro
)

@dataclass
class VideoInfo:
    """Información del video extraída"""
    titulo: str
    duracion: int
    altura: int
    ancho: int
    fps: float
    formato: str
    thumbnail: str
    descripcion: str
    canal: str
    fecha_subida: str
    vistas: int
    tamaño_estimado: int
    formatos_disponibles: List[Dict]
    
    def __post_init__(self):
        """Limpia y valida los datos después de la inicialización"""
        self.titulo = sanitizar_nombre_archivo(self.titulo) if self.titulo else "Video sin título"
        self.duracion = max(0, self.duracion or 0)
        self.altura = max(0, self.altura or 0)
        self.ancho = max(0, self.ancho or 0)
        self.fps = max(0, self.fps or 0)
        self.vistas = max(0, self.vistas or 0)
        self.tamaño_estimado = max(0, self.tamaño_estimado or 0)

@dataclass
class DownloadResult:
    """Resultado de la descarga"""
    exito: bool
    archivo_descargado: str
    tamaño_final: int
    tiempo_descarga: float
    calidad_final: str
    mensaje: str
    error: Optional[str] = None
    
class ProgressHook:
    """Hook para capturar el progreso de descarga"""
    def __init__(self, callback=None):
        self.callback = callback
        self.progreso_actual = 0
        self.tamaño_total = 0
        self.velocidad = 0
        self.eta = 0
        
    def __call__(self, d):
        try:
            status = d.get('status', '')
            if status == 'downloading':
                if 'total_bytes' in d:
                    self.tamaño_total = d['total_bytes']
                elif 'total_bytes_estimate' in d:
                    self.tamaño_total = d['total_bytes_estimate']
                    
                if 'downloaded_bytes' in d and self.tamaño_total > 0:
                    self.progreso_actual = (d['downloaded_bytes'] / self.tamaño_total) * 100
                    
                self.velocidad = d.get('speed', 0) or 0
                self.eta = d.get('eta', 0) or 0
                
                if self.callback:
                    self.callback({
                        'status': 'downloading',
                        'progreso': self.progreso_actual,
                        'tamaño_total': self.tamaño_total,
                        'velocidad': self.velocidad,
                        'eta': self.eta,
                        'downloaded_bytes': d.get('downloaded_bytes', 0),
                        'total_bytes': self.tamaño_total,
                        '_percent_str': f"{self.progreso_actual:.1f}%"
                    })
            elif status == 'finished':
                self.progreso_actual = 100
                if self.callback:
                    self.callback({
                        'status': 'finished',
                        'progreso': 100,
                        'filename': d.get('filename', '')
                    })
        except Exception as e:
            # Evitar que errores en el hook interrumpan la descarga
            pass

class YouTubeDownloader:
    """Clase principal para manejar descargas de YouTube"""
    
    def __init__(self, directorio_descarga: str = None):
        self.directorio_descarga = directorio_descarga or Config.TEMP_DIR
        self.ffmpeg_disponible = verificar_ffmpeg()
        self.progress_hook = None
        
        # Crear directorio si no existe
        os.makedirs(self.directorio_descarga, exist_ok=True)
    
    def set_progress_callback(self, callback):
        """Establece el callback para el progreso de descarga"""
        self.progress_hook = ProgressHook(callback)
    
    def extraer_info_video(self, url: str) -> Optional[VideoInfo]:
        """Extrae información del video sin descargarlo"""
        try:
            opciones = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': False,
            }
            
            with yt_dlp.YoutubeDL(opciones) as ydl:
                info = ydl.extract_info(url, download=False)
                
                return VideoInfo(
                    titulo=info.get('title', 'Video sin título'),
                    duracion=info.get('duration', 0),
                    altura=info.get('height', 0),
                    ancho=info.get('width', 0),
                    fps=info.get('fps', 0),
                    formato=info.get('ext', 'mp4'),
                    thumbnail=info.get('thumbnail', ''),
                    descripcion=info.get('description', '')[:500] if info.get('description') else '',
                    canal=info.get('uploader', 'Canal desconocido'),
                    fecha_subida=info.get('upload_date', ''),
                    vistas=info.get('view_count', 0),
                    tamaño_estimado=info.get('filesize', 0) or info.get('filesize_approx', 0),
                    formatos_disponibles=info.get('formats', [])
                )
                
        except Exception as e:
            print(f"Error extrayendo información: {e}")
            return None
    
    def obtener_formatos_disponibles(self, info: VideoInfo) -> List[Dict]:
        """Obtiene y organiza los formatos disponibles"""
        if not info.formatos_disponibles:
            return []
        
        formatos_video = []
        formatos_audio = []
        
        for fmt in info.formatos_disponibles:
            if fmt.get('vcodec') != 'none' and fmt.get('height'):
                formatos_video.append({
                    'id': fmt.get('format_id'),
                    'altura': fmt.get('height'),
                    'fps': fmt.get('fps', 0),
                    'ext': fmt.get('ext'),
                    'tamaño': fmt.get('filesize'),
                    'vcodec': fmt.get('vcodec'),
                    'acodec': fmt.get('acodec')
                })
            elif fmt.get('acodec') != 'none':
                formatos_audio.append({
                    'id': fmt.get('format_id'),
                    'abr': fmt.get('abr'),
                    'ext': fmt.get('ext'),
                    'tamaño': fmt.get('filesize'),
                    'acodec': fmt.get('acodec')
                })
        
        # Ordenar por calidad
        formatos_video.sort(key=lambda x: (x['altura'] or 0, x['fps'] or 0), reverse=True)
        formatos_audio.sort(key=lambda x: x['abr'] or 0, reverse=True)
        
        return {
            'video': formatos_video[:10],  # Top 10 formatos de video
            'audio': formatos_audio[:5]    # Top 5 formatos de audio
        }
    
    def _obtener_opciones_video(self, calidad: str = 'auto') -> Dict:
        """Obtiene las opciones de yt-dlp para descarga de video con máxima calidad"""
        opciones_base = Config.YT_DLP_OPTIONS.copy()
        
        if self.ffmpeg_disponible:
            # Con ffmpeg - video + audio separados y merge para máxima calidad
            if calidad == '4k':
                formato = 'bestvideo[height<=2160][fps<=60]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/bestvideo+bestaudio/best'
            elif calidad == '1440p':
                formato = 'bestvideo[height<=1440][fps<=60]+bestaudio[ext=m4a]/bestvideo[height<=1440]+bestaudio/bestvideo+bestaudio/best'
            elif calidad == '1080p':
                formato = 'bestvideo[height<=1080][fps<=60]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/bestvideo+bestaudio/best'
            elif calidad == '720p':
                formato = 'bestvideo[height<=720][fps<=60]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/bestvideo+bestaudio/best'
            else:
                formato = 'bestvideo[fps<=60]+bestaudio[ext=m4a]/bestvideo+bestaudio/best'
            
            opciones_base.update({
                'format': formato,
                'merge_output_format': 'mp4',
                'writesubtitles': False,  # No descargar subtítulos para evitar errores
                'writeautomaticsub': False,
            })
        else:
            # Sin ffmpeg - formato único con mejor calidad disponible
            if calidad in ['4k', '1440p', '1080p']:
                formato = f'best[height<={calidad[:-1]}]/best'
            elif calidad == '720p':
                formato = 'best[height<=720]/best'
            else:
                formato = 'best'
            
            opciones_base.update({
                'format': formato,
            })
        
        # Configurar directorio y nombre de archivo
        opciones_base.update({
            'outtmpl': os.path.join(self.directorio_descarga, Config.FILENAME_TEMPLATE_VIDEO),
        })
        
        if self.progress_hook:
            opciones_base['progress_hooks'] = [self.progress_hook]
        
        return opciones_base
    
    def _obtener_opciones_audio(self) -> Dict:
        """Obtiene las opciones de yt-dlp para descarga de audio"""
        opciones_base = Config.YT_DLP_OPTIONS.copy()
        opciones_base.update(Config.AUDIO_OPTIONS)
        
        if self.ffmpeg_disponible:
            opciones_base['postprocessors'] = Config.AUDIO_POSTPROCESSORS
            opciones_base['outtmpl'] = os.path.join(self.directorio_descarga, Config.FILENAME_TEMPLATE_AUDIO_HQ)
        else:
            opciones_base['outtmpl'] = os.path.join(self.directorio_descarga, Config.FILENAME_TEMPLATE_AUDIO)
        
        if self.progress_hook:
            opciones_base['progress_hooks'] = [self.progress_hook]
        
        return opciones_base
    
    def descargar_video(self, url: str, calidad: str = 'auto') -> DownloadResult:
        """Descarga video con audio"""
        import time
        inicio = time.time()
        
        try:
            opciones = self._obtener_opciones_video(calidad)
            
            with yt_dlp.YoutubeDL(opciones) as ydl:
                # Extraer info primero
                info = ydl.extract_info(url, download=False)
                titulo = info.get('title', 'video_sin_titulo')
                
                # Descargar
                ydl.download([url])
                
                # Buscar archivo descargado más reciente en el directorio
                archivos_mp4 = []
                if os.path.exists(self.directorio_descarga):
                    for archivo in os.listdir(self.directorio_descarga):
                        if archivo.endswith('.mp4'):
                            ruta_completa = os.path.join(self.directorio_descarga, archivo)
                            archivos_mp4.append((ruta_completa, os.path.getmtime(ruta_completa)))
                
                if archivos_mp4:
                    # Ordenar por tiempo de modificación (más reciente primero)
                    archivos_mp4.sort(key=lambda x: x[1], reverse=True)
                    ruta_archivo = archivos_mp4[0][0]
                    tamaño = os.path.getsize(ruta_archivo)
                else:
                    raise FileNotFoundError("No se encontró el archivo descargado")
                
                tiempo_total = time.time() - inicio
                
                return DownloadResult(
                    exito=True,
                    archivo_descargado=ruta_archivo,
                    tamaño_final=tamaño,
                    tiempo_descarga=tiempo_total,
                    calidad_final=f"{info.get('height', 'unknown')}p",
                    mensaje="Video descargado exitosamente"
                )
                
        except yt_dlp.utils.DownloadError as e:
            return DownloadResult(
                exito=False,
                archivo_descargado="",
                tamaño_final=0,
                tiempo_descarga=time.time() - inicio,
                calidad_final="",
                mensaje="Error de descarga",
                error=str(e)
            )
        except Exception as e:
            return DownloadResult(
                exito=False,
                archivo_descargado="",
                tamaño_final=0,
                tiempo_descarga=time.time() - inicio,
                calidad_final="",
                mensaje="Error inesperado",
                error=str(e)
            )
    
    def descargar_audio(self, url: str) -> DownloadResult:
        """Descarga solo audio/podcast en la mejor calidad disponible"""
        import time
        inicio = time.time()
        
        try:
            # Intentar con configuración de máxima calidad primero
            opciones_alta_calidad = Config.YT_DLP_OPTIONS.copy()
            opciones_alta_calidad.update({
                'format': 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio/best[abr>128]/best',
                'outtmpl': os.path.join(self.directorio_descarga, '%(title)s.%(ext)s'),
            })
            
            if self.progress_hook:
                opciones_alta_calidad['progress_hooks'] = [self.progress_hook]
            
            info = None
            archivo_descargado = None
            
            with yt_dlp.YoutubeDL(opciones_alta_calidad) as ydl:
                try:
                    # Extraer info
                    info = ydl.extract_info(url, download=False)
                    if info is None:
                        raise Exception("No se pudo extraer información del video")
                    
                    # Descargar
                    ydl.download([url])
                    
                    # Buscar archivo descargado más reciente
                    archivos_audio = []
                    if os.path.exists(self.directorio_descarga):
                        for archivo in os.listdir(self.directorio_descarga):
                            if archivo.endswith(('.mp3', '.m4a', '.aac', '.mp4', '.webm', '.mkv')):
                                ruta_completa = os.path.join(self.directorio_descarga, archivo)
                                archivos_audio.append((ruta_completa, os.path.getmtime(ruta_completa)))
                    
                    if archivos_audio:
                        archivos_audio.sort(key=lambda x: x[1], reverse=True)
                        archivo_descargado = archivos_audio[0][0]
                        
                        # Si FFmpeg está disponible, convertir a MP3 de alta calidad
                        if self.ffmpeg_disponible and not archivo_descargado.endswith('.mp3'):
                            try:
                                import subprocess
                                nombre_base = os.path.splitext(archivo_descargado)[0]
                                archivo_mp3 = f"{nombre_base}.mp3"
                                
                                # Usar configuración de alta calidad para MP3
                                subprocess.run([
                                    'ffmpeg', '-i', archivo_descargado, 
                                    '-b:a', '320k',  # Bitrate de 320 kbps para máxima calidad
                                    '-y', archivo_mp3
                                ], check=True, capture_output=True)
                                
                                # Eliminar archivo original si la conversión fue exitosa
                                if os.path.exists(archivo_mp3):
                                    os.remove(archivo_descargado)
                                    archivo_descargado = archivo_mp3
                            except:
                                pass  # Si falla la conversión, mantener archivo original
                        
                    else:
                        raise FileNotFoundError("No se encontró el archivo de audio descargado")
                        
                except Exception as e:
                    # Si falla, intentar con formato más básico pero estable
                    opciones_fallback = {
                        'format': 'best[abr]/best',
                        'outtmpl': os.path.join(self.directorio_descarga, '%(title)s.%(ext)s'),
                        'ignoreerrors': True,
                        'no_warnings': True,
                    }
                    
                    with yt_dlp.YoutubeDL(opciones_fallback) as ydl_fallback:
                        info = ydl_fallback.extract_info(url, download=False)
                        if info is None:
                            raise Exception("No se pudo extraer información del video incluso con fallback")
                        
                        ydl_fallback.download([url])
                        
                        # Buscar archivo descargado
                        archivos_audio = []
                        if os.path.exists(self.directorio_descarga):
                            for archivo in os.listdir(self.directorio_descarga):
                                if archivo.endswith(('.mp3', '.m4a', '.aac', '.mp4', '.webm', '.mkv')):
                                    ruta_completa = os.path.join(self.directorio_descarga, archivo)
                                    archivos_audio.append((ruta_completa, os.path.getmtime(ruta_completa)))
                        
                        if archivos_audio:
                            archivos_audio.sort(key=lambda x: x[1], reverse=True)
                            archivo_descargado = archivos_audio[0][0]
                        else:
                            raise FileNotFoundError("No se encontró el archivo de audio descargado (fallback)")
            
            if archivo_descargado and os.path.exists(archivo_descargado):
                tamaño = os.path.getsize(archivo_descargado)
                tiempo_total = time.time() - inicio
                
                # Determinar calidad del audio
                calidad_str = "unknown"
                if info:
                    abr = info.get('abr', None)
                    if abr:
                        calidad_str = f"{abr}kbps"
                    elif archivo_descargado.endswith('.mp3'):
                        calidad_str = "320kbps (convertido)"
                    elif archivo_descargado.endswith('.m4a'):
                        calidad_str = "Alta calidad (m4a)"
                
                return DownloadResult(
                    exito=True,
                    archivo_descargado=archivo_descargado,
                    tamaño_final=tamaño,
                    tiempo_descarga=tiempo_total,
                    calidad_final=calidad_str,
                    mensaje="Audio descargado exitosamente en máxima calidad"
                )
            else:
                raise FileNotFoundError("Archivo no encontrado después de descarga")
                
        except yt_dlp.utils.DownloadError as e:
            error_msg = str(e)
            if "403" in error_msg or "Forbidden" in error_msg:
                return DownloadResult(
                    exito=False,
                    archivo_descargado="",
                    tamaño_final=0,
                    tiempo_descarga=time.time() - inicio,
                    calidad_final="",
                    mensaje="Error de acceso - intenta con otro video",
                    error="HTTP 403: Acceso denegado por YouTube"
                )
            else:
                return DownloadResult(
                    exito=False,
                    archivo_descargado="",
                    tamaño_final=0,
                    tiempo_descarga=time.time() - inicio,
                    calidad_final="",
                    mensaje="Error de descarga",
                    error=str(e)
                )
        except Exception as e:
            return DownloadResult(
                exito=False,
                archivo_descargado="",
                tamaño_final=0,
                tiempo_descarga=time.time() - inicio,
                calidad_final="",
                mensaje="Error inesperado",
                error=str(e)
            )
    
    def limpiar_archivos_temporales(self):
        """Limpia archivos temporales del directorio de descarga"""
        try:
            if os.path.exists(self.directorio_descarga):
                for archivo in os.listdir(self.directorio_descarga):
                    if archivo.endswith(('.part', '.tmp', '.temp')):
                        ruta_completa = os.path.join(self.directorio_descarga, archivo)
                        os.remove(ruta_completa)
        except Exception as e:
            print(f"Error limpiando archivos temporales: {e}")