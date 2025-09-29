# Guía de Migración: @distube/ytdl-core → yt-dlp

## Problema Actual
- @distube/ytdl-core fue archivado (16 ago 2025)
- Errores constantes de parsing watch.html
- YouTube bloquea activamente las descargas

## Solución Recomendada: Migrar a yt-dlp

### 1. Instalar dependencias
```bash
npm uninstall @distube/ytdl-core
npm install yt-dlp-wrap
```

### 2. Descargar binario yt-dlp
```bash
# Windows
npm install -g yt-dlp
# o descargar desde: https://github.com/yt-dlp/yt-dlp/releases/latest
```

### 3. Código de migración

#### Antes (@distube/ytdl-core):
```typescript
import ytdl from '@distube/ytdl-core';

const info = await ytdl.getInfo(videoUrl);
const stream = ytdl(videoUrl, { quality: 'highest' });
```

#### Después (yt-dlp-wrap):
```typescript
import YTDlpWrap from 'yt-dlp-wrap';
const ytDlp = new YTDlpWrap();

// Obtener info
const info = await ytDlp.getVideoInfo(videoUrl);

// Descargar
await ytDlp.downloadFromInfo(info, {
  audioFormat: 'mp3',
  audioQuality: 'best',
  outputPath: './downloads'
});
```

### 4. Ventajas inmediatas
- ✅ Actualizaciones semanales
- ✅ Mejor evasión de bloqueos
- ✅ Soporte para más sitios
- ✅ API similar a ytdl-core

### 5. Timeline de migración
1. **Hoy**: Instalar yt-dlp-wrap
2. **Esta semana**: Migrar funciones de descarga
3. **Próxima semana**: Eliminar ytdl-core completamente

---

## ✅ Migración Completada (26 enero 2025)

### Estado Final
- ✅ Dependencia `@distube/ytdl-core` eliminada completamente  
- ✅ `yt-dlp-wrap` v2.3.12 instalada y configurada
- ✅ `yt-dlp.exe` v2025.09.23 descargado y funcionando
- ✅ Código migrado para usar la nueva estructura de datos de yt-dlp
- ✅ Servidor compilando y ejecutándose correctamente sin errores
- ✅ APIs actualizadas: `/api/download/route.ts`, `/api/health/route.ts`  
- ✅ Server actions actualizadas: `src/lib/actions.ts`
- ✅ Estructura de datos mapeada correctamente (title, id, duration, channel, formats)

### Diferencias Clave en la Estructura de Datos

**ytdl-core (anterior)**:
```javascript
info.videoDetails.title
info.videoDetails.videoId  
info.videoDetails.lengthSeconds
info.videoDetails.ownerChannelName
info.formats
```

**yt-dlp (actual)**:
```javascript
info.title
info.id
info.duration
info.channel || info.uploader
info.formats
```

### Problemas Resueltos
- ✅ Error "Error when parsing watch.html" eliminado
- ✅ Error "Cannot read properties of undefined (reading 'title')" resuelto
- ✅ Errores de timeout reducidos significativamente
- ✅ Mejor detección de formatos de video/audio
- ✅ Soporte para videos de alta resolución mejorado
- ✅ Mapeo correcto de propiedades de yt-dlp vs ytdl-core

**🎉 La aplicación está ahora funcionando correctamente con yt-dlp en http://localhost:9002**