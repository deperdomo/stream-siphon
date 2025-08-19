"""Módulo de optimización de rendimiento para YouTube Downloader"""

import os
import gc
import psutil
import threading
import time
from typing import Dict, Any, Optional, Callable
from functools import wraps, lru_cache
from datetime import datetime, timedelta
import streamlit as st
from config import Config

class MemoryMonitor:
    """Monitor de uso de memoria del sistema"""
    
    def __init__(self):
        self.process = psutil.Process()
        self.initial_memory = self.get_memory_usage()
        self.peak_memory = self.initial_memory
        self.monitoring = False
        self.monitor_thread = None
    
    def get_memory_usage(self) -> Dict[str, float]:
        """Obtiene el uso actual de memoria"""
        memory_info = self.process.memory_info()
        system_memory = psutil.virtual_memory()
        
        return {
            'rss_mb': memory_info.rss / 1024 / 1024,  # Memoria física
            'vms_mb': memory_info.vms / 1024 / 1024,  # Memoria virtual
            'percent': self.process.memory_percent(),  # Porcentaje del sistema
            'system_available_mb': system_memory.available / 1024 / 1024,
            'system_percent': system_memory.percent
        }
    
    def start_monitoring(self, interval: float = 5.0):
        """Inicia el monitoreo continuo de memoria"""
        if self.monitoring:
            return
        
        self.monitoring = True
        self.monitor_thread = threading.Thread(
            target=self._monitor_loop,
            args=(interval,),
            daemon=True
        )
        self.monitor_thread.start()
    
    def stop_monitoring(self):
        """Detiene el monitoreo de memoria"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1.0)
    
    def _monitor_loop(self, interval: float):
        """Loop de monitoreo de memoria"""
        while self.monitoring:
            try:
                current_memory = self.get_memory_usage()
                if current_memory['rss_mb'] > self.peak_memory['rss_mb']:
                    self.peak_memory = current_memory
                
                # Trigger garbage collection if memory usage is high
                if current_memory['percent'] > 80:
                    gc.collect()
                
                time.sleep(interval)
            except Exception:
                break
    
    def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas de memoria"""
        current = self.get_memory_usage()
        return {
            'current': current,
            'initial': self.initial_memory,
            'peak': self.peak_memory,
            'increase_mb': current['rss_mb'] - self.initial_memory['rss_mb']
        }

