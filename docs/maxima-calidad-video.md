# Implementación de Descarga en Máxima Calidad

## Problema Identificado

El código anterior descargaba videos usando el selector de formato `bestvideo+bestaudio`, que en YouTube tiene las siguientes limitaciones:

- **Formatos pre-combinados**: YouTube ofrece formatos donde video y audio ya están mezclados, pero estos están limitados a resoluciones como 720p o 1080p máximo.
- **Alta calidad solo en formatos separados**: Las resoluciones más altas (4K, 8K, etc.) solo están disponibles en formatos donde el video NO contiene audio.

### Ejemplo del problema:
```
YouTube ofrece:
- 1080p con audio integrado ✅ (esto es lo que se descargaba antes)
- 4K sin audio ❌ (esto no se podía descargar porque no se procesaba)
- Audio de alta calidad por separado ❌ (esto tampoco se usaba)
```

## Solución Implementada

La nueva implementación sigue este flujo:

### 1. **Descarga Separada de Video y Audio**
```typescript
// Descargar el mejor video (sin audio)
const videoResult = await downloadWithYtDlp(
  youtubeUrl,
  downloadDir,
  'video',
  resolvedVideoQuality  // Puede ser 'best' o una calidad específica como '2160p'
);

// Descargar el mejor audio disponible
const audioResult = await downloadWithYtDlp(
  youtubeUrl,
  downloadDir,
  'audio',
  'best'  // Siempre la mejor calidad de audio
);
```

### 2. **Fusión con FFmpeg**
```typescript
await mergeVideoAndAudio(
  videoResult.filePath,
  audioResult.filePath,
  mergedFilePath
);
```

La función `mergeVideoAndAudio` usa FFmpeg con estas opciones:
- `-c:v copy`: No re-codifica el video (mantiene calidad original)
- `-c:a aac`: Convierte el audio a AAC para compatibilidad
- `-b:a 192k`: Bitrate de audio de alta calidad
- `-shortest`: Termina cuando el stream más corto termine
- `-movflags +faststart`: Optimiza para reproducción mientras se descarga

### 3. **Cambios en yt-dlp**

**Selector de formato para video:**
```typescript
// ANTES:
'bestvideo+bestaudio'  // Limitado a formatos pre-combinados

// AHORA:
'bestvideo'  // Obtiene el mejor video disponible (puede ser 4K, 8K, etc.)
```

**Flags adicionales:**
- `--no-post-overwrites`: Previene sobrescritura de archivos
- `--no-merge-output-format`: Evita que yt-dlp intente combinar automáticamente

## Beneficios

1. **Máxima Calidad**: Ahora se pueden descargar videos en 4K, 8K o la máxima resolución disponible
2. **Mejor Audio**: Siempre se usa el audio de mejor calidad disponible
3. **Compatibilidad**: El archivo final está en MP4, compatible con todos los reproductores
4. **Optimización**: No se re-codifica el video, solo se empaqueta con el audio

## Flujo de Progreso

El usuario ve estos pasos:
1. "Descargando video en máxima calidad..." (30-60%)
2. "Descargando audio en máxima calidad..." (60-75%)
3. "Combinando video y audio para máxima calidad..." (75-95%)
4. "Preparando descarga..." (95-100%)

## Archivos Modificados

- `src/app/api/download/route.ts`:
  - Nueva función `mergeVideoAndAudio()` para fusión con FFmpeg
  - Modificado `downloadWithYtDlp()` para descargar video sin audio
  - Actualizado `handleSingleDownload()` para implementar el nuevo flujo
  - Cambiado selector de formato de `bestvideo+bestaudio` a `bestvideo`

## Dependencias Requeridas

- **yt-dlp**: Ya está incluido (yt-dlp.exe)
- **FFmpeg**: Debe estar instalado en el sistema o incluido en el proyecto
  - Usado por el paquete `fluent-ffmpeg`
  - Necesario para combinar video y audio sin pérdida de calidad

## Pruebas Recomendadas

1. Descargar un video 4K de YouTube
2. Verificar que la calidad sea superior a las descargas anteriores
3. Comprobar que el audio tenga alta calidad
4. Verificar compatibilidad del archivo MP4 resultante

## Notas Técnicas

- El proceso tarda más tiempo porque descarga dos archivos y los combina
- El uso de disco temporal es mayor (video + audio + archivo combinado)
- Los archivos temporales se limpian automáticamente después de la descarga
- La combinación no degrada la calidad porque usa `-c:v copy`
