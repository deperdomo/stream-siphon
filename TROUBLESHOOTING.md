# 🔧 Troubleshooting Railway Deployment

Guía de solución de problemas comunes durante el despliegue en Railway.

---

## 🔴 Error: Build Failed

### Síntomas
```
Building...
npm ERR! code ELIFECYCLE
Build failed with exit code 1
```

### Soluciones

#### 1. Verificar que build funciona localmente
```powershell
npm run build
```

Si falla localmente, corrige los errores antes de desplegar.

#### 2. Verificar dependencias
```powershell
# Eliminar node_modules y reinstalar
rm -rf node_modules
rm package-lock.json
npm install
npm run build
```

#### 3. Verificar TypeScript
```powershell
npm run typecheck
```

#### 4. Revisar logs detallados en Railway
- Ve a **Deployments** → Click en el deployment fallido
- Busca la línea exacta del error
- Corrige el error en tu código local
- Haz push de nuevo

---

## 🔴 Error: Application Not Responding

### Síntomas
```
502 Bad Gateway
Application failed to respond
```

### Soluciones

#### 1. Verificar que el puerto está correcto

Asegúrate de que `server.js` usa `process.env.PORT`:

```javascript
const port = process.env.PORT || 3000
```

#### 2. Verificar que escucha en 0.0.0.0

```javascript
const hostname = '0.0.0.0'  // NO usar 'localhost'
```

#### 3. Verificar logs de Railway

```
Railway Dashboard → Deployments → View Logs
```

Busca mensajes como:
- "Server listening on..."
- Errores de puerto
- Excepciones no capturadas

#### 4. Healthcheck endpoint

Agrega en tu app:

```javascript
// En server.js o en una API route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() })
})
```

---

## 🔴 Error: yt-dlp not found

### Síntomas
```
Error: spawn yt-dlp ENOENT
yt-dlp: command not found
```

### Soluciones

#### 1. Verificar Dockerfile

Asegúrate de que el `Dockerfile` tiene:

```dockerfile
RUN apk add --no-cache \
    python3 \
    py3-pip \
    && pip3 install --no-cache-dir yt-dlp
```

#### 2. Reconstruir desde cero

En Railway:
1. Ve a **Settings**
2. Scroll hasta **Danger Zone**
3. Click en **Restart Build**
4. O elimina el deployment y crea uno nuevo

#### 3. Verificar que yt-dlp se instaló

Agrega logging temporal en tu API:

```javascript
const { execSync } = require('child_process');

try {
  const ytdlpVersion = execSync('yt-dlp --version', { encoding: 'utf-8' });
  console.log('✅ yt-dlp version:', ytdlpVersion);
} catch (error) {
  console.error('❌ yt-dlp not found:', error);
}
```

---

## 🔴 Error: FFmpeg not found

### Síntomas
```
Error: Cannot find ffmpeg
FFmpeg not installed
```

### Soluciones

#### 1. Verificar Dockerfile

```dockerfile
RUN apk add --no-cache ffmpeg
```

#### 2. Verificar instalación

Agrega en tu código:

```javascript
const ffmpegPath = require('fluent-ffmpeg');
ffmpegPath.setFfmpegPath('/usr/bin/ffmpeg');
ffmpegPath.setFfprobePath('/usr/bin/ffprobe');

console.log('FFmpeg path:', '/usr/bin/ffmpeg');
```

---

## 🔴 Error: Out of Memory

### Síntomas
```
Process killed
OOMKilled
Container exceeded memory limit
```

### Causas
- Videos muy grandes
- Múltiples descargas simultáneas
- Falta de limpieza de archivos temporales

### Soluciones

#### 1. Limpiar archivos temporales agresivamente

En tu código, después de cada descarga:

```javascript
// Limpiar inmediatamente después de enviar el archivo
try {
  fs.unlinkSync(tempFilePath);
  fs.rmdirSync(tempDir, { recursive: true });
} catch (err) {
  console.error('Error cleaning up:', err);
}
```

#### 2. Limitar tamaño de video

```javascript
// En tu API, antes de descargar
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

const videoInfo = await getVideoInfo(url);
if (videoInfo.filesize > MAX_VIDEO_SIZE) {
  throw new Error('Video demasiado grande');
}
```

#### 3. Actualizar a plan con más RAM

Railway Hobby plan: $5/mes
- Más RAM
- Mejor para videos grandes

---

## 🔴 Error: Deployment Timeout

### Síntomas
```
Build timeout after 10 minutes
Deployment cancelled due to timeout
```