class CacheManager:
    """Gestor de caché para optimizar rendimiento"""
    
    def __init__(self, max_size: int = 100, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.cache = {}
        self.access_times = {}
        self.creation_times = {}
        self._lock = threading.Lock()
    
    def get(self, key: str) -> Optional[Any]:
        """Obtiene un valor del caché"""
        with self._lock:
            if key not in self.cache:
                return None
            
            # Verificar TTL
            if self._is_expired(key):
                self._remove(key)
                return None
            
            self.access_times[key] = datetime.now()
            return self.cache[key]
    
    def set(self, key: str, value: Any) -> None:
        """Almacena un valor en el caché"""
        with self._lock:
            # Limpiar caché si está lleno
            if len(self.cache) >= self.max_size:
                self._evict_lru()
            
            self.cache[key] = value
            now = datetime.now()
            self.access_times[key] = now
            self.creation_times[key] = now
    
    def clear(self) -> None:
        """Limpia todo el caché"""
        with self._lock:
            self.cache.clear()
            self.access_times.clear()
            self.creation_times.clear()
    
    def _is_expired(self, key: str) -> bool:
        """Verifica si una entrada ha expirado"""
        if key not in self.creation_times:
            return True
        
        age = datetime.now() - self.creation_times[key]
        return age.total_seconds() > self.ttl_seconds
    
    def _evict_lru(self) -> None:
        """Elimina la entrada menos recientemente usada"""
        if not self.access_times:
            return
        
        lru_key = min(self.access_times.keys(), key=lambda k: self.access_times[k])
        self._remove(lru_key)
    
    def _remove(self, key: str) -> None:
        """Elimina una entrada del caché"""
        self.cache.pop(key, None)
        self.access_times.pop(key, None)
        self.creation_times.pop(key, None)
    
    def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas del caché"""
        with self._lock:
            expired_count = sum(1 for key in self.cache.keys() if self._is_expired(key))
            return {
                'size': len(self.cache),
                'max_size': self.max_size,
                'expired_entries': expired_count,
                'hit_ratio': getattr(self, '_hits', 0) / max(getattr(self, '_requests', 1), 1)
            }

def cached_video_info(ttl_seconds: int = 1800):
    """Decorador para cachear información de videos"""
    cache = CacheManager(max_size=50, ttl_seconds=ttl_seconds)
    
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(self, url: str, *args, **kwargs):
            cache_key = f"video_info_{hash(url)}"
            
            # Intentar obtener del caché
            cached_result = cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Ejecutar función y cachear resultado
            result = func(self, url, *args, **kwargs)
            if result:  # Solo cachear resultados exitosos
                cache.set(cache_key, result)
            
            return result
        
        wrapper.cache = cache
        return wrapper
    
    return decorator

class ResourceOptimizer:
    """Optimizador de recursos del sistema"""
    
    def __init__(self):
        self.memory_monitor = MemoryMonitor()
        self.cache_manager = CacheManager()
        self.optimization_active = False
    
    def start_optimization(self):
        """Inicia la optimización de recursos"""
        if self.optimization_active:
            return
        
        self.optimization_active = True
        self.memory_monitor.start_monitoring()
        
        # Configurar garbage collection más agresivo
        gc.set_threshold(700, 10, 10)
    
    def stop_optimization(self):
        """Detiene la optimización de recursos"""
        self.optimization_active = False
        self.memory_monitor.stop_monitoring()
    
    def optimize_memory(self) -> Dict[str, Any]:
        """Optimiza el uso de memoria"""
        initial_memory = self.memory_monitor.get_memory_usage()
        
        # Limpiar caché
        self.cache_manager.clear()
        
        # Forzar garbage collection
        collected = gc.collect()
        
        # Limpiar variables de sesión no utilizadas
        self._cleanup_session_state()
        
        final_memory = self.memory_monitor.get_memory_usage()
        
        return {
            'initial_memory_mb': initial_memory['rss_mb'],
            'final_memory_mb': final_memory['rss_mb'],
            'freed_memory_mb': initial_memory['rss_mb'] - final_memory['rss_mb'],
            'gc_collected': collected
        }
    
    def _cleanup_session_state(self):
        """Limpia variables de sesión no utilizadas"""
        if 'st' not in globals() or not hasattr(st, 'session_state'):
            return
        
        # Lista de variables que se pueden limpiar
        cleanable_vars = [
            'download_result',
            'progress',
            'download_status'
        ]
        
        for var in cleanable_vars:
            if var in st.session_state and not st.session_state.get('downloading', False):
                # Solo limpiar si no hay descarga en progreso
                if var == 'download_result' and st.session_state.get('download_result'):
                    # Mantener solo información básica del último resultado
                    result = st.session_state.download_result
                    if hasattr(result, 'archivo_descargado'):
                        st.session_state[var] = type('Result', (), {
                            'exito': result.exito,
                            'archivo_descargado': os.path.basename(result.archivo_descargado) if result.archivo_descargado else None,
                            'mensaje': result.mensaje
                        })()
    
    def get_system_info(self) -> Dict[str, Any]:
        """Obtiene información del sistema"""
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('.')
        
        return {
            'cpu_percent': cpu_percent,
            'memory_percent': memory.percent,
            'memory_available_gb': memory.available / 1024 / 1024 / 1024,
            'disk_free_gb': disk.free / 1024 / 1024 / 1024,
            'disk_percent': (disk.used / disk.total) * 100
        }
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas de rendimiento"""
        return {
            'memory_stats': self.memory_monitor.get_stats(),
            'cache_stats': self.cache_manager.get_stats(),
            'system_info': self.get_system_info(),
            'optimization_active': self.optimization_active
        }
    
    def should_optimize(self) -> bool:
        """Determina si se debe ejecutar optimización"""
        system_info = self.get_system_info()
        memory_stats = self.memory_monitor.get_stats()
        
        # Optimizar si:
        # - Uso de memoria > 80%
        # - Uso de CPU > 90%
        # - Memoria de la aplicación > 500MB
        return (
            system_info['memory_percent'] > 80 or
            system_info['cpu_percent'] > 90 or
            memory_stats['current']['rss_mb'] > 500
        )
    
    def auto_optimize(self) -> Optional[Dict[str, Any]]:
        """Ejecuta optimización automática si es necesario"""
        if self.should_optimize():
            return self.optimize_memory()
        return None

# Instancia global del optimizador
performance_optimizer = ResourceOptimizer()

# Decorador para funciones que consumen muchos recursos
def optimize_performance(func: Callable) -> Callable:
    """Decorador para optimizar rendimiento de funciones"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        # Ejecutar optimización automática antes de la función
        performance_optimizer.auto_optimize()
        
        try:
            result = func(*args, **kwargs)
            return result
        finally:
            # Limpiar después de la función
            gc.collect()
    
    return wrapper