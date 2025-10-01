# Usar Node.js 20 con Alpine para imagen más ligera
FROM node:20-alpine

# Instalar dependencias del sistema: FFmpeg y yt-dlp
# Nota: Usamos --break-system-packages porque Alpine 3.22+ tiene PEP 668 habilitado
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    && pip3 install --break-system-packages --no-cache-dir yt-dlp

# Configurar directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar TODAS las dependencias (necesarias para build y postinstall scripts)
RUN npm ci || npm install

# Copiar el resto de la aplicación
COPY . .

# Construir la aplicación Next.js
RUN npm run build

# Exponer el puerto (Railway asignará automáticamente)
EXPOSE 3000

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000

# Comando para iniciar la aplicación
CMD ["npm", "start"]
