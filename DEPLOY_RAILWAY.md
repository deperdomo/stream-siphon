# 🚂 Guía de Despliegue en Railway.app

Esta guía te llevará paso a paso para desplegar tu aplicación de descarga de YouTube en Railway.

---

## 📋 Requisitos Previos

1. ✅ Cuenta de GitHub (gratis)
2. ✅ Cuenta de Railway.app (gratis - $5 USD de crédito inicial)
3. ✅ Git instalado en tu computadora

---

## 🚀 PASO 1: Preparar el Repositorio en GitHub

### 1.1 Crear repositorio en GitHub (si no existe)

1. Ve a [github.com](https://github.com)
2. Click en el botón **"New"** (nuevo repositorio)
3. Nombre: `video-downloader-web` (o el que prefieras)
4. Selecciona **"Private"** si quieres mantenerlo privado
5. **NO** marques "Initialize with README" (ya tienes archivos)
6. Click en **"Create repository"**

### 1.2 Subir tu código a GitHub

Abre PowerShell en la carpeta de tu proyecto y ejecuta:

```powershell
# Inicializar git (si no está inicializado)
git init

# Agregar todos los archivos
git add .

# Hacer commit
git commit -m "Initial commit - Ready for Railway deployment"

# Agregar el repositorio remoto (reemplaza con tu URL)
git remote add origin https://github.com/TU_USUARIO/video-downloader-web.git

# Subir el código
git branch -M main
git push -u origin main
```

> **Nota:** Reemplaza `TU_USUARIO` con tu nombre de usuario de GitHub

---

## 🚂 PASO 2: Configurar Railway

### 2.1 Crear cuenta en Railway

1. Ve a [railway.app](https://railway.app)
2. Click en **"Start a New Project"** o **"Login"**
3. Selecciona **"Login with GitHub"**
4. Autoriza Railway para acceder a tu cuenta de GitHub

### 2.2 Crear nuevo proyecto

1. En el dashboard de Railway, click en **"New Project"**
2. Selecciona **"Deploy from GitHub repo"**
3. Si es la primera vez, click en **"Configure GitHub App"**
4. Selecciona los repositorios que Railway puede acceder:
   - Opción 1: **"All repositories"** (más fácil)
   - Opción 2: **"Only select repositories"** → Selecciona `video-downloader-web`
5. Click en **"Install & Authorize"**

### 2.3 Seleccionar tu repositorio

1. En la lista de repositorios, busca **"video-downloader-web"**
2. Click en el repositorio
3. Railway detectará automáticamente el `Dockerfile`
4. Click en **"Deploy Now"**

---

## ⚙️ PASO 3: Configurar Variables de Entorno (si las necesitas)

### 3.1 Agregar variables de entorno

Si tu app necesita variables de entorno:

1. En el dashboard de Railway, click en tu proyecto
2. Ve a la pestaña **"Variables"**
3. Click en **"New Variable"**
4. Agrega las siguientes (si aplican):

```
NODE_ENV=production
PORT=3000
```

> **Nota:** Railway asigna automáticamente el puerto, pero Node.js lo leerá de `process.env.PORT`

---

## 🔍 PASO 4: Monitorear el Despliegue

### 4.1 Ver logs en tiempo real

1. En tu proyecto de Railway, ve a la pestaña **"Deployments"**
2. Click en el deployment activo (debería estar "Building" o "Deploying")
3. Verás los logs en tiempo real:

```
Building Docker image...
Installing yt-dlp...
Installing FFmpeg...
Building Next.js app...
Deployment successful!
```

### 4.2 Tiempos estimados

- ⏱️ **Build:** 3-5 minutos (primera vez)
- ⏱️ **Deploy:** 30-60 segundos
- ⏱️ **Total:** ~5-7 minutos

---

## 🌐 PASO 5: Obtener la URL de tu Aplicación

### 5.1 Generar dominio público

1. Ve a la pestaña **"Settings"** de tu proyecto
2. Sección **"Domains"**
3. Click en **"Generate Domain"**
4. Railway generará una URL como: `https://video-downloader-web-production.up.railway.app`

### 5.2 Probar la aplicación

1. Copia la URL generada
2. Ábrela en tu navegador
3. Deberías ver tu aplicación funcionando
4. Prueba descargar un video para verificar que todo funciona

---

## 🔧 PASO 6: Comandos Útiles de Railway CLI (Opcional)

### 6.1 Instalar Railway CLI

```powershell
# Instalar Railway CLI globalmente
npm install -g @railway/cli
```

### 6.2 Comandos útiles

```powershell
# Login en Railway
railway login

# Ver logs en tiempo real
railway logs

# Abrir dashboard del proyecto
railway open

# Ver estado del proyecto
railway status

# Hacer deploy manual
railway up
```

---

## 📊 PASO 7: Verificar Recursos y Costos

### 7.1 Revisar uso de recursos

1. En Railway dashboard, ve a **"Usage"**
2. Verás:
   - 💾 **Memory:** RAM utilizada
   - ⚡ **CPU:** Uso de procesador
   - 🌐 **Network:** Tráfico de red
   - 💰 **Cost:** Costo estimado

### 7.2 Plan gratuito

Railway ofrece:
- 💵 **$5 USD de crédito gratis** al mes
- ⏱️ Aproximadamente **500 horas de servidor**
- 🔄 Si excedes, te cobrarán ~$0.01/hora

### 7.3 Optimizar costos

Para que dure más el crédito gratuito:
- ✅ Usa la app solo cuando la necesites
- ✅ Configura auto-sleep si Railway lo permite
- ✅ Considera actualizar a plan Hobby ($5/mes) si la usas mucho

---

## 🔄 PASO 8: Actualizar la Aplicación

### 8.1 Deploy automático

Railway tiene auto-deploy activado por defecto:

```powershell
# Hacer cambios en tu código local
# Luego:

git add .
git commit -m "Descripción de los cambios"
git push origin main

# Railway detectará el push y desplegará automáticamente
```

### 8.2 Rollback a versión anterior

Si algo sale mal:

1. Ve a **"Deployments"** en Railway
2. Encuentra el deployment anterior que funcionaba
3. Click en los tres puntos **"..."**
4. Selecciona **"Redeploy"**

---

## 🐛 PASO 9: Solución de Problemas Comunes

### Error: "Build failed"

**Solución:**
```powershell
# Asegúrate de que el build funciona localmente
npm run build

# Si funciona, haz push de nuevo
git add .
git commit -m "Fix build"
git push
```

### Error: "yt-dlp not found"

**Problema:** El Dockerfile no instaló yt-dlp correctamente

**Solución:** Verifica que el `Dockerfile` tiene:
```dockerfile
RUN pip3 install --no-cache-dir yt-dlp
```

### Error: "FFmpeg not found"

**Problema:** FFmpeg no se instaló

**Solución:** Verifica que el `Dockerfile` tiene:
```dockerfile
RUN apk add --no-cache ffmpeg
```

### App no responde / 502 Bad Gateway

**Soluciones:**
1. Verifica los logs en Railway
2. Asegúrate de que el puerto es correcto:
   ```javascript
   const port = process.env.PORT || 3000
   ```
3. Verifica que `server.js` está escuchando en `0.0.0.0`:
   ```javascript
   const hostname = '0.0.0.0'
   ```

### Descarga muy lenta

**Causa:** Limitaciones de red de Railway

**Soluciones:**
- Videos cortos funcionan mejor
- Considera usar calidades más bajas para pruebas
- Para producción seria, considera VPS dedicado

---

## 📱 PASO 10: Configuraciones Adicionales (Opcional)

### 10.1 Dominio personalizado

1. Ve a **"Settings"** → **"Domains"**
2. Click en **"Custom Domain"**
3. Agrega tu dominio (ej: `descargador.tudominio.com`)
4. Configura el DNS según las instrucciones de Railway

### 10.2 Agregar autenticación (recomendado para privacidad)

Para evitar que cualquiera use tu app, considera agregar:
- Basic Auth
- Login con password
- Límite de rate limiting

### 10.3 Healthcheck

Railway automáticamente hace healthchecks, pero puedes personalizar:

```javascript
// En tu app, agrega ruta de health
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})
```

---

## ✅ CHECKLIST FINAL

Antes de considerar el deploy completo, verifica:

- [ ] ✅ App se construye sin errores (`npm run build`)
- [ ] ✅ Código subido a GitHub
- [ ] ✅ Proyecto creado en Railway
- [ ] ✅ Dockerfile configurado correctamente
- [ ] ✅ Build completado exitosamente en Railway
- [ ] ✅ URL generada y accesible
- [ ] ✅ Prueba de descarga de video funciona
- [ ] ✅ Prueba de descarga de audio funciona
- [ ] ✅ Prueba de descarga "Ambos" funciona
- [ ] ✅ Logs no muestran errores críticos
- [ ] ✅ Uso de recursos dentro del límite gratuito

---

## 🎯 RESULTADO ESPERADO

Si todo salió bien, deberías tener:

✅ **URL pública:** `https://tu-app.up.railway.app`
✅ **Deploy automático:** Cada push a main despliega automáticamente
✅ **FFmpeg funcionando:** Para combinar video y audio
✅ **yt-dlp funcionando:** Para descargar de YouTube
✅ **SSL gratis:** HTTPS automático
✅ **Logs en tiempo real:** Para debugging

---

## 📞 SOPORTE

Si tienes problemas:

1. **Revisa los logs** en Railway dashboard
2. **Consulta la documentación:** [docs.railway.app](https://docs.railway.app)
3. **Discord de Railway:** Comunidad muy activa

---

## ⚠️ ADVERTENCIA LEGAL

Recuerda que descargar videos de YouTube puede violar sus términos de servicio. Usa esta aplicación de manera responsable y solo para contenido del cual tienes derechos o permiso.

---

**¡Felicidades! 🎉 Tu aplicación está desplegada en Railway.**

Para cualquier actualización, solo haz `git push` y Railway se encargará del resto.
