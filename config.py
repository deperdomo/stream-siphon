# config.py
# Configuraciones y constantes de la aplicación

import os
from pathlib import Path

def get_downloads_directory():
    """Obtiene la carpeta de Descargas del usuario según el sistema operativo"""
    try:
        # Intentar obtener la carpeta de Descargas del usuario
        if os.name == 'nt':  # Windows
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 
                               r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders") as key:
                downloads_path = winreg.QueryValueEx(key, "{374DE290-123F-4565-9164-39C4925E467B}")[0]
                return downloads_path
        else:  # Linux/Mac
            return str(Path.home() / "Downloads")
    except:
        # Fallback: usar ~/Downloads
        return str(Path.home() / "Downloads")

class Config:
    """Configuraciones centralizadas para la aplicación YouTube Downloader"""
    
    # Límites de archivos y recursos
    MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB
    TEMP_DIR = get_downloads_directory()  # Carpeta de Descargas del usuario
    CLEANUP_INTERVAL = 3600  # 1 hora en segundos
    
    # Calidades soportadas
    SUPPORTED_QUALITIES = ["4k", "1440p", "1080p", "720p", "auto"]
    
    # Configuraciones básicas de yt-dlp
    YT_DLP_OPTIONS = {
        'writeinfojson': False,  # NO guardar metadatos
        'writethumbnail': False,  # NO descargar miniatura
        'ignoreerrors': True,  # Continuar si hay errores menores
        'no_warnings': False,
        'extractflat': False,
        'prefer_ffmpeg': True,
        'keepvideo': False,  # No mantener archivos temporales
        'embed_subs': False,  # No embebido de subtítulos para evitar errores
        'concurrent_fragment_downloads': 3,  # Descarga más rápida
        'retries': 3,
        'fragment_retries': 3,
        'noplaylist': True,
    }
    
    # Configuraciones específicas para audio
    AUDIO_OPTIONS = {
        'format': 'bestaudio[ext=m4a]/bestaudio[ext=aac]/bestaudio[ext=mp3]/bestaudio/best[height<=480]/best',
        'noplaylist': True,
    }
    
    # Formatos de video con ffmpeg disponible (combinación de video y audio)
    VIDEO_FORMATS_WITH_FFMPEG = {
        '4k': 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
        '1440p': 'bestvideo[height<=1440]+bestaudio/best[height<=1440]',
        '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
        '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
        'auto': 'bestvideo+bestaudio/best'
    }
    
    # Formatos de video sin ffmpeg (formato único con audio incluido)
    VIDEO_FORMATS_NO_FFMPEG = {
        '4k': 'best[height<=2160]',
        '1440p': 'best[height<=1440]',
        '1080p': 'best[height<=1080]',
        '720p': 'best[height<=720]',
        'auto': 'best'
    }
    
    # Postprocesadores de audio
    AUDIO_POSTPROCESSORS = [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
        'preferredquality': '0',  # 0 = mantener calidad original
    }]
    
    # Plantillas de nombres de archivo
    FILENAME_TEMPLATE_VIDEO = '%(title)s [%(height)sp].%(ext)s'
    FILENAME_TEMPLATE_AUDIO_HQ = '%(title)s [PODCAST HQ].%(ext)s'
    FILENAME_TEMPLATE_AUDIO = '%(title)s [PODCAST].%(ext)s'
    
    # Configuraciones de la interfaz web
    STREAMLIT_CONFIG = {
        'page_title': 'YouTube Downloader',
        'page_icon': '🎬',
        'layout': 'wide',
        'initial_sidebar_state': 'expanded'
    }
    
    # Colores de la interfaz
    COLORS = {
        'primary': '#ff6b6b',  # rojo coral
        'secondary': '#4ecdc4',  # turquesa
        'background': '#f0f2f6',  # gris claro
        'text': '#262730'  # gris oscuro
    }
    
    # Mensajes de la interfaz
    MESSAGES = {
        'url_placeholder': 'https://www.youtube.com/watch?v=...',
        'url_help': 'Pega aquí la URL del video de YouTube',
        'invalid_url': '❌ URL inválida. Debe comenzar con http:// o https://',
        'ffmpeg_available': '✅ ffmpeg disponible',
        'ffmpeg_unavailable': '⚠️ ffmpeg no disponible',
        'ffmpeg_install_info': 'Instala ffmpeg para mejor calidad',
        'download_success': '✅ ¡Descarga completada!',
        'download_error': '❌ Error en la descarga',
        'processing': '🔄 Procesando...',
        'downloading': '📥 Descargando...',
    }