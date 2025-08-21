#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de prueba para verificar las mejoras de calidad y barra de progreso
"""

import os
import sys
import time
from downloader import YouTubeDownloader

def test_quality_improvements():
    """Prueba las mejoras de calidad en descargas"""
    print("=== Prueba de Mejoras de Calidad ===")
    
    # Crear downloader
    downloader = YouTubeDownloader()
    print(f"✅ Downloader creado exitosamente")
    print(f"✅ FFmpeg disponible: {downloader.ffmpeg_disponible}")
    
    # URL de prueba
    test_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
    
    print(f"\n🎵 Probando descarga de audio con máxima calidad...")
    print(f"🔗 URL: {test_url}")
    
    def progress_callback(d):
        if d.get('status') == 'downloading':
            if 'total_bytes' in d and d['total_bytes']:
                progress = (d['downloaded_bytes'] / d['total_bytes']) * 100
                print(f"\r📥 Progreso: {progress:.1f}% - Velocidad: {d.get('speed', 0)/1024:.1f} KB/s", end='', flush=True)
            elif '_percent_str' in d:
                print(f"\r📥 Progreso: {d['_percent_str']}", end='', flush=True)
        elif d.get('status') == 'finished':
            print(f"\n✅ Descarga completada: {d.get('filename', 'archivo')}")
    
    # Configurar callback de progreso
    downloader.set_progress_callback(progress_callback)
    
    try:
        inicio = time.time()
        resultado = downloader.descargar_audio(test_url)
        fin = time.time()
        
        if resultado.exito:
            print(f"\n✅ Audio descargado exitosamente:")
            print(f"  - Archivo: {os.path.basename(resultado.archivo_descargado)}")
            print(f"  - Tamaño: {resultado.tamaño_final / 1024:.1f} KB")
            print(f"  - Tiempo: {resultado.tiempo_descarga:.1f}s")
            print(f"  - Calidad: {resultado.calidad_final}")
            print(f"  - Mensaje: {resultado.mensaje}")
        else:
            print(f"\n❌ Error en la descarga:")
            print(f"  - Mensaje: {resultado.mensaje}")
            print(f"  - Error: {resultado.error}")
            
        # Ahora probar descarga de video en 4K
        print(f"\n🎬 Probando descarga de video en 4K...")
        resultado_video = downloader.descargar_video(test_url, calidad='4k')
        
        if resultado_video.exito:
            print(f"✅ Video descargado exitosamente:")
            print(f"  - Archivo: {os.path.basename(resultado_video.archivo_descargado)}")
            print(f"  - Tamaño: {resultado_video.tamaño_final / (1024*1024):.1f} MB")
            print(f"  - Tiempo: {resultado_video.tiempo_descarga:.1f}s")
            print(f"  - Calidad: {resultado_video.calidad_final}")
            print(f"  - Mensaje: {resultado_video.mensaje}")
        else:
            print(f"❌ Error en descarga de video:")
            print(f"  - Mensaje: {resultado_video.mensaje}")
            print(f"  - Error: {resultado_video.error}")
            
    except Exception as e:
        print(f"\n❌ Excepción durante la prueba: {e}")
        import traceback
        traceback.print_exc()
    
    print(f"\n🎉 PRUEBA COMPLETADA")

if __name__ == "__main__":
    test_quality_improvements()
