import federation from '@originjs/vite-plugin-federation';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packagesDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Явные alias для workspace-пакетов — директория пакета, не index.ts (federation читает package.json) */
export function createWorkspaceAliases() {
  return {
    '@chrisasstanina/ui': resolve(packagesDir, 'ui'),
    '@chrisasstanina/firebase': resolve(packagesDir, 'firebase'),
    '@chrisasstanina/auth': resolve(packagesDir, 'auth'),
  };
}

export const REMOTE_NAMES = ['tasks', 'shopping', 'recipes', 'budget', 'cashback', 'salary'];

export const REMOTE_PORTS = {
  tasks: 5001,
  shopping: 5002,
  recipes: 5003,
  budget: 5004,
  cashback: 5005,
  salary: 5006,
};

export const APP_LABELS = {
  tasks: 'Задачи',
  shopping: 'Список покупок',
  recipes: 'Рецепты',
  budget: 'Бюджет',
  cashback: 'Кэшбеки',
  salary: 'Salary Flow',
};

export const APP_DESCRIPTIONS = {
  tasks: 'Семейные задачи и дела',
  shopping: 'Общий список покупок',
  recipes: 'Любимые рецепты и меню',
  budget: 'Учёт расходов семьи',
  cashback: 'Распознавание и учёт кэшбеков',
  salary: 'Визуальный трекер заработка в реальном времени',
};

export function normalizeBasePath(base = '/') {
  if (!base || base === '/') return '/';
  return base.endsWith('/') ? base : `${base}/`;
}

/** GitHub Pages project site: /chrisas_stanina/ — через VITE_BASE_PATH в CI */
export function getShellBasePath() {
  return normalizeBasePath(process.env.VITE_BASE_PATH);
}

export function getRemoteBasePath(name) {
  const shellBase = getShellBasePath();
  if (shellBase === '/') return `/remotes/${name}/`;
  return `${shellBase}remotes/${name}/`;
}

export function getRemoteViteBase(name, isDev) {
  if (isDev) return '/';
  return getRemoteBasePath(name);
}

export function getRemoteEntryUrl(name, isDev) {
  if (isDev) {
    return `http://localhost:${REMOTE_PORTS[name]}/assets/remoteEntry.js`;
  }
  return `${getRemoteBasePath(name)}assets/remoteEntry.js`;
}

export function createSharedDependencies() {
  return {
    react: {
      singleton: true,
      requiredVersion: '^19.0.0',
    },
    'react-dom': {
      singleton: true,
      requiredVersion: '^19.0.0',
    },
    'react-router-dom': {
      singleton: true,
      requiredVersion: '^7.0.0',
    },
    '@tanstack/react-query': {
      singleton: true,
      requiredVersion: '^5.0.0',
    },
    // Один экземпляр контекста auth/firebase/ui между shell и remotes
    '@chrisasstanina/auth': {
      singleton: true,
      requiredVersion: '0.0.0',
      packagePath: resolve(packagesDir, 'auth'),
    },
    '@chrisasstanina/firebase': {
      singleton: true,
      requiredVersion: '0.0.0',
      packagePath: resolve(packagesDir, 'firebase'),
    },
    '@chrisasstanina/ui': {
      singleton: true,
      requiredVersion: '0.0.0',
      packagePath: resolve(packagesDir, 'ui'),
    },
  };
}

export function createHostFederationConfig({ isDev }) {
  const remotes = Object.fromEntries(
    REMOTE_NAMES.map((name) => [name, getRemoteEntryUrl(name, isDev)]),
  );

  return federation({
    name: 'shell',
    remotes,
    shared: createSharedDependencies(),
  });
}

export function createRemoteFederationConfig({ name }) {
  return federation({
    name,
    filename: 'remoteEntry.js',
    exposes: {
      './App': './src/App.tsx',
    },
    shared: createSharedDependencies(),
  });
}

export const federationBuildOptions = {
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
};
