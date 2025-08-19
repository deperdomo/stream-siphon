"""Módulo de manejo de errores para YouTube Downloader"""

import logging
import traceback
from typing import Dict, Any, Optional
from datetime import datetime
from enum import Enum
import streamlit as st

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('youtube_downloader.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

class ErrorType(Enum):
    """Tipos de errores del sistema"""
    NETWORK_ERROR = "network_error"
    URL_ERROR = "url_error"
    DOWNLOAD_ERROR = "download_error"
    FILE_ERROR = "file_error"
    VALIDATION_ERROR = "validation_error"
    SYSTEM_ERROR = "system_error"
    FFMPEG_ERROR = "ffmpeg_error"
    PERMISSION_ERROR = "permission_error"
    DISK_SPACE_ERROR = "disk_space_error"
    TIMEOUT_ERROR = "timeout_error"

class YouTubeDownloaderError(Exception):
    """Excepción base para errores del descargador"""
    def __init__(self, message: str, error_type: ErrorType, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.error_type = error_type
        self.details = details or {}
        self.timestamp = datetime.now()
        super().__init__(self.message)

class NetworkError(YouTubeDownloaderError):
    """Error de conexión de red"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorType.NETWORK_ERROR, details)

class URLError(YouTubeDownloaderError):
    """Error de URL inválida"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorType.URL_ERROR, details)

class DownloadError(YouTubeDownloaderError):
    """Error durante la descarga"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorType.DOWNLOAD_ERROR, details)

class FileError(YouTubeDownloaderError):
    """Error de archivo"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorType.FILE_ERROR, details)

class ValidationError(YouTubeDownloaderError):
    """Error de validación"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorType.VALIDATION_ERROR, details)

class ErrorHandler:
    """Manejador centralizado de errores"""
    
    ERROR_MESSAGES = {
        ErrorType.NETWORK_ERROR: {
            'title': '🌐 Error de Conexión',
            'message': 'No se pudo conectar al servidor. Verifica tu conexión a internet.',
            'suggestions': [
                'Verifica tu conexión a internet',
                'Intenta nuevamente en unos minutos',
                'Comprueba si YouTube está disponible'
            ]
        },
        ErrorType.URL_ERROR: {
            'title': '🔗 URL Inválida',
            'message': 'La URL proporcionada no es válida o no es compatible.',
            'suggestions': [
                'Verifica que la URL sea correcta',
                'Asegúrate de usar una URL de YouTube válida',
                'Copia la URL directamente desde el navegador'
            ]
        },
        ErrorType.DOWNLOAD_ERROR: {
            'title': '⬇️ Error de Descarga',
            'message': 'Ocurrió un error durante la descarga del archivo.',
            'suggestions': [
                'Intenta con una calidad diferente',
                'Verifica que el video esté disponible',
                'Comprueba el espacio disponible en disco'
            ]
        },
        ErrorType.FILE_ERROR: {
            'title': '📁 Error de Archivo',
            'message': 'No se pudo procesar el archivo.',
            'suggestions': [
                'Verifica los permisos de escritura',
                'Comprueba el espacio disponible en disco',
                'Intenta cambiar la ubicación de descarga'
            ]
        },
        ErrorType.VALIDATION_ERROR: {
            'title': '⚠️ Error de Validación',
            'message': 'Los datos proporcionados no son válidos.',
            'suggestions': [
                'Verifica los datos ingresados',
                'Asegúrate de cumplir con los requisitos',
                'Intenta con valores diferentes'
            ]
        },
        ErrorType.SYSTEM_ERROR: {
            'title': '⚙️ Error del Sistema',
            'message': 'Ocurrió un error interno del sistema.',
            'suggestions': [
                'Reinicia la aplicación',
                'Verifica los recursos del sistema',
                'Contacta al soporte técnico si persiste'
            ]
        },
        ErrorType.FFMPEG_ERROR: {
            'title': '🎬 Error de FFmpeg',
            'message': 'Error al procesar el archivo de video/audio.',
            'suggestions': [
                'Verifica que FFmpeg esté instalado',
                'Intenta con un formato diferente',
                'Comprueba los permisos de archivo'
            ]
        },
        ErrorType.PERMISSION_ERROR: {
            'title': '🔒 Error de Permisos',
            'message': 'No tienes permisos suficientes para realizar esta operación.',
            'suggestions': [
                'Ejecuta la aplicación como administrador',
                'Verifica los permisos de la carpeta',
                'Cambia la ubicación de descarga'
            ]
        },
        ErrorType.DISK_SPACE_ERROR: {
            'title': '💾 Espacio Insuficiente',
            'message': 'No hay suficiente espacio en disco para completar la descarga.',
            'suggestions': [
                'Libera espacio en disco',
                'Cambia la ubicación de descarga',
                'Intenta con una calidad menor'
            ]
        },
        ErrorType.TIMEOUT_ERROR: {
            'title': '⏱️ Tiempo Agotado',
            'message': 'La operación tardó demasiado tiempo en completarse.',
            'suggestions': [
                'Verifica tu conexión a internet',
                'Intenta nuevamente',
                'Prueba con una calidad menor'
            ]
        }
    }
    
    @staticmethod
    def handle_error(error: Exception, context: str = "") -> Dict[str, Any]:
        """Maneja un error y devuelve información estructurada"""
        error_info = {
            'timestamp': datetime.now(),
            'context': context,
            'error_type': ErrorType.SYSTEM_ERROR,
            'message': str(error),
            'details': {},
            'traceback': traceback.format_exc()
        }
        
        # Determinar el tipo de error
        if isinstance(error, YouTubeDownloaderError):
            error_info['error_type'] = error.error_type
            error_info['details'] = error.details
        elif 'network' in str(error).lower() or 'connection' in str(error).lower():
            error_info['error_type'] = ErrorType.NETWORK_ERROR
        elif 'url' in str(error).lower() or 'invalid' in str(error).lower():
            error_info['error_type'] = ErrorType.URL_ERROR
        elif 'download' in str(error).lower():
            error_info['error_type'] = ErrorType.DOWNLOAD_ERROR
        elif 'file' in str(error).lower() or 'directory' in str(error).lower():
            error_info['error_type'] = ErrorType.FILE_ERROR
        elif 'permission' in str(error).lower():
            error_info['error_type'] = ErrorType.PERMISSION_ERROR
        elif 'space' in str(error).lower() or 'disk' in str(error).lower():
            error_info['error_type'] = ErrorType.DISK_SPACE_ERROR
        elif 'timeout' in str(error).lower():
            error_info['error_type'] = ErrorType.TIMEOUT_ERROR
        elif 'ffmpeg' in str(error).lower():
            error_info['error_type'] = ErrorType.FFMPEG_ERROR
        
        # Registrar el error
        logger.error(f"Error en {context}: {error_info['message']}", exc_info=True)
        
        return error_info
    
    @staticmethod
    def display_error(error_info: Dict[str, Any]):
        """Muestra un error en la interfaz de Streamlit"""
        error_type = error_info['error_type']
        error_config = ErrorHandler.ERROR_MESSAGES.get(error_type, ErrorHandler.ERROR_MESSAGES[ErrorType.SYSTEM_ERROR])
        
        with st.container():
            st.error(f"**{error_config['title']}**")
            st.write(error_config['message'])
            
            if error_info.get('message') and error_info['message'] != error_config['message']:
                with st.expander("📋 Detalles técnicos"):
                    st.code(error_info['message'])
            
            st.write("**💡 Sugerencias:**")
            for suggestion in error_config['suggestions']:
                st.write(f"• {suggestion}")
            
            # Mostrar detalles adicionales si están disponibles
            if error_info.get('details'):
                with st.expander("🔍 Información adicional"):
                    for key, value in error_info['details'].items():
                        st.write(f"**{key}:** {value}")
    
    @staticmethod
    def display_success(message: str, details: Optional[Dict[str, Any]] = None):
        """Muestra un mensaje de éxito"""
        st.success(f"✅ {message}")
        
        if details:
            with st.expander("📊 Detalles"):
                for key, value in details.items():
                    st.write(f"**{key}:** {value}")
    
    @staticmethod
    def display_warning(message: str, suggestions: Optional[list] = None):
        """Muestra un mensaje de advertencia"""
        st.warning(f"⚠️ {message}")
        
        if suggestions:
            st.write("**💡 Sugerencias:**")
            for suggestion in suggestions:
                st.write(f"• {suggestion}")
    
    @staticmethod
    def display_info(message: str, details: Optional[Dict[str, Any]] = None):
        """Muestra un mensaje informativo"""
        st.info(f"ℹ️ {message}")
        
        if details:
            with st.expander("📋 Más información"):
                for key, value in details.items():
                    st.write(f"**{key}:** {value}")

# Instancia global del manejador de errores
error_handler = ErrorHandler()