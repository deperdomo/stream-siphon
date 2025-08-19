# cleanup_scheduler.py
# Programador de limpieza automática de archivos temporales

import os
import time
import threading
import shutil
from datetime import datetime, timedelta
from typing import List, Optional
from config import Config
from utils import formatear_tamaño

class CleanupScheduler:
    """Programador para limpieza automática de archivos temporales"""
    
    def __init__(self, temp_dir: str = None, cleanup_interval: int = None):
        self.temp_dir = temp_dir or Config.TEMP_DIR
        self.cleanup_interval = cleanup_interval or Config.CLEANUP_INTERVAL
        self.running = False
        self.cleanup_thread = None
        self.last_cleanup = None
        self.total_cleaned = 0
        self.files_cleaned = 0
        
    def start_scheduler(self):
        """Inicia el programador de limpieza automática"""
        if not self.running:
            self.running = True
            self.cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
            self.cleanup_thread.start()
            print(f"🧹 Programador de limpieza iniciado (intervalo: {self.cleanup_interval}s)")
    
    def stop_scheduler(self):
        """Detiene el programador de limpieza automática"""
        self.running = False
        if self.cleanup_thread and self.cleanup_thread.is_alive():
            self.cleanup_thread.join(timeout=5)
        print("🛑 Programador de limpieza detenido")
    
    def _cleanup_loop(self):
        """Bucle principal del programador de limpieza"""
        while self.running:
            try:
                self.cleanup_old_files()
                time.sleep(self.cleanup_interval)
            except Exception as e:
                print(f"❌ Error en limpieza automática: {e}")
                time.sleep(60)  # Esperar 1 minuto antes de reintentar
    
    def cleanup_old_files(self, max_age_hours: int = 24) -> dict:
        """Limpia archivos temporales antiguos"""
        if not os.path.exists(self.temp_dir):
            return {"files_cleaned": 0, "size_cleaned": 0, "message": "Directorio temporal no existe"}
        
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        files_cleaned = 0
        size_cleaned = 0
        errors = []
        
        try:
            for root, dirs, files in os.walk(self.temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    try:
                        # Verificar edad del archivo
                        file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                        
                        if file_time < cutoff_time:
                            file_size = os.path.getsize(file_path)
                            os.remove(file_path)
                            files_cleaned += 1
                            size_cleaned += file_size
                            
                    except Exception as e:
                        errors.append(f"Error eliminando {file}: {str(e)}")
                
                # Limpiar directorios vacíos
                for dir_name in dirs:
                    dir_path = os.path.join(root, dir_name)
                    try:
                        if not os.listdir(dir_path):  # Directorio vacío
                            os.rmdir(dir_path)
                    except Exception as e:
                        errors.append(f"Error eliminando directorio {dir_name}: {str(e)}")
        
        except Exception as e:
            errors.append(f"Error general en limpieza: {str(e)}")
        
        # Actualizar estadísticas
        self.last_cleanup = datetime.now()
        self.files_cleaned += files_cleaned
        self.total_cleaned += size_cleaned
        
        result = {
            "files_cleaned": files_cleaned,
            "size_cleaned": size_cleaned,
            "errors": errors,
            "message": f"Limpieza completada: {files_cleaned} archivos ({formatear_tamaño(size_cleaned)}) eliminados"
        }
        
        if files_cleaned > 0:
            print(f"🧹 {result['message']}")
        
        return result
    
    def cleanup_all_temp_files(self) -> dict:
        """Limpia todos los archivos temporales (sin importar la edad)"""
        if not os.path.exists(self.temp_dir):
            return {"files_cleaned": 0, "size_cleaned": 0, "message": "Directorio temporal no existe"}
        
        files_cleaned = 0
        size_cleaned = 0
        errors = []
        
        try:
            for root, dirs, files in os.walk(self.temp_dir, topdown=False):
                # Eliminar archivos
                for file in files:
                    file_path = os.path.join(root, file)
                    try:
                        file_size = os.path.getsize(file_path)
                        os.remove(file_path)
                        files_cleaned += 1
                        size_cleaned += file_size
                    except Exception as e:
                        errors.append(f"Error eliminando {file}: {str(e)}")
                
                # Eliminar directorios vacíos
                for dir_name in dirs:
                    dir_path = os.path.join(root, dir_name)
                    try:
                        if not os.listdir(dir_path):  # Directorio vacío
                            os.rmdir(dir_path)
                    except Exception as e:
                        errors.append(f"Error eliminando directorio {dir_name}: {str(e)}")
        
        except Exception as e:
            errors.append(f"Error general en limpieza: {str(e)}")
        
        # Actualizar estadísticas
        self.last_cleanup = datetime.now()
        self.files_cleaned += files_cleaned
        self.total_cleaned += size_cleaned
        
        result = {
            "files_cleaned": files_cleaned,
            "size_cleaned": size_cleaned,
            "errors": errors,
            "message": f"Limpieza total completada: {files_cleaned} archivos ({formatear_tamaño(size_cleaned)}) eliminados"
        }
        
        print(f"🧹 {result['message']}")
        return result
    
    def get_temp_dir_info(self) -> dict:
        """Obtiene información sobre el directorio temporal"""
        if not os.path.exists(self.temp_dir):
            return {
                "exists": False,
                "total_files": 0,
                "total_size": 0,
                "message": "Directorio temporal no existe"
            }
        
        total_files = 0
        total_size = 0
        oldest_file = None
        newest_file = None
        
        try:
            for root, dirs, files in os.walk(self.temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    try:
                        file_size = os.path.getsize(file_path)
                        file_time = os.path.getmtime(file_path)
                        
                        total_files += 1
                        total_size += file_size
                        
                        if oldest_file is None or file_time < oldest_file:
                            oldest_file = file_time
                        
                        if newest_file is None or file_time > newest_file:
                            newest_file = file_time
                            
                    except Exception:
                        continue
        
        except Exception as e:
            return {
                "exists": True,
                "error": str(e),
                "message": f"Error obteniendo información: {str(e)}"
            }
        
        return {
            "exists": True,
            "total_files": total_files,
            "total_size": total_size,
            "total_size_formatted": formatear_tamaño(total_size),
            "oldest_file": datetime.fromtimestamp(oldest_file) if oldest_file else None,
            "newest_file": datetime.fromtimestamp(newest_file) if newest_file else None,
            "message": f"Directorio temporal: {total_files} archivos ({formatear_tamaño(total_size)})"
        }
    
    def get_cleanup_stats(self) -> dict:
        """Obtiene estadísticas de limpieza"""
        return {
            "running": self.running,
            "last_cleanup": self.last_cleanup,
            "total_files_cleaned": self.files_cleaned,
            "total_size_cleaned": self.total_cleaned,
            "total_size_cleaned_formatted": formatear_tamaño(self.total_cleaned),
            "cleanup_interval": self.cleanup_interval,
            "temp_dir": self.temp_dir
        }
    
    def ensure_temp_dir(self):
        """Asegura que el directorio temporal existe"""
        if not os.path.exists(self.temp_dir):
            try:
                os.makedirs(self.temp_dir, exist_ok=True)
                print(f"📁 Directorio temporal creado: {self.temp_dir}")
            except Exception as e:
                print(f"❌ Error creando directorio temporal: {e}")
                raise

# Instancia global del programador de limpieza
cleanup_scheduler = CleanupScheduler()