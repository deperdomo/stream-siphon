# 📦 Archivos de Deployment - Railway

Este directorio contiene todos los archivos necesarios para desplegar la aplicación en Railway.app

---

## 📁 Archivos Creados

### 🐳 Configuración de Docker

- **`Dockerfile`**
  - Configuración de la imagen Docker
  - Instala Node.js, FFmpeg y yt-dlp
  - Construye la aplicación Next.js
  - Expone el puerto 3000

- **`.dockerignore`**
  - Archivos a ignorar durante el build de Docker
  - Reduce el tamaño de la imagen
  - Acelera el proceso de build

### 🚂 Configuración de Railway

- **`railway.json`**
  - Configuración específica de Railway
  - Define el builder como DOCKERFILE
  - Configura políticas de restart

### 📖 Documentación

- **`DEPLOY_RAILWAY.md`** ⭐ **GUÍA PRINCIPAL**
  - Guía paso a paso COMPLETA y DETALLADA
  - Incluye screenshots conceptuales
  - 10 pasos desde cero hasta deployment
  - Solución de problemas comunes
  - Configuraciones avanzadas

- **`RAILWAY_QUICKSTART.md`**
  - Versión rápida de la guía
  - Comandos esenciales
  - Para usuarios con experiencia
  - Referencia rápida

- **`TROUBLESHOOTING.md`**
  - Guía de solución de problemas
  - Errores comunes y soluciones
  - Comandos de debugging
  - Checklist de verificación

### 🔍 Scripts de Verificación

- **`check-railway-ready.js`**
  - Script de verificación pre-deployment
  - Verifica archivos necesarios
  - Comprueba que build funciona
  - Valida configuración de Git
  - Ejecutar con: `npm run check-railway`

---

## 🚀 Proceso de Deployment

### Opción 1: Guía Completa (Recomendado para primera vez)

Lee: **[DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md)**

Incluye:
- ✅ Configuración de GitHub
- ✅ Configuración de Railway
- ✅ Variables de entorno
- ✅ Monitoreo de logs
- ✅ Generación de dominio
- ✅ Solución de problemas
- ✅ Optimización de costos

### Opción 2: Quick Start (Usuarios experimentados)

Lee: **[RAILWAY_QUICKSTART.md](./RAILWAY_QUICKSTART.md)**

### Opción 3: Comandos Mínimos

```powershell
# 1. Verificar que todo está listo
npm run check-railway

# 2. Subir a GitHub
git add .
git commit -m "Ready for Railway"
git push origin main

# 3. En Railway
# - Ir a railway.app
# - New Project → Deploy from GitHub
# - Seleccionar tu repo
# - Esperar build (5-7 min)
# - Generate Domain
# - ¡Listo!
```

---

## ✅ Verificación Pre-Deploy

Antes de desplegar, ejecuta:

```powershell
npm run check-railway
```

Este comando verificará:
- ✅ Archivos necesarios presentes
- ✅ Scripts en package.json correctos
- ✅ Dependencias críticas instaladas
- ✅ Build funciona sin errores
- ✅ Git configurado correctamente

---

## 📊 Estructura del Deployment

```
Tu App Local
    ↓
GitHub Repository
    ↓
Railway (detecta push)
    ↓
Build con Dockerfile
    ↓
Deploy automático
    ↓
URL pública generada
```

---

## 🔧 Solución de Problemas

Si encuentras errores, consulta: **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**

Errores cubiertos:
- Build failed
- Application not responding
- yt-dlp not found
- FFmpeg not found
- Out of memory
- Deployment timeout
- GitHub connection failed
- Environment variables missing
- Domain generation failed
- Download fails (403/429)

---

## 💰 Costos

### Plan Gratuito (Hobby)
- **$5 USD** de crédito mensual
- ~**500 horas** de ejecución
- Perfecto para uso personal

### Plan Pagado
- **$5/mes** - Hobby plan
- **$20/mes** - Pro plan
- Más recursos y sin límites

---

## 🌐 Después del Deploy

Una vez desplegado:

1. **Obtén tu URL:**
   - Settings → Domains → Generate Domain
   - Ejemplo: `https://video-downloader-web-production.up.railway.app`

2. **Prueba la aplicación:**
   - Abre la URL en el navegador
   - Prueba descargar un video
   - Verifica que Audio y Ambos funcionen

3. **Monitorea:**
   - Deployments → View Logs
   - Usage → Ver consumo de recursos

4. **Actualiza:**
   - Haz cambios localmente
   - `git push origin main`
   - Railway redespliega automáticamente

---

## 📝 Comandos Útiles

```powershell
# Verificar readiness
npm run check-railway

# Build local (para probar)
npm run build

# Ver logs de Railway (requiere CLI)
railway login
railway logs

# Abrir dashboard
railway open

# Deploy manual
railway up
```

---

## ⚠️ Notas Importantes

1. **Legal:** Esta app descarga videos de YouTube, lo cual puede violar sus términos de servicio. Úsala responsablemente.

2. **Privacidad:** No compartas la URL públicamente si no quieres que cualquiera la use.

3. **Límites:** El plan gratuito tiene límites. Si esperas mucho tráfico, considera upgrade.

4. **Alternativas:** Si Railway te suspende, considera VPS (DigitalOcean, Hetzner, Contabo).

---

## 🎯 Próximos Pasos

Después de desplegar exitosamente:

- [ ] Agregar autenticación (opcional)
- [ ] Configurar dominio personalizado (opcional)
- [ ] Implementar rate limiting (recomendado)
- [ ] Agregar analytics (opcional)
- [ ] Configurar monitoring (opcional)

---

## 📞 Soporte

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Guía detallada:** [DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md)
- **Troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## ✨ ¡Éxito!

Si llegaste hasta aquí y tu app está desplegada, ¡felicidades! 🎉

Tu aplicación ahora está:
- ✅ En línea 24/7
- ✅ Con URL pública
- ✅ Con SSL (HTTPS) gratis
- ✅ Con deploy automático desde GitHub

---

**Happy Deploying! 🚀**
