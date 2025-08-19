# app.py
# Aplicación web principal con Streamlit

import streamlit as st
import os
import time
import threading
from typing import Optional
from downloader import YouTubeDownloader, VideoInfo, DownloadResult
from utils import (
    validar_url, es_url_youtube, formatear_duracion, 
    formatear_tamaño, limpiar_titulo, obtener_calidad_desde_altura
)
from config import Config
from cleanup_scheduler import cleanup_scheduler
from error_handler import error_handler, YouTubeDownloaderError, URLError, DownloadError
from performance_optimizer import performance_optimizer, optimize_performance, cached_video_info

# Configuración de la página
st.set_page_config(
    page_title="YouTube Downloader",
    page_icon="🎬",
    layout="wide",
    initial_sidebar_state="expanded"
)

# CSS personalizado
st.markdown("""
<style>
    .main-header {
        background: linear-gradient(90deg, #ff6b6b, #4ecdc4);
        padding: 2rem;
        border-radius: 10px;
        text-align: center;
        margin-bottom: 2rem;
    }
    .main-header h1 {
        color: white;
        margin: 0;
        font-size: 2.5rem;
    }
    .main-header p {
        color: white;
        margin: 0.5rem 0 0 0;
        font-size: 1.2rem;
    }
    .feature-card {
        background: #f8f9fa;
        color: #333;
        padding: 1rem;
        border-radius: 8px;
        border-left: 4px solid #4ecdc4;
        margin: 0.5rem 0;
        transition: all 0.3s ease;
    }
    
    /* Estilos para modo oscuro */
    @media (prefers-color-scheme: dark) {
        .feature-card {
            background: #2d3748;
            color: #e2e8f0;
            border-left: 4px solid #4ecdc4;
        }
        .feature-card h4 {
            color: #ffffff !important;
        }
        .feature-card p {
            color: #cbd5e0 !important;
        }
    }
    
    /* Forzar estilos para tema oscuro de Streamlit */
    [data-theme="dark"] .feature-card {
        background: #2d3748 !important;
        color: #e2e8f0 !important;
    }
    [data-theme="dark"] .feature-card h4 {
        color: #ffffff !important;
    }
    [data-theme="dark"] .feature-card p {
        color: #cbd5e0 !important;
    }
    .download-card {
        background: #fff;
        padding: 1.5rem;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        margin: 1rem 0;
    }
    .video-info-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 1.5rem;
        border-radius: 10px;
        margin: 1rem 0;
    }
    .progress-container {
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 8px;
        margin: 1rem 0;
    }
    .success-message {
        background: #d4edda;
        color: #155724;
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid #c3e6cb;
    }
    .error-message {
        background: #f8d7da;
        color: #721c24;
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid #f5c6cb;
    }
</style>
""", unsafe_allow_html=True)

# Inicializar estado de la sesión
if 'downloader' not in st.session_state:
    st.session_state.downloader = YouTubeDownloader()
    
if 'video_info' not in st.session_state:
    st.session_state.video_info = None
    
if 'current_url' not in st.session_state:
    st.session_state.current_url = None
    
if 'download_result' not in st.session_state:
    st.session_state.download_result = None
    
if 'downloading' not in st.session_state:
    st.session_state.downloading = False
    
if 'progress' not in st.session_state:
    st.session_state.progress = 0
    
if 'download_status' not in st.session_state:
    st.session_state.download_status = None
    
if 'cleanup_scheduler_started' not in st.session_state:
    st.session_state.cleanup_scheduler_started = False

if 'performance_optimizer_started' not in st.session_state:
    st.session_state.performance_optimizer_started = False

# Inicializar el programador de limpieza automática
if not st.session_state.cleanup_scheduler_started:
    cleanup_scheduler.ensure_temp_dir()
    cleanup_scheduler.start_scheduler()
    st.session_state.cleanup_scheduler_started = True

# Inicializar performance optimizer
if not st.session_state.performance_optimizer_started:
    performance_optimizer.start_optimization()
    st.session_state.performance_optimizer_started = True