### Soluciones

#### 1. Optimizar Dockerfile

```dockerfile
# Usar caché de npm
COPY package*.json ./
RUN npm ci --only=production

# DESPUÉS copiar el resto
COPY . .
RUN npm run build
```

#### 2. Verificar .dockerignore

Asegúrate de ignorar:
```
node_modules
.next
.git
```

#### 3. Build localmente primero

```powershell
# Asegúrate de que .next/ existe antes de hacer push
npm run build
git add .next/
git commit -m "Add build"
git push
```

---

## 🔴 Error: GitHub Connection Failed

### Síntomas
```
Failed to clone repository
Authentication failed
```

### Soluciones

#### 1. Reconectar GitHub

1. Ve a Railway Dashboard
2. **Settings** → **GitHub**
3. Click **Reconnect GitHub**
4. Autoriza de nuevo

#### 2. Verificar permisos del repo

1. Ve a GitHub
2. **Settings** → **Applications** → **Railway**
3. Verifica que Railway tiene acceso al repo

#### 3. Repo privado

Si el repo es privado, asegúrate de que Railway tiene permiso para leerlo.

---

## 🔴 Error: Environment Variables Missing

### Síntomas
```
undefined is not a function
Cannot read property 'X' of undefined
```

### Soluciones

#### 1. Configurar variables en Railway

1. Railway Dashboard
2. Tu proyecto
3. **Variables** tab
4. Click **New Variable**
5. Agrega todas las necesarias

#### 2. Usar valores por defecto

```javascript
const API_KEY = process.env.API_KEY || 'default-value';
```

---

## 🔴 Error: Domain Generation Failed

### Síntomas
```
Failed to generate domain
Domain already in use
```

### Soluciones

#### 1. Generar manualmente

1. **Settings** → **Domains**
2. Click **Generate Domain**
3. Si falla, intenta de nuevo en 5 minutos

#### 2. Usar dominio personalizado

1. **Settings** → **Domains**
2. **Custom Domain**
3. Agrega: `tu-app.tudominio.com`
4. Configura DNS según instrucciones

---

## 🔴 Error: Download Fails (403/429)

### Síntomas
```
HTTP 403 Forbidden
HTTP 429 Too Many Requests
YouTube blocking requests
```

### Causas
- YouTube detecta muchas descargas
- IP de Railway bloqueada temporalmente

### Soluciones

#### 1. Implementar rate limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10 // 10 requests por IP
});

app.use('/api/download', limiter);
```

#### 2. Usar diferentes player clients

En tu código yt-dlp, rotar entre:
```javascript
const clients = ['android_vr', 'android', 'ios'];
const randomClient = clients[Math.floor(Math.random() * clients.length)];
```

#### 3. Esperar entre descargas

```javascript
// Añadir delay entre requests
await new Promise(resolve => setTimeout(resolve, 2000));
```

---

## 📊 Verificar Estado del Deploy

### Comando para verificar todo está ok:

```powershell
npm run check-railway
```

Este script verificará:
- ✅ Archivos necesarios
- ✅ Configuración correcta
- ✅ Build funcional
- ✅ Git configurado

---

## 🆘 Obtener Ayuda

### 1. Logs de Railway
```
Railway Dashboard → Deployments → View Logs
```

### 2. Railway CLI
```powershell
railway login
railway logs
```

### 3. Documentación
- [Railway Docs](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)

### 4. Recrear deployment desde cero
```
Settings → Danger Zone → Delete Service
Luego crear nuevo proyecto
```

---

## ✅ Checklist de Debugging

Antes de pedir ayuda, verifica:

- [ ] Build funciona localmente (`npm run build`)
- [ ] Código en GitHub está actualizado
- [ ] Dockerfile tiene todas las dependencias
- [ ] Logs de Railway revisados
- [ ] Variables de entorno configuradas
- [ ] Puerto configurado correctamente (process.env.PORT)
- [ ] Hostname es 0.0.0.0 no localhost

---

## 🔄 Último Recurso: Deploy Limpio

Si nada funciona:

```powershell
# 1. Eliminar deployment en Railway
# 2. Limpiar local
rm -rf node_modules .next
npm install
npm run build

# 3. Commit limpio
git add .
git commit -m "Clean rebuild"
git push origin main

# 4. Crear nuevo proyecto en Railway
# 5. Conectar repo de nuevo
```

---

**¿Problemas persistentes?** Considera usar un VPS (DigitalOcean, Hetzner) para tener control total.
