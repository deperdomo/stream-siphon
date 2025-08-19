# utils.py
# Utilidades auxiliares extraídas del script original

import re
import os
import subprocess
from typing import Optional

def sanitizar_nombre_archivo(filename: str) -> str:
    """Limpia el nombre del archivo de caracteres no válidos"""
    # Reemplazar caracteres problemáticos
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Remover múltiples espacios y guiones bajos
    filename = re.sub(r'[_\s]+', '_', filename)
    # Limitar longitud del nombre
    if len(filename) > 200:
        filename = filename[:200]
    return filename.strip('_')

def verificar_ffmpeg() -> bool:
    """Verifica si ffmpeg está disponible"""
    try:
        # Intentar múltiples formas de encontrar ffmpeg
        comandos_ffmpeg = ['ffmpeg', 'ffmpeg.exe']
        
        for cmd in comandos_ffmpeg:
            try:
                result = subprocess.run([cmd, '-version'], 
                                      capture_output=True, 
                                      check=True, 
                                      timeout=5)
                if result.returncode == 0:
                    return True
            except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
                continue
                
        # Intentar buscar en ubicaciones comunes
        rutas_comunes = [
            r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
            r"C:\ffmpeg\bin\ffmpeg.exe",
            r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe"
        ]
        
        for ruta in rutas_comunes:
            if os.path.exists(ruta):
                try:
                    result = subprocess.run([ruta, '-version'], 
                                          capture_output=True, 
                                          check=True, 
                                          timeout=5)
                    if result.returncode == 0:
                        return True
                except:
                    continue
                    
        return False
        
    except Exception:
        return False

def validar_url(url: str) -> bool:
    """Valida si la URL es válida"""
    if not url or not isinstance(url, str):
        return False
    return url.strip().startswith(('http://', 'https://'))

def formatear_duracion(segundos: int) -> str:
    """Convierte segundos a formato MM:SS o HH:MM:SS"""
    if not segundos or segundos <= 0:
        return "00:00"
    
    horas, resto = divmod(segundos, 3600)
    mins, secs = divmod(resto, 60)
    
    if horas > 0:
        return f"{horas:02d}:{mins:02d}:{secs:02d}"
    else:
        return f"{mins:02d}:{secs:02d}"

def formatear_tamaño(bytes_size: int) -> str:
    """Convierte bytes a formato legible"""
    if not bytes_size or bytes_size <= 0:
        return "Desconocido"
    
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.1f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.1f} PB"

def formatear_resolucion(width: int, height: int) -> str:
    """Formatea la resolución de video"""
    if not width or not height:
        return "Desconocida"
    return f"{width}x{height}"

def obtener_calidad_desde_altura(height: int) -> str:
    """Obtiene la etiqueta de calidad basada en la altura del video"""
    if not height:
        return "Desconocida"
    
    if height >= 2160:
        return "4K"
    elif height >= 1440:
        return "1440p"
    elif height >= 1080:
        return "1080p"
    elif height >= 720:
        return "720p"
    elif height >= 480:
        return "480p"
    elif height >= 360:
        return "360p"
    else:
        return f"{height}p"

def limpiar_titulo(titulo: str) -> str:
    """Limpia el título del video para mostrar en la interfaz"""
    if not titulo:
        return "Título no disponible"
    
    # Limitar longitud para la interfaz
    if len(titulo) > 100:
        return titulo[:97] + "..."
    return titulo

def es_url_youtube(url: str) -> bool:
    """Verifica si la URL es de YouTube"""
    if not validar_url(url):
        return False
    
    dominios_youtube = [
        'youtube.com',
        'www.youtube.com',
        'youtu.be',
        'm.youtube.com'
    ]
    
    return any(dominio in url.lower() for dominio in dominios_youtube)

def extraer_id_video_youtube(url: str) -> Optional[str]:
    """Extrae el ID del video de YouTube de la URL"""
    if not es_url_youtube(url):
        return None
    
    # Patrones para diferentes formatos de URL de YouTube
    patrones = [
        r'(?:v=|/)([0-9A-Za-z_-]{11}).*',
        r'(?:embed/)([0-9A-Za-z_-]{11})',
        r'(?:v/)([0-9A-Za-z_-]{11})'
    ]
    
    for patron in patrones:
        match = re.search(patron, url)
        if match:
            return match.group(1)
    
    return None

def generar_nombre_archivo_seguro(titulo: str, extension: str, calidad: str = None) -> str:
    """Genera un nombre de archivo seguro basado en el título y otros parámetros"""
    titulo_limpio = sanitizar_nombre_archivo(titulo)
    
    if calidad:
        nombre = f"{titulo_limpio} [{calidad}].{extension}"
    else:
        nombre = f"{titulo_limpio}.{extension}"
    
    return nombre

def validar_tamaño_archivo(tamaño: int, limite_mb: int = 500) -> bool:
    """Valida si el tamaño del archivo está dentro del límite permitido"""
    if not tamaño:
        return True  # Si no conocemos el tamaño, permitir la descarga
    
    limite_bytes = limite_mb * 1024 * 1024
    return tamaño <= limite_bytes

def obtener_extension_por_formato(formato: str) -> str:
    """Obtiene la extensión de archivo apropiada según el formato"""
    extensiones = {
        'video': 'mp4',
        'audio': 'mp3',
        'podcast': 'mp3'
    }
    return extensiones.get(formato.lower(), 'mp4')