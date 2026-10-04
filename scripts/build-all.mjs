#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const shellDir = join(rootDir, 'apps/shell');
const remotesPublicDir = join(shellDir, 'public/remotes');

const REMOTES = ['tasks', 'shopping', 'recipes', 'budget', 'cashback', 'salary', 'payments'];

function run(command) {
  execSync(command, { cwd: rootDir, stdio: 'inherit' });
}

function copyRemoteAssets(remoteName) {
  const remoteDist = join(rootDir, 'apps/remotes', remoteName, 'dist');
  const targetDir = join(remotesPublicDir, remoteName);

  if (!existsSync(remoteDist)) {
    throw new Error(`Remote dist not found for ${remoteName}: ${remoteDist}`);
  }

  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
  cpSync(remoteDist, targetDir, { recursive: true });

  const assetsDir = join(targetDir, 'assets');
  if (!existsSync(assetsDir)) {
    throw new Error(`Expected assets directory missing for remote ${remoteName}`);
  }

  const remoteEntry = join(assetsDir, 'remoteEntry.js');
  if (!existsSync(remoteEntry)) {
    const files = readdirSync(assetsDir);
    const entry = files.find((file) => file.startsWith('remoteEntry'));
    if (!entry) {
      throw new Error(`remoteEntry.js not found for remote ${remoteName}`);
    }
  }
}

console.log('Building remotes...');
for (const remote of REMOTES) {
  console.log(`\n> Building @chrisasstanina/${remote}`);
  run(`npm run build -w @chrisasstanina/${remote}`);
}

console.log('\nCopying remote assets into shell/public/remotes...');
rmSync(remotesPublicDir, { recursive: true, force: true });
mkdirSync(remotesPublicDir, { recursive: true });

for (const remote of REMOTES) {
  copyRemoteAssets(remote);
  console.log(`  ✓ ${remote}`);
}

console.log('\nBuilding shell host...');
run('npm run build -w @chrisasstanina/shell');

const shellDist = join(shellDir, 'dist');
const shellRemotesDist = join(shellDist, 'remotes');

if (existsSync(remotesPublicDir)) {
  rmSync(shellRemotesDist, { recursive: true, force: true });
  cpSync(remotesPublicDir, shellRemotesDist, { recursive: true });
}

console.log('\nBuild complete.');
console.log(`Output: ${shellDist}`);

if (existsSync(shellDist)) {
  const stats = statSync(shellDist);
  if (stats.isDirectory()) {
    console.log('Ready for GitHub Pages deployment.');
  }
}
