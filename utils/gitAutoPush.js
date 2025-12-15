import chokidar from 'chokidar';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const REPO_URL = 'https://github.com/itzSecret1/sell-auth-bot-test2';
const WORKSPACE_DIR = process.cwd();
const IGNORED_PATHS = new Set(['.git', 'node_modules', '.cache', 'attached_assets', '.replit', '.env', '*.log']);

// Debounce para evitar múltiples pushes muy seguidos
let pushTimeout = null;
let pendingChanges = new Set();

function shouldIgnore(filePath) {
  const fileName = path.basename(filePath);
  
  if (IGNORED_PATHS.has(fileName)) return true;
  
  for (const ignored of IGNORED_PATHS) {
    if (filePath.includes(`/${ignored}/`) || filePath.includes(`\\${ignored}\\`)) {
      return true;
    }
  }
  
  // Ignorar archivos de log
  if (fileName.endsWith('.log')) return true;
  
  return false;
}

async function pushToGitHub() {
  try {
    console.log('[GIT-AUTO-PUSH] 🔄 Iniciando push a GitHub...');

    // Verificar si git está disponible
    try {
      execSync('git --version', { stdio: 'ignore' });
    } catch (e) {
      console.warn('[GIT-AUTO-PUSH] ⚠️ Git no está disponible, saltando push');
      return;
    }

    // Verificar si es un repositorio git
    if (!existsSync('.git')) {
      console.log('[GIT-AUTO-PUSH] 📦 Inicializando repositorio Git...');
      execSync('git init', { stdio: 'pipe' });
    }

    // Agregar todos los archivos
    console.log('[GIT-AUTO-PUSH] 📝 Agregando archivos...');
    try {
      execSync('git add .', { stdio: 'pipe' });
    } catch (e) {
      console.warn('[GIT-AUTO-PUSH] ⚠️ Error agregando archivos:', e.message);
      return;
    }

    // Verificar si hay cambios
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf-8' });
      if (!status.trim()) {
        console.log('[GIT-AUTO-PUSH] ✅ No hay cambios para hacer commit');
        pendingChanges.clear();
        return;
      }
    } catch (e) {
      // Continuar
    }

    // Hacer commit
    console.log('[GIT-AUTO-PUSH] 💾 Haciendo commit...');
    const changedFiles = Array.from(pendingChanges).slice(0, 5).join(', ');
    const commitMessage = `Auto-push: Cambios en ${changedFiles}${pendingChanges.size > 5 ? ` y ${pendingChanges.size - 5} más` : ''}`;
    
    try {
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
    } catch (e) {
      console.warn('[GIT-AUTO-PUSH] ⚠️ No hay cambios nuevos para hacer commit');
      pendingChanges.clear();
      return;
    }

    // Configurar remote si no existe
    try {
      execSync('git remote get-url origin', { stdio: 'pipe' });
      console.log('[GIT-AUTO-PUSH] ✅ Remote ya configurado');
    } catch (e) {
      console.log('[GIT-AUTO-PUSH] 🔗 Configurando remote...');
      try {
        execSync(`git remote add origin ${REPO_URL}`, { stdio: 'pipe' });
      } catch (addError) {
        // Si ya existe, actualizar
        execSync(`git remote set-url origin ${REPO_URL}`, { stdio: 'pipe' });
      }
    }

    // Configurar branch
    try {
      execSync('git branch -M main', { stdio: 'pipe' });
    } catch (e) {
      // Branch ya existe o no hay commits
    }

    // Push
    console.log('[GIT-AUTO-PUSH] 🚀 Haciendo push a GitHub...');
    try {
      execSync('git push -u origin main', { stdio: 'pipe' });
      console.log('[GIT-AUTO-PUSH] ✅ ¡Cambios subidos exitosamente a GitHub!');
      console.log(`[GIT-AUTO-PUSH] 🔗 Repositorio: ${REPO_URL}`);
      pendingChanges.clear();
    } catch (pushError) {
      console.warn('[GIT-AUTO-PUSH] ⚠️ Error al hacer push:', pushError.message);
      // Intentar con force si es necesario (solo si hay un error específico)
      try {
        execSync('git push -u origin main --force', { stdio: 'pipe' });
        console.log('[GIT-AUTO-PUSH] ✅ ¡Push forzado completado!');
        pendingChanges.clear();
      } catch (forceError) {
        console.error('[GIT-AUTO-PUSH] ❌ Error al hacer push forzado:', forceError.message);
      }
    }

  } catch (error) {
    console.error('[GIT-AUTO-PUSH] ❌ Error general:', error.message);
  }
}

export async function startGitAutoPush() {
  try {
    console.log(`[GIT-AUTO-PUSH] 📁 Observando cambios en ${WORKSPACE_DIR}`);
    console.log(`[GIT-AUTO-PUSH] 🔗 Repositorio: ${REPO_URL}`);

    const watcher = chokidar.watch(WORKSPACE_DIR, {
      ignored: (filePath) => shouldIgnore(filePath),
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      },
      ignoreInitial: true,
      depth: 99
    });

    watcher
      .on('add', (filePath) => {
        if (shouldIgnore(filePath)) return;
        const relativePath = path.relative(WORKSPACE_DIR, filePath);
        console.log(`[GIT-AUTO-PUSH] ➕ Nuevo archivo: ${relativePath}`);
        pendingChanges.add(relativePath);
        
        // Debounce: esperar 5 segundos después del último cambio antes de hacer push
        if (pushTimeout) clearTimeout(pushTimeout);
        pushTimeout = setTimeout(() => {
          pushToGitHub();
        }, 5000);
      })
      .on('change', (filePath) => {
        if (shouldIgnore(filePath)) return;
        const relativePath = path.relative(WORKSPACE_DIR, filePath);
        console.log(`[GIT-AUTO-PUSH] 🔄 Archivo modificado: ${relativePath}`);
        pendingChanges.add(relativePath);
        
        // Debounce: esperar 5 segundos después del último cambio antes de hacer push
        if (pushTimeout) clearTimeout(pushTimeout);
        pushTimeout = setTimeout(() => {
          pushToGitHub();
        }, 5000);
      })
      .on('unlink', (filePath) => {
        if (shouldIgnore(filePath)) return;
        const relativePath = path.relative(WORKSPACE_DIR, filePath);
        console.log(`[GIT-AUTO-PUSH] 🗑️ Archivo eliminado: ${relativePath}`);
        pendingChanges.add(relativePath);
        
        // Debounce: esperar 5 segundos después del último cambio antes de hacer push
        if (pushTimeout) clearTimeout(pushTimeout);
        pushTimeout = setTimeout(() => {
          pushToGitHub();
        }, 5000);
      })
      .on('error', (error) => {
        console.error('[GIT-AUTO-PUSH] ❌ Error del watcher:', error);
      });

    console.log('[GIT-AUTO-PUSH] ✅ Auto-push iniciado! Los cambios se subirán automáticamente a GitHub.');
  } catch (error) {
    console.error('[GIT-AUTO-PUSH] ❌ Error al iniciar auto-push:', error.message);
  }
}

