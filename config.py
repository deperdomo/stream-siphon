# config.py
# Configuraciones y constantes de la aplicación

class Config:
    """Configuraciones centralizadas para la aplicación YouTube Downloader"""
    
    # Límites de archivos y recursos
    MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB
    TEMP_DIR = "./temp"
    CLEANUP_INTERVAL = 3600  # 1 hora en segundos
    
    # Calidades soportadas
    SUPPORTED_QUALITIES = ["4k", "1440p", "1080p", "720p", "auto"]
    
    # Configuraciones de yt-dlp para video con audio
    YT_DLP_VIDEO_OPTIONS = {
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
    }
    
    # Configuraciones de yt-dlp para audio
    YT_DLP_AUDIO_OPTIONS = {
        'writeinfojson': False,
        'writethumbnail': False,
        'ignoreerrors': True,
        'no_warnings': False,
        'extractflat': False,
        'prefer_ffmpeg': True,
        'keepvideo': False,
        'noplaylist': True,
        'concurrent_fragment_downloads': 3,
        'retries': 3,
        'fragment_retries': 3,
    }
    
    # Formatos de descarga optimizados
    VIDEO_FORMAT_WITH_FFMPEG = (
        'bestvideo[height>=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height>=2160]+bestaudio/'
        'bestvideo[height>=1440][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height>=1440]+bestaudio/'
        'bestvideo[height>=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height>=1080]+bestaudio/'
        'bestvideo[height>=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height>=720]+bestaudio/'
        'bestvideo[ext=mp4]+bestaudio[ext=m4a]/'
        'bestvideo+bestaudio/'
        'best[height>=2160]/'
        'best[height>=1440]/'
        'best[height>=1080]/'
        'best[height>=720]/'
        'best'
    )
    
    VIDEO_FORMAT_WITHOUT_FFMPEG = (
        'best[height>=2160][ext=mp4]/'
        'best[height>=1440][ext=mp4]/'
        'best[height>=1080][ext=mp4]/'
        'best[height>=720][ext=mp4]/'
        'best[ext=mp4]/'
        'best'
    )
    
    AUDIO_FORMAT = (
        'bestaudio[ext=m4a]/bestaudio[ext=aac]/bestaudio[ext=mp3]/bestaudio/best[height<=480]/best'
    )
    
    # Configuraciones de calidad específicas
    QUALITY_FORMATS = {
        '4k': 'bestvideo[height>=2160]+bestaudio/best[height>=2160]',
        '1440p': 'bestvideo[height>=1440][height<2160]+bestaudio/best[height>=1440][height<2160]',
        '1080p': 'bestvideo[height>=1080][height<1440]+bestaudio/best[height>=1080][height<1440]',
        '720p': 'bestvideo[height>=720][height<1080]+bestaudio/best[height>=720][height<1080]',
        'auto': VIDEO_FORMAT_WITH_FFMPEG
    }
    
    # Configuraciones de postprocesamiento para audio
    AUDIO_POSTPROCESSOR = [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
        'preferredquality': '0',  # 0 = mantener calidad original
    }]
    
    # Plantillas de nombres de archivo
    VIDEO_FILENAME_TEMPLATE = '%(title)s [%(height)sp].%(ext)s'
    AUDIO_FILENAME_TEMPLATE = '%(title)s [PODCAST HQ].%(ext)s'
    AUDIO_ORIGINAL_FILENAME_TEMPLATE = '%(title)s [PODCAST].%(ext)s'
    
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