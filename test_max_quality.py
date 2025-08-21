#!/usr/bin/env python3
"""
Script de prueba para verificar descarga rápida con máxima calidad
"""

import sys
import os
from downloader import YouTubeDownloader

def test_max_quality_download():
    """Prueba de descarga con máxima calidad"""
    print("=== Prueba de Descarga con Máxima Calidad ===")
    
    try:
        # Crear instancia del downloader
        downloader = YouTubeDownloader()
        print(f"✅ Downloader creado exitosamente")
        print(f"✅ FFmpeg disponible: {downloader.ffmpeg_disponible}")
        
        # URL de prueba (video corto)
        test_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"  # Video de prueba de YouTube
        
        print(f"\n🎬 Probando descarga de video con máxima calidad (4K)...")
        resultado_video = downloader.descargar_video(test_url, calidad='4k')
        
        if resultado_video.exito:
            print(f"✅ Video descargado exitosamente:")
            print(f"  - Archivo: {os.path.basename(resultado_video.archivo_descargado)}")
            print(f"  - Tamaño: {resultado_video.tamaño_final / 1024:.1f} KB")
            print(f"  - Tiempo: {resultado_video.tiempo_descarga:.1f}s")
            print(f"  - Calidad: {resultado_video.calidad_final}")
        else:
            print(f"❌ Error en descarga de video: {resultado_video.mensaje}")
            if resultado_video.error:
                print(f"   Detalles: {resultado_video.error}")
        
        print(f"\n🎵 Probando descarga de audio con máxima calidad...")
        resultado_audio = downloader.descargar_audio(test_url)
        
        if resultado_audio.exito:
            print(f"✅ Audio descargado exitosamente:")
            print(f"  - Archivo: {os.path.basename(resultado_audio.archivo_descargado)}")
            print(f"  - Tamaño: {resultado_audio.tamaño_final / 1024:.1f} KB")
            print(f"  - Tiempo: {resultado_audio.tiempo_descarga:.1f}s")
            print(f"  - Calidad: {resultado_audio.calidad_final}")
        else:
            print(f"❌ Error en descarga de audio: {resultado_audio.mensaje}")
            if resultado_audio.error:
                print(f"   Detalles: {resultado_audio.error}")
        
        return resultado_video.exito and resultado_audio.exito
            
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_max_quality_download()
    print(f"\n{'🎉 PRUEBA EXITOSA' if success else '❌ PRUEBA FALLIDA'}")
    sys.exit(0 if success else 1)
