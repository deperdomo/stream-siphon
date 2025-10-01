# Script de Deploy a Railway
# Ejecutar en PowerShell

Write-Host "`n🚀 SCRIPT DE DEPLOY A RAILWAY" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Paso 1: Verificar readiness
Write-Host "📋 PASO 1: Verificando que todo está listo...`n" -ForegroundColor Yellow
npm run check-railway

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Hay errores que corregir. Revisa los mensajes arriba.`n" -ForegroundColor Red
    exit 1
}

# Paso 2: Confirmar con el usuario
Write-Host "`n✅ Verificación completada!" -ForegroundColor Green
Write-Host "`n¿Deseas continuar con el proceso de deploy? (S/N): " -NoNewline -ForegroundColor Yellow
$respuesta = Read-Host

if ($respuesta -ne "S" -and $respuesta -ne "s") {
    Write-Host "`n❌ Deploy cancelado.`n" -ForegroundColor Red
    exit 0
}

# Paso 3: Git status
Write-Host "`n📋 PASO 2: Verificando estado de Git...`n" -ForegroundColor Yellow
git status

# Paso 4: Git add
Write-Host "`n📋 PASO 3: Agregando archivos al staging...`n" -ForegroundColor Yellow
git add .

# Paso 5: Git commit
Write-Host "`n📋 PASO 4: Creando commit...`n" -ForegroundColor Yellow
Write-Host "Mensaje del commit: " -NoNewline -ForegroundColor Cyan
$commitMessage = Read-Host

if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    $commitMessage = "Ready for Railway deployment"
}

git commit -m "$commitMessage"

# Paso 6: Verificar remote
Write-Host "`n📋 PASO 5: Verificando remote de GitHub...`n" -ForegroundColor Yellow
$remote = git remote -v

if ([string]::IsNullOrWhiteSpace($remote)) {
    Write-Host "⚠️  No hay remote configurado.`n" -ForegroundColor Yellow
    Write-Host "URL del repositorio de GitHub: " -NoNewline -ForegroundColor Cyan
    $repoUrl = Read-Host
    
    if (![string]::IsNullOrWhiteSpace($repoUrl)) {
        git remote add origin $repoUrl
        Write-Host "✅ Remote agregado!`n" -ForegroundColor Green
    } else {
        Write-Host "`n❌ No se puede continuar sin un remote de GitHub.`n" -ForegroundColor Red
        Write-Host "Configura tu repositorio primero:`n" -ForegroundColor Yellow
        Write-Host "  git remote add origin https://github.com/TU_USUARIO/video-downloader-web.git`n" -ForegroundColor White
        exit 1
    }
} else {
    Write-Host "✅ Remote configurado:" -ForegroundColor Green
    Write-Host $remote
}

# Paso 7: Git push
Write-Host "`n📋 PASO 6: Subiendo código a GitHub...`n" -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n⚠️  Si es tu primer push, prueba: git push -u origin main`n" -ForegroundColor Yellow
    git push -u origin main
}

# Paso 8: Instrucciones finales
Write-Host "`n✅ ¡Código subido a GitHub exitosamente!`n" -ForegroundColor Green

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "   📋 PRÓXIMOS PASOS EN RAILWAY.APP" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

Write-Host "1. Ve a: " -NoNewline -ForegroundColor White
Write-Host "https://railway.app" -ForegroundColor Blue

Write-Host "`n2. Haz login con GitHub`n" -ForegroundColor White

Write-Host "3. Click en 'New Project' → 'Deploy from GitHub repo'`n" -ForegroundColor White

Write-Host "4. Selecciona tu repositorio: video-downloader-web`n" -ForegroundColor White

Write-Host "5. Railway detectará el Dockerfile automáticamente`n" -ForegroundColor White

Write-Host "6. Espera 5-7 minutos mientras se construye`n" -ForegroundColor White

Write-Host "7. Ve a Settings → Domains → Generate Domain`n" -ForegroundColor White

Write-Host "8. ¡Copia tu URL y pruébala!`n" -ForegroundColor White

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

Write-Host "📖 Para instrucciones detalladas, lee: " -NoNewline -ForegroundColor White
Write-Host "DEPLOY_RAILWAY.md`n" -ForegroundColor Green

Write-Host "🔧 Si tienes problemas, consulta: " -NoNewline -ForegroundColor White
Write-Host "TROUBLESHOOTING.md`n" -ForegroundColor Green

Write-Host "✨ ¡Buena suerte con tu deploy!`n" -ForegroundColor Cyan
