# 🚀 Quick Start - Railway Deploy

## Comandos Rápidos

### 1. Preparar para Deploy
```powershell
# Construir localmente para verificar que funciona
npm run build

# Si hay errores, corrígelos antes de continuar
```

### 2. Subir a GitHub
```powershell
# Asegúrate de estar en la carpeta del proyecto
cd D:\Proyectos\video-downloader-web

# Inicializar git (si no está inicializado)
git init

# Agregar todos los archivos
git add .

# Commit
git commit -m "Ready for Railway deployment"

# Agregar remote (CAMBIA TU_USUARIO por tu usuario de GitHub)
git remote add origin https://github.com/TU_USUARIO/video-downloader-web.git

# Push
git branch -M main
git push -u origin main
```

### 3. Deploy en Railway

1. Ve a https://railway.app
2. Login con GitHub
3. **New Project** → **Deploy from GitHub repo**
4. Selecciona `video-downloader-web`
5. Railway detectará el Dockerfile y lo construirá automáticamente
6. Espera 5-7 minutos
7. Ve a **Settings** → **Generate Domain**
8. ¡Listo! Copia la URL y prueba tu app

### 4. Actualizar App
```powershell
# Después de hacer cambios en el código
git add .
git commit -m "Descripción de los cambios"
git push

# Railway desplegará automáticamente
```

## 🔍 Verificar Estado

```powershell
# Ver logs en Railway CLI
railway login
railway logs
```

## 📁 Archivos Creados

- ✅ `Dockerfile` - Configuración de Docker para Railway
- ✅ `.dockerignore` - Archivos a ignorar en build
- ✅ `railway.json` - Configuración específica de Railway
- ✅ `DEPLOY_RAILWAY.md` - Guía detallada completa

## ⚡ Tiempo Estimado

- **Configurar GitHub:** 2 minutos
- **Configurar Railway:** 3 minutos
- **Build & Deploy:** 5-7 minutos
- **Total:** ~10-12 minutos

## 💰 Costo

- **Gratis:** $5 USD de crédito mensual (~500 horas)
- **Si excedes:** ~$0.01/hora adicional

## ✅ Checklist Rápido

- [ ] `npm run build` funciona sin errores
- [ ] Código en GitHub
- [ ] Proyecto creado en Railway
- [ ] Domain generado
- [ ] App accesible y funcional

---

Para la guía completa y detallada, lee: **[DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md)**
