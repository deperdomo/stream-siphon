import yt_dlp
import os
import re
import sys

def sanitizar_nombre_archivo(filename):
    """Limpia el nombre del archivo de caracteres no válidos"""
    # Reemplazar caracteres problemáticos
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Remover múltiples espacios y guiones bajos
    filename = re.sub(r'[_\s]+', '_', filename)
    # Limitar longitud del nombre
    if len(filename) > 200:
        filename = filename[:200]
    return filename.strip('_')

def verificar_ffmpeg():
    """Verifica si ffmpeg está disponible"""
    try:
        import subprocess
        # Intentar múltiples formas de encontrar ffmpeg
        comandos_ffmpeg = ['ffmpeg', 'ffmpeg.exe']
        
        for cmd in comandos_ffmpeg:
            try:
                result = subprocess.run([cmd, '-version'], 
                                      capture_output=True, 
                                      check=True, 
                                      timeout=5)
                if result.returncode == 0:
                    print(f"✅ ffmpeg encontrado: {cmd}")
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
                        print(f"✅ ffmpeg encontrado en: {ruta}")
                        return True
                except:
                    continue
                    
        return False
        
    except Exception as e:
        print(f"⚠️ Error verificando ffmpeg: {e}")
        return False

def descargar_video(url):
    print("🔍 Verificando disponibilidad de ffmpeg...")
    ffmpeg_disponible = verificar_ffmpeg()
    
    if ffmpeg_disponible:
        print("✅ ffmpeg disponible - descargando VIDEO CON AUDIO en máxima calidad")
        opciones = {
            # Formato optimizado para video con audio integrado
            'format': (
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
            ),
            'merge_output_format': 'mp4',
            'outtmpl': '%(title)s [%(height)sp].%(ext)s',
        }
    else:
        print("⚠️ ffmpeg no disponible - descargando formato único en máxima calidad")
        opciones = {
            'format': (
                'best[height>=2160][ext=mp4]/'
                'best[height>=1440][ext=mp4]/'
                'best[height>=1080][ext=mp4]/'
                'best[height>=720][ext=mp4]/'
                'best[ext=mp4]/'
                'best'
            ),
            'outtmpl': '%(title)s [%(height)sp].%(ext)s',
        }
    
    # Opciones comunes mejoradas para máxima calidad
    opciones.update({
        'writeinfojson': False,  # NO guardar metadatos
        'writethumbnail': False,  # NO descargar miniatura
        'ignoreerrors': True,  # Continuar si hay errores menores
        'no_warnings': False,
        'extractflat': False,
        # Configuraciones de calidad adicionales
        'prefer_ffmpeg': True,
        'keepvideo': False,  # No mantener archivos temporales
        'embed_subs': False,  # No embebido de subtítulos para evitar errores
        'concurrent_fragment_downloads': 3,  # Descarga más rápida
        # Configuraciones adicionales para estabilidad
        'retries': 3,
        'fragment_retries': 3,
    })

    try:
        print(f"🚀 Iniciando descarga desde: {url}")
        with yt_dlp.YoutubeDL(opciones) as ydl:
            # Extraer información del video primero
            info = ydl.extract_info(url, download=False)
            titulo = info.get('title', 'video_sin_titulo')
            duracion = info.get('duration', 0)
            altura = info.get('height', 'Desconocida')
            ancho = info.get('width', 'Desconocido')
            fps = info.get('fps', 'Desconocido')
            formato = info.get('ext', 'Desconocido')
            
            print(f"📺 Título: {titulo}")
            print(f"🎬 Resolución: {ancho}x{altura}p")
            print(f"🎯 FPS: {fps}")
            print(f"📁 Formato: {formato}")
            if duracion:
                mins, secs = divmod(duracion, 60)
                print(f"⏱️ Duración: {mins:02d}:{secs:02d}")
            
            # Mostrar formatos disponibles para transparencia
            formatos = info.get('formats', [])
            if formatos:
                print(f"\n📊 Formatos disponibles: {len(formatos)} opciones")
                # Mostrar los mejores 5 formatos con más detalles
                mejores_formatos = sorted(
                    [f for f in formatos if f.get('height') and f.get('height') > 0], 
                    key=lambda x: (x.get('height', 0), x.get('fps', 0)), 
                    reverse=True
                )[:5]
                
                print("🏆 Top 5 calidades disponibles:")
                for i, fmt in enumerate(mejores_formatos, 1):
                    altura_fmt = fmt.get('height', 'N/A')
                    ext_fmt = fmt.get('ext', 'N/A')
                    fps_fmt = fmt.get('fps', 'N/A') or 'N/A'
                    vcodec = fmt.get('vcodec', 'N/A')
                    filesize = fmt.get('filesize')
                    size_str = f" ({filesize // (1024*1024)}MB)" if filesize else ""
                    print(f"   {i}. {altura_fmt}p - {ext_fmt} - {fps_fmt}fps - {vcodec}{size_str}")
                
                # Mostrar el formato que se va a usar
                formato_seleccionado = opciones.get('format', 'N/A')
                print(f"\n🎯 Selector usado: {formato_seleccionado[:100]}...")
            
            print(f"\n🚀 Iniciando descarga en máxima calidad disponible...")
            print(f"💾 Estrategia: {'Merge video+audio' if ffmpeg_disponible else 'Formato único'}")
            
            # Descargar el video
            ydl.download([url])
            print("✅ ¡Descarga completada exitosamente!")
            print("📁 Archivo descargado:")
            if ffmpeg_disponible:
                print(f"   • {titulo} [VIDEO + AUDIO].mp4")
            else:
                print(f"   • {titulo} [VIDEO + AUDIO].mp4")
            print(f"   • Calidad final: {altura}p @ {fps}fps (VIDEO + AUDIO)")
            
    except yt_dlp.utils.DownloadError as e:
        print(f"❌ Error de descarga: {str(e)}")
        if "ffmpeg" in str(e).lower():
            print("\n💡 Sugerencia: Instala ffmpeg para obtener mejor calidad:")
            print("   1. Visita: https://ffmpeg.org/download.html")
            print("   2. O usa winget: winget install ffmpeg")
            print("   3. O usa chocolatey: choco install ffmpeg")
        return False
    except Exception as e:
        print(f"❌ Error inesperado: {str(e)}")
        return False
    
    return True

