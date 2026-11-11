# 🎬 StreamSiphon

**Una aplicación web moderna y elegante para descargar videos y audio de YouTube**

🌐 **Demo en vivo**: [https://stream-siphon.vercel.app/](https://stream-siphon.vercel.app/)

## ✨ Características Principales

- **🎥 Descarga de Videos**: Soporta múltiples calidades desde 720p hasta 4K
- **🎵 Extracción de Audio**: Descarga audio en formato MP3 con diferentes bitrates
- **🌍 Audio en Español**: Detección automática y priorización de pistas de audio en español
- **⚡ Procesamiento en Tiempo Real**: Progress tracking con Server-Sent Events
- **🎨 Interfaz Moderna**: UI/UX elegante con modo oscuro/claro
- **📱 Responsive Design**: Optimizado para dispositivos móviles y desktop
- **🔄 Combinación Inteligente**: Fusión automática de video HD con el mejor audio disponible usando yt-dlp sin recomprimir
- **📋 Funciones de Clipboard**: Pegado automático desde portapapeles
- **🚀 Rendimiento Optimizado**: Construido con Next.js 15 y Turbopack

## 🛠️ Stack Tecnológico

### Frontend
- **Framework**: Next.js 15.3.3 con App Router
- **Lenguaje**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **UI Components**: Radix UI primitives
- **Iconos**: Lucide React
- **Formularios**: React Hook Form + Zod validation
- **Temas**: next-themes para modo oscuro/claro

### Backend
- **Runtime**: Node.js con Next.js API Routes
- **Descarga**: yt-dlp-wrap + yt-dlp para extracción de YouTube
- **Procesamiento de Video**: FFmpeg (binario de `ffmpeg-static`, usado por yt-dlp)
- **yt-dlp**: se descarga solo a `./bin` en `npm install` (Linux/macOS); en Windows se usa `yt-dlp.exe`. Ruta alternativa con `YT_DLP_PATH`
- **Bloqueo anti-bot de YouTube**: si el servidor recibe "Sign in to confirm you're not a bot", define la variable `YT_DLP_COOKIES` con el contenido de un `cookies.txt` de YouTube
- **Streams**: Node.js Streams para procesamiento eficiente
- **Progress Tracking**: Server-Sent Events (SSE)

### DevTools
- **Build Tool**: Turbopack para desarrollo rápido
- **Linting**: ESLint con configuración Next.js
- **Type Checking**: TypeScript compiler
- **Hosting**: Vercel

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 18+ 
- npm o pnpm
- FFmpeg instalado en el sistema

### Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/deperdomo/stream-siphon.git
   cd stream-siphon
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno** (opcional)
   ```bash
   cp .env.example .env.local
   ```

4. **Ejecutar en modo desarrollo**
   ```bash
   npm run dev
   ```

5. **Abrir en el navegador**
   ```
   http://localhost:9002
   ```

### Scripts Disponibles

```bash
npm run dev        # Desarrollo con Turbopack
npm run build      # Build de producción
npm run start      # Servidor de producción
npm run lint       # Linting con ESLint
npm run typecheck  # Verificación de tipos TypeScript
```

## 🏗️ Arquitectura del Proyecto

```
src/
├── app/
│   ├── api/
│   │   └── download/
│   │       ├── route.ts           # API principal de descarga
│   │       └── progress/
│   │           └── route.ts       # SSE para progress tracking
│   ├── globals.css               # Estilos globales
│   ├── layout.tsx               # Layout principal
│   └── page.tsx                 # Página home
├── components/
│   ├── app/
│   │   ├── youtube-downloader.tsx  # Componente principal
│   │   ├── theme-provider.tsx      # Provider de temas
│   │   └── theme-toggle.tsx        # Toggle de tema
│   └── ui/                      # Componentes UI reutilizables
├── hooks/                       # Custom React hooks
└── lib/
    ├── actions.ts              # Server actions
    ├── types.ts               # Definiciones de tipos
    └── utils.ts               # Utilidades
```

## 🔧 Funcionalidades Técnicas

### Descarga de Videos
- **Análisis de URL**: Validación y extracción de metadatos
- **Detección de Formatos**: Identificación automática de calidades disponibles
- **Combinación de Streams**: Video HD + audio de alta calidad orquestados por yt-dlp (se reutiliza FFmpeg solo cuando es necesario para audio)
- **Optimización de Audio**: Priorización de pistas en español

### Progress Tracking
- **Server-Sent Events**: Comunicación en tiempo real
- **Estados de Progreso**: 
  - Análisis del video (0-10%)
  - Descarga de video (10-50%)
  - Descarga de audio (50-75%)
  - Procesamiento FFmpeg (75-99%)
  - Finalización (100%)

### Interfaz de Usuario
- **Form Validation**: Zod schema validation
- **Estado de Carga**: Skeletons y spinners
- **Feedback Visual**: Toast notifications
- **Responsive Design**: Mobile-first approach

## 📋 Formatos Soportados

### Video
- **Calidades**: 720p, 1080p, 1440p, 4K (cuando estén disponibles)
- **Formato**: MP4 con codec H.264
- **Audio**: AAC codec, preferencia por pistas en español

### Audio
- **Formato**: MP3 (convertido desde WebM/MP4)
- **Bitrates**: 128kbps, 160kbps, 192kbps, 320kbps
- **Idioma**: Detección automática de audio en español

## 🌐 Deployment

### Opción 1: Railway.app ⭐ (Recomendado para producción)

**Railway soporta completamente FFmpeg, yt-dlp y procesamiento de video pesado.**

```powershell
# 1. Verificar que todo está listo
npm run check-railway

# 2. Ejecutar script de deploy automatizado
./deploy-railway.ps1
```

**📖 Guía completa:** Lee [DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md) para instrucciones paso a paso.

**🔧 ¿Problemas?:** Consulta [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

**⚡ Quick Start:** Lee [RAILWAY_QUICKSTART.md](./RAILWAY_QUICKSTART.md)

---

### Opción 2: Vercel (Limitaciones importantes)

⚠️ **Advertencia:** Vercel tiene limitaciones críticas:
- ⏱️ Tiempo de ejecución máximo: 10-60 segundos
- ❌ No soporta binarios personalizados (yt-dlp.exe)
- ❌ No soporta FFmpeg para combinación de video/audio
- ❌ **No funciona el modo "Ambos" (video+audio combinado)**

El proyecto está desplegado en Vercel para DEMO: **https://stream-siphon.vercel.app/**

Para desplegar tu propia versión en Vercel (solo para demo):

1. **Fork el repositorio**
2. **Conecta con Vercel**:
   - Ve a [vercel.com](https://vercel.com)
   - Importa el repositorio
   - Configura las variables de entorno si es necesario
3. **Deploy automático**: Vercel se encarga del build y deployment

---

### Opción 3: VPS Propio (Máximo control)

Para producción seria con alto tráfico:
- **DigitalOcean** ($6/mes)
- **Hetzner** ($5/mes)
- **Contabo** ($4.50/mes)

Control total, sin límites de tiempo de ejecución ni restricciones.

---

## 📁 Archivos de Deployment Incluidos

- `Dockerfile` - Configuración Docker con FFmpeg y yt-dlp
- `.dockerignore` - Optimización de build
- `railway.json` - Configuración de Railway
- `check-railway-ready.js` - Script de verificación pre-deploy
- `deploy-railway.ps1` - Script automatizado de deploy
- `DEPLOY_RAILWAY.md` - 📘 Guía detallada paso a paso
- `RAILWAY_QUICKSTART.md` - ⚡ Guía rápida
- `TROUBLESHOOTING.md` - 🔧 Solución de problemas
- `DEPLOYMENT_README.md` - 📋 Resumen de deployment

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -m 'Añadir nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## ⚠️ Disclaimer

Este proyecto es solo para uso educativo y personal. Respeta los términos de servicio de YouTube y las leyes de derechos de autor de tu jurisdicción. Los usuarios son responsables del uso que hagan de esta herramienta.

## 🐛 Reportar Problemas

Si encuentras algún bug o tienes una sugerencia, por favor [abre un issue](https://github.com/deperdomo/stream-siphon/issues).

---

<div align="center">

**¿Te gusta el proyecto? ¡Dale una ⭐️!**

</div>