def mostrar_header():
    """Muestra el header principal de la aplicación"""
    st.markdown("""
    <div class="main-header">
        <h1>🎬 YouTube Downloader</h1>
        <p>Descarga videos y audio en máxima calidad</p>
    </div>
    """, unsafe_allow_html=True)

def mostrar_caracteristicas():
    """Muestra las características principales"""
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("""
        <div class="feature-card">
            <h4>🎬 Video en Alta Calidad</h4>
            <p>Descarga videos hasta 4K/8K con audio integrado</p>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("""
        <div class="feature-card">
            <h4>🎧 Audio MP3</h4>
            <p>Extrae audio en formato MP3 sin pérdida de calidad</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown("""
        <div class="feature-card">
            <h4>⚡ Fallback Inteligente</h4>
            <p>4K → 1440p → 1080p → 720p automáticamente</p>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("""
        <div class="feature-card">
            <h4>🔧 Optimizado con FFmpeg</h4>
            <p>Mejor calidad y compatibilidad de formatos</p>
        </div>
        """, unsafe_allow_html=True)

def mostrar_formulario_entrada():
    """Muestra el formulario de entrada de URL"""
    st.markdown("### 📎 Ingresa la URL del video")
    
    url = st.text_input(
        "URL del video",
        placeholder="https://www.youtube.com/watch?v=...",
        help="Pega aquí la URL del video de YouTube que quieres descargar"
    )
    
    col1, col2 = st.columns([3, 1])
    
    with col1:
        if st.button("🔍 Obtener información del video", type="primary", use_container_width=True):
            if not url:
                error_handler.display_warning("Por favor ingresa una URL")
                return
            
            if not validar_url(url):
                error_handler.display_error({
                    'error_type': 'url_error',
                    'message': 'URL inválida. Debe comenzar con http:// o https://',
                    'details': {'url': url}
                })
                return
            
            if not es_url_youtube(url):
                error_handler.display_warning(
                    "La URL no parece ser de YouTube. Puede que funcione, pero se recomienda usar URLs de YouTube.",
                    ["Verifica que sea una URL de YouTube válida", "Algunas plataformas pueden tener limitaciones"]
                )
            
            with st.spinner("Obteniendo información del video..."):
                try:
                    video_info = st.session_state.downloader.extraer_info_video(url)
                    
                    if video_info:
                        st.session_state.video_info = video_info
                        st.session_state.current_url = url  # Guardar la URL actual
                        error_handler.display_success(
                            "Información obtenida correctamente",
                            {
                                'Título': video_info.titulo[:50] + '...' if len(video_info.titulo) > 50 else video_info.titulo,
                                'Duración': formatear_duracion(video_info.duracion) if video_info.duracion else 'N/A',
                                'Canal': video_info.canal if video_info.canal else 'N/A'
                            }
                        )
                        st.rerun()
                    else:
                        raise DownloadError("No se pudo obtener información del video. Verifica la URL.")
                except Exception as e:
                    error_info = error_handler.handle_error(e, "extraer_info_video")
                    error_handler.display_error(error_info)
                    st.session_state.video_info = None
                    st.session_state.current_url = None
    
    with col2:
        if st.button("🗑️ Limpiar", use_container_width=True):
            st.session_state.video_info = None
            st.session_state.current_url = None
            st.session_state.download_result = None
            st.session_state.download_status = None
            st.session_state.progress = 0
            st.rerun()

def mostrar_info_video(video_info: VideoInfo):
    """Muestra la información del video"""
    st.markdown("""
    <div class="video-info-card">
        <h3>📺 Información del Video</h3>
    </div>
    """, unsafe_allow_html=True)
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.markdown(f"**📝 Título:** {limpiar_titulo(video_info.titulo)}")
        st.markdown(f"**📺 Canal:** {video_info.canal}")
        st.markdown(f"**⏱️ Duración:** {formatear_duracion(video_info.duracion)}")
        st.markdown(f"**👁️ Vistas:** {video_info.vistas:,}" if video_info.vistas > 0 else "**👁️ Vistas:** No disponible")
        
        if video_info.descripcion:
            with st.expander("📄 Ver descripción"):
                st.text(video_info.descripcion)
    
    with col2:
        if video_info.thumbnail:
            try:
                st.image(video_info.thumbnail, caption="Miniatura del video", use_column_width=True)
            except:
                st.info("Miniatura no disponible")
        
        st.markdown(f"**🎬 Resolución:** {video_info.ancho}x{video_info.altura}")
        st.markdown(f"**🎯 FPS:** {video_info.fps}")
        st.markdown(f"**📁 Formato:** {video_info.formato}")
        
        if video_info.tamaño_estimado > 0:
            st.markdown(f"**💾 Tamaño estimado:** {formatear_tamaño(video_info.tamaño_estimado)}")

def mostrar_opciones_descarga():
    """Muestra las opciones de descarga"""
    st.markdown("### ⚙️ Opciones de Descarga")
    
    col1, col2 = st.columns(2)
    
    with col1:
        tipo_descarga = st.radio(
            "Tipo de descarga",
            ["🎬 Video (con audio)", "🎧 Solo audio (MP3)"],
            help="Selecciona si quieres descargar el video completo o solo el audio"
        )
    
    with col2:
        if "Video" in tipo_descarga:
            calidad = st.selectbox(
                "Calidad de video",
                ["auto", "4k", "1440p", "1080p", "720p"],
                help="Selecciona la calidad deseada. 'auto' selecciona la mejor disponible"
            )
        else:
            calidad = "audio"
            st.info("🎧 El audio se descargará en la mejor calidad disponible")
    
    return tipo_descarga, calidad

@optimize_performance
def realizar_descarga_video():
    """Realiza la descarga de video"""
    if not st.session_state.current_url:
        error_handler.display_error({
            'error_type': 'validation_error',
            'message': 'No hay URL disponible para descargar',
            'details': {'action': 'download_video'}
        })
        return
    
    st.session_state.downloading = True
    st.session_state.progress = 0
    st.session_state.download_status = "Iniciando descarga..."
    
    def progress_callback(d):
        if d['status'] == 'downloading':
            if 'total_bytes' in d and d['total_bytes']:
                progress = (d['downloaded_bytes'] / d['total_bytes']) * 100
                st.session_state.progress = min(progress, 100)
                st.session_state.download_status = f"Descargando... {progress:.1f}%"
            elif '_percent_str' in d:
                percent_str = d['_percent_str'].strip().replace('%', '')
                try:
                    progress = float(percent_str)
                    st.session_state.progress = min(progress, 100)
                    st.session_state.download_status = f"Descargando... {progress:.1f}%"
                except:
                    st.session_state.download_status = "Descargando..."
        elif d['status'] == 'finished':
            st.session_state.progress = 100
            st.session_state.download_status = "Finalizando..."
            if 'filename' in d:
                st.session_state.filename = d['filename']
    
    try:
        resultado = st.session_state.downloader.descargar_video(
            st.session_state.current_url,
            progress_hook=progress_callback
        )
        
        st.session_state.download_result = resultado
        st.session_state.downloading = False
        
        if resultado.exito:
            error_handler.display_success(
                f"Video descargado exitosamente",
                {
                    'Archivo': os.path.basename(resultado.archivo_descargado),
                    'Tamaño': formatear_tamaño(resultado.tamaño_final) if resultado.tamaño_final else 'N/A',
                    'Tiempo': f"{resultado.tiempo_descarga:.1f}s" if resultado.tiempo_descarga else 'N/A',
                    'Calidad': resultado.calidad_final if resultado.calidad_final else 'N/A'
                }
            )
        else:
            raise DownloadError(resultado.mensaje or "Error desconocido durante la descarga")
            
    except Exception as e:
        st.session_state.downloading = False
        error_info = error_handler.handle_error(e, "descargar_video")
        error_handler.display_error(error_info)
        st.session_state.download_result = None

@optimize_performance
def realizar_descarga_audio():
    """Realiza la descarga de audio"""
    if not st.session_state.current_url:
        error_handler.display_error({
            'error_type': 'validation_error',
            'message': 'No hay URL disponible para descargar',
            'details': {'action': 'download_audio'}
        })
        return
    
    st.session_state.downloading = True
    st.session_state.progress = 0
    st.session_state.download_status = "Iniciando descarga de audio..."
    
    def progress_callback(d):
        if d['status'] == 'downloading':
            if 'total_bytes' in d and d['total_bytes']:
                progress = (d['downloaded_bytes'] / d['total_bytes']) * 100
                st.session_state.progress = min(progress, 100)
                st.session_state.download_status = f"Descargando audio... {progress:.1f}%"
            elif '_percent_str' in d:
                percent_str = d['_percent_str'].strip().replace('%', '')
                try:
                    progress = float(percent_str)
                    st.session_state.progress = min(progress, 100)
                    st.session_state.download_status = f"Descargando audio... {progress:.1f}%"
                except:
                    st.session_state.download_status = "Descargando audio..."
        elif d['status'] == 'finished':
            st.session_state.progress = 100
            st.session_state.download_status = "Finalizando..."
            if 'filename' in d:
                st.session_state.filename = d['filename']
    
    try:
        resultado = st.session_state.downloader.descargar_audio(
            st.session_state.current_url,
            progress_hook=progress_callback
        )
        
        st.session_state.download_result = resultado
        st.session_state.downloading = False
        
        if resultado.exito:
            error_handler.display_success(
                f"Audio descargado exitosamente",
                {
                    'Archivo': os.path.basename(resultado.archivo_descargado),
                    'Tamaño': formatear_tamaño(resultado.tamaño_final) if resultado.tamaño_final else 'N/A',
                    'Tiempo': f"{resultado.tiempo_descarga:.1f}s" if resultado.tiempo_descarga else 'N/A',
                    'Formato': 'MP3' if resultado.archivo_descargado.endswith('.mp3') else 'M4A'
                }
            )
        else:
            raise DownloadError(resultado.mensaje or "Error desconocido durante la descarga de audio")
            
    except Exception as e:
        st.session_state.downloading = False
        error_info = error_handler.handle_error(e, "descargar_audio")
        error_handler.display_error(error_info)
        st.session_state.download_result = None

def progress_callback(data):
    """Callback para actualizar el progreso de descarga"""
    if 'progreso' in data:
        st.session_state.progress = data['progreso']
    if 'status' in data:
        st.session_state.download_status = data['status']
    if 'filename' in data:
        st.session_state.current_filename = data['filename']

def mostrar_area_descarga(tipo_descarga: str, calidad: str):
    """Muestra el área de descarga con progreso"""
    st.markdown("### 📥 Descarga")
    
    if st.button("🚀 Iniciar Descarga", type="primary", use_container_width=True, disabled=st.session_state.downloading):
        st.session_state.downloading = True
        st.session_state.progress = 0
        st.session_state.download_result = None
        
        # Configurar callback de progreso
        st.session_state.downloader.set_progress_callback(progress_callback)
        
        # Crear contenedor para el progreso
        progress_container = st.empty()
        status_container = st.empty()
        
        try:
            with status_container.container():
                st.info("🔄 Iniciando descarga...")
            
            # Usar la URL almacenada en el estado de la sesión
            if not st.session_state.current_url:
                st.error("❌ Error: No hay URL disponible. Por favor, obtén la información del video primero.")
                st.session_state.downloading = False
                return
            
            url = st.session_state.current_url
            
            if "Video" in tipo_descarga:
                resultado = st.session_state.downloader.descargar_video(url, calidad)
            else:
                resultado = st.session_state.downloader.descargar_audio(url)
            
            st.session_state.download_result = resultado
            st.session_state.downloading = False
            
            if resultado.exito:
                with status_container.container():
                    st.markdown("""
                    <div class="success-message">
                        <h4>✅ Descarga completada exitosamente</h4>
                        <p><strong>Archivo:</strong> {}</p>
                        <p><strong>Tamaño:</strong> {}</p>
                        <p><strong>Tiempo:</strong> {:.1f} segundos</p>
                        <p><strong>Calidad:</strong> {}</p>
                    </div>
                    """.format(
                        os.path.basename(resultado.archivo_descargado),
                        formatear_tamaño(resultado.tamaño_final),
                        resultado.tiempo_descarga,
                        resultado.calidad_final
                    ), unsafe_allow_html=True)
            else:
                with status_container.container():
                    st.markdown("""
                    <div class="error-message">
                        <h4>❌ Error en la descarga</h4>
                        <p><strong>Mensaje:</strong> {}</p>
                        <p><strong>Error:</strong> {}</p>
                    </div>
                    """.format(
                        resultado.mensaje,
                        resultado.error or "No especificado"
                    ), unsafe_allow_html=True)
                    
        except Exception as e:
            st.session_state.downloading = False
            with status_container.container():
                st.error(f"❌ Error inesperado: {str(e)}")
    
    # Mostrar progreso si está descargando
    if st.session_state.downloading:
        st.markdown("""
        <div class="progress-container">
            <h4>📊 Progreso de descarga</h4>
        </div>
        """, unsafe_allow_html=True)
        
        progress_bar = st.progress(st.session_state.progress / 100)
        st.text(f"Progreso: {st.session_state.progress:.1f}%")

def mostrar_sidebar():
    """Muestra la barra lateral con información del sistema"""
    with st.sidebar:
        st.markdown("### 🔧 Estado del Sistema")
        
        # Estado del programador de limpieza
        if cleanup_scheduler.running:
            st.success("✅ Limpieza automática activa")
        else:
            st.warning("⚠️ Limpieza automática inactiva")
        
        # Estado del optimizador de rendimiento
        if performance_optimizer.optimization_active:
            st.success("✅ Optimización de rendimiento activa")
        else:
            st.warning("⚠️ Optimización de rendimiento inactiva")
        
        # Información del sistema
        system_info = performance_optimizer.get_system_info()
        st.markdown("### 📊 Recursos del Sistema")
        
        col1, col2 = st.columns(2)
        with col1:
            st.metric("CPU", f"{system_info['cpu_percent']:.1f}%")
            st.metric("Memoria", f"{system_info['memory_percent']:.1f}%")
        with col2:
            st.metric("RAM libre", f"{system_info['memory_available_gb']:.1f} GB")
            st.metric("Disco libre", f"{system_info['disk_free_gb']:.1f} GB")
        
        # Botón de optimización manual
        if st.button("🚀 Optimizar rendimiento", help="Liberar memoria y optimizar recursos"):
            try:
                optimization_result = performance_optimizer.optimize_memory()
                if optimization_result['freed_memory_mb'] > 0:
                    error_handler.display_success(
                        "Optimización completada",
                        f"Se liberaron {optimization_result['freed_memory_mb']:.1f} MB de memoria"
                    )
                else:
                    error_handler.display_info("El sistema ya está optimizado")
                st.rerun()
            except Exception as e:
                error_handler.display_error(
                    "Error en optimización",
                    "No se pudo completar la optimización del sistema",
                    ["Intenta cerrar otras aplicaciones", "Reinicia la aplicación si persiste"],
                    str(e)
                )
        
        # Información del directorio temporal
        temp_info = cleanup_scheduler.get_temp_dir_info()
        st.markdown("### 🗂️ Archivos Temporales")
        st.info(f"📁 Archivos: {temp_info['total_files']}")
        st.info(f"💾 Espacio: {temp_info['total_size_formatted']}")
        
        # Botones de limpieza manual
        col1, col2 = st.columns(2)
        
        with col1:
            if st.button("🧹 Limpiar antiguos", help="Eliminar archivos de más de 24 horas"):
                try:
                    stats = cleanup_scheduler.cleanup_old_files()
                    if stats['files_cleaned'] > 0:
                        error_handler.display_success(
                            "Limpieza completada",
                            f"Se eliminaron {stats['files_cleaned']} archivos y se liberaron {formatear_tamaño(stats['size_cleaned'])}"
                        )
                    else:
                        error_handler.display_info("No hay archivos antiguos para limpiar")
                    st.rerun()
                except Exception as e:
                    error_handler.display_error(
                        "Error en limpieza",
                        "No se pudo completar la limpieza de archivos antiguos",
                        ["Verifica los permisos del directorio", "Intenta reiniciar la aplicación"],
                        str(e)
                    )
        
        with col2:
            if st.button("🗑️ Limpiar todo", help="Eliminar todos los archivos temporales"):
                try:
                    stats = cleanup_scheduler.cleanup_all_temp_files()
                    if stats['files_cleaned'] > 0:
                        error_handler.display_success(
                            "Limpieza total completada",
                            f"Se eliminaron {stats['files_cleaned']} archivos y se liberaron {formatear_tamaño(stats['size_cleaned'])}"
                        )
                    else:
                        error_handler.display_info("No hay archivos temporales para limpiar")
                    st.rerun()
                except Exception as e:
                    error_handler.display_error(
                        "Error en limpieza total",
                        "No se pudo completar la limpieza de todos los archivos",
                        ["Verifica los permisos del directorio", "Cierra otros programas que puedan estar usando los archivos"],
                        str(e)
                    )
        
        # Estadísticas de limpieza
        cleanup_stats = cleanup_scheduler.get_cleanup_stats()
        st.markdown("---")
        st.markdown("### 📈 Estadísticas")
        
        # Estadísticas de limpieza
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Archivos limpiados", cleanup_stats['total_files_cleaned'])
        with col2:
            st.metric("Espacio liberado", cleanup_stats['total_size_cleaned_formatted'])
        
        if cleanup_stats['last_cleanup']:
            st.info(f"🕒 Última limpieza: {cleanup_stats['last_cleanup'].strftime('%H:%M:%S')}")
        
        # Estadísticas de rendimiento
        perf_stats = performance_optimizer.get_performance_stats()
        memory_stats = perf_stats['memory_stats']
        
        st.metric("Memoria de la app", f"{memory_stats['current']['rss_mb']:.1f} MB")
        if memory_stats['increase_mb'] > 0:
            st.metric("Incremento de memoria", f"+{memory_stats['increase_mb']:.1f} MB")
        
        st.markdown("---")
        st.markdown("### ℹ️ Información")
        
        # Información sobre formatos soportados
        with st.expander("📹 Formatos soportados"):
            st.write("**Video:** MP4, WEBM, MKV")
            st.write("**Audio:** MP3, M4A, WEBM")
            st.write("**Calidades:** 4K, 1440p, 1080p, 720p, 480p, 360p")
        
        # Información sobre plataformas
        with st.expander("🌐 Plataformas compatibles"):
            st.write("• YouTube")
            st.write("• YouTube Music")
            st.write("• Y muchas más...")
        
        # Características principales
        with st.expander("⭐ Características"):
            st.write("• Descarga de videos hasta 8K")
            st.write("• Extracción de audio MP3")
            st.write("• Descarga con audio integrado")
            st.write("• Limpieza automática cada hora")
            st.write("• Optimización de rendimiento")
            st.write("• Interfaz web intuitiva")
        
        # Consejos de uso
        with st.expander("💡 Consejos"):
            st.write("• Usa URLs completas de YouTube")
            st.write("• Para mejor calidad, elige MP4")
            st.write("• La limpieza automática se ejecuta cada hora")
            st.write("• Los archivos se guardan en 'descargas/'")
            st.write("• Optimiza el rendimiento si el sistema está lento")
            st.write("• Revisa el espacio disponible regularmente")

def main():
    """Función principal de la aplicación"""
    # Header
    mostrar_header()
    
    # Características
    mostrar_caracteristicas()
    
    # Sidebar
    mostrar_sidebar()
    
    # Formulario de entrada
    mostrar_formulario_entrada()
    
    # Si hay información del video, mostrarla
    if st.session_state.video_info:
        mostrar_info_video(st.session_state.video_info)
        
        # Opciones de descarga
        tipo_descarga, calidad = mostrar_opciones_descarga()
        
        # Área de descarga
        mostrar_area_descarga(tipo_descarga, calidad)
    
    # Footer
    st.markdown("---")
    st.markdown("""
    <div style="text-align: center; color: #666; padding: 2rem;">
        <p>🎬 YouTube Downloader - Descarga videos y audio en máxima calidad</p>
        <p>Desarrollado con ❤️ usando Streamlit</p>
    </div>
    """, unsafe_allow_html=True)

if __name__ == "__main__":
    main()