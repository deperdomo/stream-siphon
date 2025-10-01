# 🔍 Guía de Diagnóstico - Railway Deployment

Tu app se desplegó exitosamente pero está dando error 500. Aquí está cómo diagnosticar:

---

## 📊 PASO 1: Ver Logs de Railway

### Opción A: Desde el Dashboard Web

1. Ve a https://railway.app
2. Selecciona tu proyecto
3. Click en **"Deployments"**
4. Click en el deployment activo (verde)
5. Verás los logs en tiempo real

### Opción B: Con Railway CLI

```powershell
# Instalar Railway CLI (si no lo tienes)
npm install -g @railway/cli

# Login
railway login

# Ver logs en tiempo real
railway logs
```

---

## 🔍 PASO 2: Buscar Errores Específicos

En los logs, busca mensajes como:

### Error 1: yt-dlp no funciona
```
Error: spawn yt-dlp ENOENT
yt-dlp: command not found
```

### Error 2: FFmpeg no funciona
```
Error: Cannot find ffmpeg
FFmpeg not installed
```

### Error 3: Paths de Windows (yt-dlp.exe)
```
Error: ENOENT: no such file or directory, open 'yt-dlp.exe'
Cannot execute yt-dlp.exe on Linux
```

### Error 4: Firebase/Firestore
```
Error: Firebase not initialized
Firestore error
```

---

## 🚨 PROBLEMA MÁS PROBABLE

Tu aplicación está intentando usar **`yt-dlp.exe`** (Windows) en lugar de **`yt-dlp`** (Linux).

### Verificar en tu código:

Busca en `src/lib/actions.ts` o archivos similares:

```typescript
// ❌ MALO - Solo funciona en Windows
const ytDlpPath = 'yt-dlp.exe'

// ✅ BUENO - Funciona en ambos
const ytDlpPath = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
```

---

## 🔧 SOLUCIONES RÁPIDAS

### Solución 1: Verificar paths de yt-dlp

Busca en tu código archivos que usen `yt-dlp.exe`:

```powershell
# Buscar archivos que usen yt-dlp.exe
Get-ChildItem -Recurse -Include *.ts,*.tsx,*.js,*.jsx | Select-String "yt-dlp.exe"
```

### Solución 2: Verificar variables de entorno

Railway Dashboard → Tu proyecto → **Variables**

Verifica que no haya variables apuntando a paths de Windows.

---

## 📝 COMANDOS ÚTILES

### Ver logs en tiempo real:
```powershell
railway logs --follow
```

### Ver últimos 100 logs:
```powershell
railway logs --lines 100
```

### Filtrar errores:
```powershell
railway logs | Select-String "error"
railway logs | Select-String "Error:"
railway logs | Select-String "failed"
```

---

## 🎯 PRÓXIMOS PASOS

1. **Revisa los logs de Railway** (lo más importante)
2. **Busca referencias a yt-dlp.exe** en tu código
3. **Verifica que yt-dlp se instaló correctamente** en el container
4. **Comparte los logs** para ayudarte mejor

---

## 📋 INFORMACIÓN PARA COMPARTIR

Si necesitas ayuda adicional, comparte:

1. **Logs de Railway** (últimas 50 líneas cuando falla)
2. **Código de actions.ts** (función que llama a yt-dlp)
3. **URL del error** en Railway

---

## 🔍 COMANDO DE DIAGNÓSTICO RÁPIDO

Ejecuta esto y comparte el resultado:

```powershell
# Ver logs y filtrar errores
railway logs --lines 50 | Select-String "error|Error|failed|spawn|ENOENT"
```

---

## 💡 ERROR COMÚN: Server Components

El error menciona "Server Components render". Esto puede ser porque:

1. **Firestore** no está configurado correctamente en producción
2. **Variables de entorno** faltan
3. **yt-dlp** no se encuentra

**Verifica que tengas configurado en Railway:**
- Cualquier variable de entorno que uses en `.env.local`
- Keys de Firebase si usas Firestore

---

**Siguiente paso:** Ejecuta `railway logs` y comparte los últimos logs cuando intentas analizar un video.
