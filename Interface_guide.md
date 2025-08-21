# YouTube Downloader - Web Interface

## Descripción del Proyecto

Convertir un script de consola para descarga de videos y audios de YouTube en una aplicación web intuitiva usando **Streamlit**. El script actual permite descargar videos en máxima calidad (hasta 4K/8K) con audio o extraer solo el audio como MP3.

## Análisis del Script Actual

### Funcionalidades Principales
- **Descarga de videos**: Video completo con audio integrado en máxima calidad disponible
- **Descarga de podcasts/audio**: Extracción de audio en formato MP3 sin pérdida de calidad
- **Verificación de ffmpeg**: Detección automática para optimizar descargas
- **Fallback inteligente**: 4K → 1440p → 1080p → 720p → mejor disponible
- **Sanitización de nombres**: Limpieza automática de caracteres especiales
- **Información detallada**: Muestra metadatos del video antes de descargar

### Dependencias Identificadas
- `yt_dlp`: Biblioteca principal para descarga
- `ffmpeg`: Herramienta externa para procesamiento de video/audio (opcional pero recomendada)
- `re`, `os`, `sys`, `subprocess`: Bibliotecas estándar de Python

## Estructura de Archivos Propuesta

```
youtube-downloader-web/
│
├── app.py                 # Aplicación principal Streamlit
├── downloader.py          # Lógica de descarga (refactorizada del script original)
├── requirements.txt       # Dependencias Python
├── config.py             # Configuraciones y constantes
├── utils.py              # Utilidades auxiliares (sanitización, verificaciones)
├── README.md             # Este archivo
├── .gitignore            # Archivos a ignorar en Git
├── .streamlit/
│   └── config.toml       # Configuración de Streamlit
└── assets/               # Recursos estáticos (opcional)
    └── logo.png          # Logo de la aplicación
```

## Especificaciones Técnicas

### Tecnología Principal
- **Framework**: Streamlit
- **Backend**: Python 3.8+
- **Biblioteca de descarga**: yt-dlp
- **Procesamiento**: ffmpeg (opcional)

### Funcionalidades de la Interfaz Web

#### Página Principal
- **Campo de URL**: Input text para la URL del video/audio
- **Selector de formato**: Radio buttons o selectbox
  - 🎬 Video (MP4 con audio)
  - 🎧 Audio/Podcast (MP3)
- **Opciones avanzadas** (colapsable):
  - Calidad preferida (4K, 1440p, 1080p, 720p, Auto)
  - Mostrar información del video antes de descargar
- **Botón de descarga**: Iniciar proceso
- **Área de estado**: Mostrar progreso y información en tiempo real

#### Información del Video
- Título, duración, resolución
- Formatos disponibles
- Tamaño estimado del archivo
- Vista previa de thumbnail (opcional)

#### Área de Descarga
- Barra de progreso
- Estado actual del proceso
- Botón de descarga del archivo resultante
- Opción para descargar otro video

### Consideraciones Técnicas

#### Manejo de Archivos
- **Descarga temporal**: Usar `tempfile` para almacenamiento temporal en servidor
- **Limpieza automática**: Eliminar archivos después de 1 hora o al cerrar sesión
- **Límite de tamaño**: Establecer límite máximo de descarga (ej: 500MB)

#### Estado y Progreso
- **Progress bar**: Usar `st.progress()` para mostrar avance
- **Status updates**: `st.empty()` para actualizaciones dinámicas
- **Logs en tiempo real**: `st.text_area()` expandible con logs del proceso

#### Validación
- **URL validation**: Verificar formato de URL antes de procesar
- **Disponibilidad**: Comprobar que el video existe y es accesible
- **Rate limiting**: Evitar abuso con límites de uso

## Tareas de Desarrollo

### Fase 1: Refactorización del Script
1. **Separar lógica en módulos**:
   - `downloader.py`: Funciones principales de descarga
   - `utils.py`: Utilidades (sanitización, verificación ffmpeg)
   - `config.py`: Configuraciones y constantes

2. **Adaptar para web**:
   - Modificar funciones para retornar resultados en lugar de imprimir
   - Implementar callbacks para progreso
   - Manejo de archivos temporales

### Fase 2: Desarrollo de la Interfaz
1. **Layout principal**:
   - Header con título y descripción
   - Sidebar con opciones avanzadas
   - Main area con formulario y resultados

2. **Componentes interactivos**:
   - Input validation en tiempo real
   - Preview de información del video
   - Progress tracking durante descarga

3. **Manejo de estados**:
   - Session state para datos temporales
   - Cache para información de videos
   - Cleanup de archivos temporales

### Fase 3: Optimización y Despliegue
1. **Performance**:
   - Async operations para UI responsiva
   - Optimización de memoria
   - Manejo eficiente de archivos grandes

2. **UX/UI**:
   - Mensajes de error informativos
   - Loading states apropiados
   - Responsive design

3. **Despliegue**:
   - Configuración para Streamlit Cloud
   - Variables de entorno para configuraciones
   - Health checks y monitoring

## Archivos de Configuración Necesarios

### requirements.txt
```
streamlit>=1.28.0
yt-dlp>=2023.7.6
```

### .streamlit/config.toml
```toml
[server]
maxUploadSize = 500
maxMessageSize = 500
enableCORS = false

[theme]
primaryColor = "#ff6b6b"
backgroundColor = "#ffffff"
secondaryBackgroundColor = "#f0f2f6"
textColor = "#262730"
```

### .gitignore
```
__pycache__/
*.pyc
*.pyo
downloads/
temp/
.env
*.log
```

## Instrucciones de Implementación

### Para el Agente IA

1. **Comenzar con la refactorización**:
   - Extraer las funciones principales del script en módulos separados
   - Mantener la lógica intacta pero adaptarla para uso programático
   - Implementar logging apropiado

2. **Crear la interfaz básica**:
   - Usar `st.text_input()` para URL
   - `st.radio()` o `st.selectbox()` para formato
   - `st.button()` para iniciar descarga

3. **Implementar descarga y preview**:
   - Mostrar información del video antes de descargar
   - Usar `st.download_button()` para entregar el archivo al usuario
   - Manejar errores gracefully con `st.error()`

4. **Agregar características avanzadas**:
   - Progress bar con `st.progress()`
   - Logs en tiempo real
   - Opciones de calidad

5. **Testing y refinamiento**:
   - Probar con diferentes tipos de URLs
   - Validar límites de tamaño y tiempo
   - Optimizar UX

### Consideraciones Importantes
- **No usar localStorage**: Streamlit maneja el estado automáticamente
- **Cleanup temporal**: Implementar limpieza de archivos descargados
- **Error handling**: Manejar todos los casos de error posibles
- **User feedback**: Mantener al usuario informado en todo momento

## Resultado Esperado

Una aplicación web limpia e intuitiva que:
- Permita descargar videos y audios de YouTube fácilmente
- Mantenga todas las funcionalidades del script original
- Proporcione una experiencia de usuario superior
- Sea desplegable en plataformas cloud como Streamlit Cloud
- Maneje errores gracefully y proporcione feedback claro

---

**Nota para el agente**: Este README proporciona una hoja de ruta completa. Comenzar con una implementación básica y luego iterar añadiendo características avanzadas.

# Arranque de la Aplicación
`python -m streamlit run app.py`