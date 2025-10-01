#!/usr/bin/env node

/**
 * Pre-deployment verification script
 * Verifica que todo esté listo para Railway deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n🔍 Verificando readiness para Railway deployment...\n');

let errors = [];
let warnings = [];

// 1. Verificar archivos necesarios
console.log('✓ Verificando archivos necesarios...');
const requiredFiles = [
  'Dockerfile',
  '.dockerignore',
  'railway.json',
  'package.json',
  'server.js',
  'next.config.ts'
];

requiredFiles.forEach(file => {
  if (!fs.existsSync(path.join(__dirname, file))) {
    errors.push(`❌ Archivo faltante: ${file}`);
  } else {
    console.log(`  ✅ ${file}`);
  }
});

// 2. Verificar package.json scripts
console.log('\n✓ Verificando scripts en package.json...');
const packageJson = require('./package.json');

const requiredScripts = ['build', 'start'];
requiredScripts.forEach(script => {
  if (!packageJson.scripts[script]) {
    errors.push(`❌ Script faltante en package.json: ${script}`);
  } else {
    console.log(`  ✅ Script "${script}": ${packageJson.scripts[script]}`);
  }
});

// 3. Verificar dependencies críticas
console.log('\n✓ Verificando dependencias críticas...');
const criticalDeps = ['next', 'react', 'fluent-ffmpeg'];

criticalDeps.forEach(dep => {
  if (!packageJson.dependencies[dep]) {
    errors.push(`❌ Dependencia faltante: ${dep}`);
  } else {
    console.log(`  ✅ ${dep}: ${packageJson.dependencies[dep]}`);
  }
});

// 4. Verificar que build funciona
console.log('\n✓ Verificando que el build funciona...');
try {
  console.log('  🔨 Ejecutando npm run build (esto puede tomar un momento)...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('  ✅ Build exitoso!');
} catch (error) {
  errors.push('❌ Build falló. Corrige los errores antes de desplegar.');
}

// 5. Verificar Git
console.log('\n✓ Verificando configuración de Git...');
try {
  const gitRemote = execSync('git remote -v', { encoding: 'utf-8' });
  if (gitRemote.includes('origin')) {
    console.log('  ✅ Git remote configurado');
    console.log(gitRemote.trim().split('\n')[0]);
  } else {
    warnings.push('⚠️  No hay remote "origin" configurado. Necesitarás configurarlo.');
  }
} catch (error) {
  warnings.push('⚠️  Git no inicializado. Ejecuta: git init');
}

// 6. Verificar .env (opcional)
console.log('\n✓ Verificando variables de entorno...');
if (fs.existsSync('.env') || fs.existsSync('.env.local')) {
  warnings.push('⚠️  Archivo .env encontrado. Recuerda configurar estas variables en Railway.');
  console.log('  📝 Configura las variables en Railway Dashboard → Variables');
} else {
  console.log('  ✅ No se encontraron archivos .env (ok si no los necesitas)');
}

// Resumen
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN DE VERIFICACIÓN');
console.log('='.repeat(60));

if (errors.length === 0 && warnings.length === 0) {
  console.log('\n✅ ¡Todo listo para deployment en Railway!\n');
  console.log('📝 Próximos pasos:');
  console.log('   1. git add .');
  console.log('   2. git commit -m "Ready for Railway"');
  console.log('   3. git push origin main');
  console.log('   4. Ir a railway.app y crear nuevo proyecto desde GitHub');
  console.log('\n📖 Lee DEPLOY_RAILWAY.md para instrucciones detalladas\n');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log('\n❌ ERRORES que debes corregir:\n');
    errors.forEach(err => console.log('   ' + err));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  ADVERTENCIAS (no críticas):\n');
    warnings.forEach(warn => console.log('   ' + warn));
  }
  
  if (errors.length > 0) {
    console.log('\n🔧 Corrige los errores antes de desplegar.\n');
    process.exit(1);
  } else {
    console.log('\n✅ Puedes continuar, pero considera las advertencias.\n');
    process.exit(0);
  }
}
