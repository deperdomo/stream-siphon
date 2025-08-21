# app.py
# Aplicación web principal con Streamlit

import streamlit as st
import os
import time
import threading
import logging
from typing import Optional
from downloader import YouTubeDownloader, VideoInfo, DownloadResult
from utils import (
    validar_url, es_url_youtube, formatear_duracion, 
    formatear_tamaño, limpiar_titulo
)
from error_handler import ErrorHandler, error_handler, DownloadError

# Suprimir warnings de Streamlit ScriptRunContext
logging.getLogger("streamlit.runtime.scriptrunner_utils.script_run_context").setLevel(logging.ERROR)
logging.getLogger("streamlit.runtime.scriptrunner.script_run_context").setLevel(logging.ERROR)

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
    
    /* Estilos para barra de progreso personalizada */
    .custom-progress-container {
        background: #f0f2f6;
        border-radius: 10px;
        padding: 1.5rem;
        margin: 1rem 0;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        border: 1px solid #e0e6ed;
    }
    
    .custom-progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }
    
    .custom-progress-title {
        font-weight: 600;
        color: #2c3e50;
        font-size: 1.1rem;
    }
    
    .custom-progress-percentage {
        font-weight: 700;
        color: #4ecdc4;
        font-size: 1.2rem;
    }
    
    .custom-progress-bar {
        width: 100%;
        height: 12px;
        background-color: #e9ecef;
        border-radius: 6px;
        overflow: hidden;
        margin-bottom: 0.5rem;
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
    }
    
    .custom-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #4ecdc4, #44e08e);
        border-radius: 6px;
        transition: width 0.3s ease-in-out;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    
    .custom-progress-info {
        display: flex;
        justify-content: space-between;
        color: #6c757d;
        font-size: 0.9rem;
        margin-top: 0.5rem;
    }
    
    .spinner-container {
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 1rem 0;
    }
    
    .custom-spinner {
        border: 3px solid #f3f3f3;
        border-top: 3px solid #4ecdc4;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin-right: 1rem;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
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
    
if 'download_speed' not in st.session_state:
    st.session_state.download_speed = 0
    
if 'download_eta' not in st.session_state:
    st.session_state.download_eta = 0

def mostrar_barra_progreso(progreso, titulo="Descargando", velocidad=0, eta=0):
    """Muestra una barra de progreso personalizada"""
    velocidad_str = ""
    eta_str = ""
    
    if velocidad > 0:
        if velocidad > 1024 * 1024:  # MB/s
            velocidad_str = f"{velocidad / (1024 * 1024):.1f} MB/s"
        elif velocidad > 1024:  # KB/s
            velocidad_str = f"{velocidad / 1024:.1f} KB/s"
        else:  # B/s
            velocidad_str = f"{velocidad:.0f} B/s"
    
    if eta > 0:
        if eta > 3600:  # horas
            horas = int(eta // 3600)
            minutos = int((eta % 3600) // 60)
            eta_str = f"{horas}h {minutos}m"
        elif eta > 60:  # minutos
            minutos = int(eta // 60)
            segundos = int(eta % 60)
            eta_str = f"{minutos}m {segundos}s"
        else:  # segundos
            eta_str = f"{eta:.0f}s"
    
    progreso_clamped = max(0, min(100, progreso))
    
    st.markdown(f"""
    <div class="custom-progress-container">
        <div class="custom-progress-header">
            <span class="custom-progress-title">{titulo}</span>
            <span class="custom-progress-percentage">{progreso_clamped:.1f}%</span>
        </div>
        <div class="custom-progress-bar">
            <div class="custom-progress-fill" style="width: {progreso_clamped}%"></div>
        </div>
        <div class="custom-progress-info">
            <span>{velocidad_str if velocidad_str else 'Calculando velocidad...'}</span>
            <span>{'ETA: ' + eta_str if eta_str else 'Calculando tiempo...'}</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

def mostrar_spinner_descarga(mensaje="Procesando..."):
    """Muestra un spinner de carga personalizado"""
    st.markdown(f"""
    <div class="spinner-container">
        <div class="custom-spinner"></div>
        <span style="font-size: 1.1rem; color: #4ecdc4; font-weight: 600;">{mensaje}</span>
    </div>
    """, unsafe_allow_html=True)
    


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
        # Selectbox para elegir tipo de descarga rápida
        tipo_descarga_rapida = st.selectbox(
            "Tipo de Descarga Rápida",
            ["Video (Máxima Calidad)", "Audio (Máxima Calidad)"],
            help="Selecciona el tipo de descarga rápida con máxima calidad",
            key="tipo_descarga_rapida"
        )
        
        if st.button("📥 Descarga Rápida", use_container_width=True, help="Descargar directamente con máxima calidad disponible"):
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
            
            # Configurar la URL actual y tipo de descarga
            st.session_state.current_url = url
            st.session_state.downloading = True
            st.session_state.progress = 0
            st.session_state.download_status = "Iniciando descarga rápida..."
            
            def progress_callback(d):
                try:
                    status = d.get('status', '')
                    if status == 'downloading':
                        # Actualizar velocidad y ETA
                        st.session_state.download_speed = d.get('speed', 0) or 0
                        st.session_state.download_eta = d.get('eta', 0) or 0
                        
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
                        else:
                            st.session_state.download_status = "Descargando..."
                    elif status == 'finished':
                        st.session_state.progress = 100
                        st.session_state.download_status = "Finalizando..."
                        st.session_state.download_speed = 0
                        st.session_state.download_eta = 0
                        if 'filename' in d:
                            st.session_state.filename = d['filename']
                except Exception as e:
                    # Evitar que errores en el callback interrumpan la descarga
                    pass
            
            # Determinar el tipo de descarga
            es_video = "Video" in tipo_descarga_rapida
            tipo_display = "video con máxima calidad" if es_video else "audio con máxima calidad"
            
            # Mostrar barra de progreso si está descargando
            if st.session_state.downloading:
                if st.session_state.progress > 0:
                    mostrar_barra_progreso(
                        st.session_state.progress, 
                        f"Descargando {tipo_display}",
                        st.session_state.download_speed,
                        st.session_state.download_eta
                    )
                else:
                    mostrar_spinner_descarga(f"Iniciando descarga de {tipo_display}...")
            
            try:
                # Configurar el callback de progreso
                st.session_state.downloader.set_progress_callback(progress_callback)
                
                if es_video:
                    # Descarga de video con máxima calidad (4K si está disponible)
                    resultado = st.session_state.downloader.descargar_video(url, calidad='4k')
                else:
                    # Descarga de audio con máxima calidad
                    resultado = st.session_state.downloader.descargar_audio(url)
                
                st.session_state.download_result = resultado
                st.session_state.downloading = False
                
                if resultado.exito:
                    tipo_final = "Video" if es_video else "Audio"
                    error_handler.display_success(
                        f"{tipo_final} descargado exitosamente con máxima calidad",
                        {
                            'Archivo': os.path.basename(resultado.archivo_descargado),
                            'Tamaño': formatear_tamaño(resultado.tamaño_final) if resultado.tamaño_final else 'N/A',
                            'Tiempo': f"{resultado.tiempo_descarga:.1f}s" if resultado.tiempo_descarga else 'N/A',
                            'Calidad': resultado.calidad_final if resultado.calidad_final else 'N/A'
                        }
                    )
                    # Limpiar estado de progreso
                    st.session_state.progress = 0
                    st.session_state.download_speed = 0
                    st.session_state.download_eta = 0
                    st.rerun()
                else:
                    raise DownloadError(resultado.mensaje or "Error desconocido durante la descarga")
                    
            except Exception as e:
                st.session_state.downloading = False
                # Limpiar estado de progreso en caso de error
                st.session_state.progress = 0
                st.session_state.download_speed = 0
                st.session_state.download_eta = 0
                error_info = error_handler.handle_error(e, "descarga_rapida")
                error_handler.display_error(error_info)
                st.session_state.download_result = None

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
                st.image(video_info.thumbnail, caption="Miniatura del video", use_container_width=True)
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
        try:
            status = d.get('status', '')
            if status == 'downloading':
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
                else:
                    st.session_state.download_status = "Descargando..."
            elif status == 'finished':
                st.session_state.progress = 100
                st.session_state.download_status = "Finalizando..."
                if 'filename' in d:
                    st.session_state.filename = d['filename']
        except Exception as e:
            # Evitar que errores en el callback interrumpan la descarga
            pass
    
    try:
        # Configurar el callback de progreso
        st.session_state.downloader.set_progress_callback(progress_callback)
        
        resultado = st.session_state.downloader.descargar_video(
            st.session_state.current_url
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
        try:
            status = d.get('status', '')
            if status == 'downloading':
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
                else:
                    st.session_state.download_status = "Descargando audio..."
            elif status == 'finished':
                st.session_state.progress = 100
                st.session_state.download_status = "Finalizando..."
                if 'filename' in d:
                    st.session_state.filename = d['filename']
        except Exception as e:
            # Evitar que errores en el callback interrumpan la descarga
            pass
    
    try:
        # Configurar el callback de progreso
        st.session_state.downloader.set_progress_callback(progress_callback)
        
        resultado = st.session_state.downloader.descargar_audio(
            st.session_state.current_url
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



def main():
    """Función principal de la aplicación"""
    # Header
    mostrar_header()
    
    # Características
    mostrar_caracteristicas()
    
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