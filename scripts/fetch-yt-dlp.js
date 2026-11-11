// postinstall: descarga el binario autónomo de yt-dlp a ./bin (local al proyecto).
// Necesario en Vercel y otros hosts sin yt-dlp. Nunca rompe `npm install`.
const { spawnSync } = require('child_process');
const { mkdirSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

const assets = { 'linux-x64': 'yt-dlp_linux', 'linux-arm64': 'yt-dlp_linux_aarch64', 'darwin-x64': 'yt-dlp_macos', 'darwin-arm64': 'yt-dlp_macos' };
const asset = assets[`${process.platform}-${process.arch}`];
const dest = join(__dirname, '..', 'bin', 'yt-dlp');

(async () => {
  if (!asset) return; // Windows usa el yt-dlp.exe del repo
  if (existsSync(dest)) return;
  // Docker ya lo instala en el PATH (y el binario glibc no funciona en Alpine)
  if (spawnSync('yt-dlp', ['--version']).status === 0) return;
  const res = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  mkdirSync(join(__dirname, '..', 'bin'), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()), { mode: 0o755 });
  console.log(`yt-dlp descargado en ${dest}`);
})().catch((e) => console.warn('No se pudo descargar yt-dlp:', e.message));
