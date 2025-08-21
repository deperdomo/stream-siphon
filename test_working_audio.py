#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de prueba para verificar las correcciones con una URL que funcione
"""

import os
import sys
import time
from downloader import YouTubeDownloader

def test_working_url():
    """Prueba la descarga de audio con una URL que sabemos que funciona"""
    print("=== Prueba de Descarga de Audio - URL Funcional ===")
    
    # Crear downloader
    downloader = YouTubeDownloader()
    print(f"✅ Downloader creado exitosamente")
    print(f"✅ FFmpeg disponible: {downloader.ffmpeg_disponible}")
    
    # URL de prueba conocida (video corto de YouTube)
    test_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"  # "Me at the zoo" - primer video de YouTube
    
    print(f"\n🎵 Probando descarga de audio...")
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
            
        # Ahora probar con un video más reciente
        print(f"\n🎵 Probando con video más reciente...")
        test_url2 = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"  # Rick Roll - video popular
        print(f"🔗 URL: {test_url2}")
        
        resultado2 = downloader.descargar_audio(test_url2)
        
        if resultado2.exito:
            print(f"✅ Segundo audio descargado exitosamente:")
            print(f"  - Archivo: {os.path.basename(resultado2.archivo_descargado)}")
            print(f"  - Tamaño: {resultado2.tamaño_final / 1024:.1f} KB")
            print(f"  - Tiempo: {resultado2.tiempo_descarga:.1f}s")
            print(f"  - Calidad: {resultado2.calidad_final}")
            print(f"  - Mensaje: {resultado2.mensaje}")
        else:
            print(f"❌ Error en la segunda descarga:")
            print(f"  - Mensaje: {resultado2.mensaje}")
            print(f"  - Error: {resultado2.error}")
            
    except Exception as e:
        print(f"❌ Excepción durante la prueba: {e}")
        import traceback
        traceback.print_exc()
    
    print(f"\n🎉 PRUEBA COMPLETADA")

if __name__ == "__main__":
    test_working_url()