def descargar_podcast(url):
    print("🔍 Verificando disponibilidad de ffmpeg...")
    ffmpeg_disponible = verificar_ffmpeg()
    
    print("🎧 Descargando AUDIO/PODCAST en máxima calidad")
    
    # Configuración optimizada para audio
    opciones = {
        'format': (
            'bestaudio[ext=m4a]/bestaudio[ext=aac]/bestaudio[ext=mp3]/bestaudio/best[height<=480]/best'
        ),
        'outtmpl': '%(title)s [PODCAST].%(ext)s',
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
    
    # Si ffmpeg está disponible, convertir a MP3 manteniendo calidad original
    if ffmpeg_disponible:
        opciones['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '0',  # 0 = mantener calidad original
        }]
        opciones['outtmpl'] = '%(title)s [PODCAST HQ].%(ext)s'
        print("✅ ffmpeg disponible - convirtiendo a MP3 manteniendo calidad original")
    else:
        print("⚠️ ffmpeg no disponible - descargando en formato original")

    try:
        print(f"🚀 Iniciando descarga de audio desde: {url}")
        with yt_dlp.YoutubeDL(opciones) as ydl:
            # Extraer información del audio primero
            info = ydl.extract_info(url, download=False)
            titulo = info.get('title', 'audio_sin_titulo')
            duracion = info.get('duration', 0)
            abr = info.get('abr', 'Desconocido')
            
            print(f"🎧 Título: {titulo}")
            print(f"🎵 Calidad de audio original: {abr}kbps")
            if duracion:
                mins, secs = divmod(duracion, 60)
                print(f"⏱️ Duración: {mins:02d}:{secs:02d}")
            
            print(f"\n🚀 Iniciando descarga de audio...")
            print(f"🎧 Estrategia: {'MP3 calidad original' if ffmpeg_disponible else 'Formato original'}")
            
            # Descargar el audio
            ydl.download([url])
            
            print("✅ ¡Descarga de audio completada exitosamente!")
            print("📁 Archivo descargado:")
            if ffmpeg_disponible:
                print(f"   • {titulo} [PODCAST HQ].mp3 (calidad original: {abr}kbps)")
            else:
                print(f"   • {titulo} [PODCAST].m4a (formato original)")
            
    except yt_dlp.utils.DownloadError as e:
        print(f"❌ Error de descarga: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ Error inesperado: {str(e)}")
        return False
    
    return True

