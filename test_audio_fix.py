#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de prueba para verificar las correcciones de audio contra errores HTTP 403
"""

import os
import sys
import time
from downloader import YouTubeDownloader

def test_audio_download():
    """Prueba la descarga de audio con las nuevas configuraciones"""
    print("=== Prueba de Descarga de Audio - Corrección HTTP 403 ===")
    
    # Crear downloader
    downloader = YouTubeDownloader()
    print(f"✅ Downloader creado exitosamente")
    print(f"✅ FFmpeg disponible: {downloader.ffmpeg_disponible}")
    print(f"📁 Directorio de descarga: {downloader.directorio_descarga}")
    
    # URL de prueba (la misma que causó el problema)
    test_url = "https://www.youtube.com/watch?v=mO5O9ANQNxk&ab_channel=ROCAPROJECT"
    
    print(f"\n🎵 Probando descarga de audio con nueva configuración...")
    print(f"🔗 URL: {test_url}")
    
    try:
        inicio = time.time()
        resultado = downloader.descargar_audio(test_url)
        fin = time.time()
        
        if resultado.exito:
            print(f"✅ Audio descargado exitosamente:")
            print(f"  - Archivo: {os.path.basename(resultado.archivo_descargado)}")
            print(f"  - Tamaño: {resultado.tamaño_final / 1024:.1f} KB")
            print(f"  - Tiempo: {resultado.tiempo_descarga:.1f}s")
            print(f"  - Calidad: {resultado.calidad_final}")
            print(f"  - Mensaje: {resultado.mensaje}")
        else:
            print(f"❌ Error en la descarga:")
            print(f"  - Mensaje: {resultado.mensaje}")
            print(f"  - Error: {resultado.error}")
            print(f"  - Tiempo: {resultado.tiempo_descarga:.1f}s")
            
    except Exception as e:
        print(f"❌ Excepción durante la prueba: {e}")
        import traceback
        traceback.print_exc()
    
    print(f"\n🎉 PRUEBA COMPLETADA")

if __name__ == "__main__":
    test_audio_download()