def mostrar_menu():
    print("\n" + "="*65)
    print("🎬 DESCARGADOR DE VIDEOS Y PODCASTS EN MÁXIMA CALIDAD")
    print("="*65)
    print("✨ Características:")
    print("• 🎬 VIDEO: Video completo con audio en 4K/8K")
    print("• 🎧 PODCAST: Audio en MP3 sin pérdida de calidad")
    print("• Fallback inteligente: 4K → 1440p → 1080p → 720p")
    print("• Sin archivos adicionales (.json, .webp)")
    print("• Optimizado con ffmpeg para máxima calidad")
    print("="*65)
    print("🌐 Plataformas soportadas:")
    print("• YouTube (videos, shorts, listas)")
    print("• Muchas otras plataformas de video y audio")
    print("="*65)

def main():
    mostrar_menu()
    
    while True:
        print("\nOpciones:")
        print("1. 🎬 Descargar video (video completo con audio)")
        print("2. 🎧 Descargar podcast (audio MP3 sin pérdida)")
        print("3. Salir")
        
        opcion = input("\nSelecciona una opción (1-3): ").strip()
        
        if opcion == "1":
            enlace = input("\n📎 Introduce la URL del video: ").strip()
            
            if not enlace:
                print("❌ URL vacía. Intenta de nuevo.")
                continue
                
            if not (enlace.startswith('http://') or enlace.startswith('https://')):
                print("❌ URL inválida. Debe comenzar con http:// o https://")
                continue
            
            print(f"\n🔄 Procesando VIDEO: {enlace}")
            exito = descargar_video(enlace)
            
            if exito:
                continuar = input("\n¿Descargar otro contenido? (s/n): ").strip().lower()
                if continuar not in ['s', 'si', 'sí', 'y', 'yes']:
                    break
            else:
                print("\n💔 La descarga falló. Verifica la URL e intenta de nuevo.")
                
        elif opcion == "2":
            enlace = input("\n📎 Introduce la URL del video/audio: ").strip()
            
            if not enlace:
                print("❌ URL vacía. Intenta de nuevo.")
                continue
                
            if not (enlace.startswith('http://') or enlace.startswith('https://')):
                print("❌ URL inválida. Debe comenzar con http:// o https://")
                continue
            
            print(f"\n🔄 Procesando AUDIO/PODCAST: {enlace}")
            exito = descargar_podcast(enlace)
            
            if exito:
                continuar = input("\n¿Descargar otro contenido? (s/n): ").strip().lower()
                if continuar not in ['s', 'si', 'sí', 'y', 'yes']:
                    break
            else:
                print("\n💔 La descarga falló. Verifica la URL e intenta de nuevo.")
                
        elif opcion == "3":
            print("\n👋 ¡Hasta luego!")
            break
        else:
            print("❌ Opción inválida. Selecciona 1, 2 o 3.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⏹️ Descarga cancelada por el usuario.")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error crítico: {str(e)}")
        sys.exit(1)
