import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {
  createHostFederationConfig,
  createWorkspaceAliases,
  federationBuildOptions,
} from '@chrisasstanina/shared-federation/federation';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  envDir: resolve(__dirname, '../..'),
  plugins: [react(), tailwindcss(), createHostFederationConfig({ isDev: mode === 'development' })],
  ...federationBuildOptions,
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      ...createWorkspaceAliases(),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
  },
  optimizeDeps: {
    include: ['@chrisasstanina/ui', 'motion'],
  },
}));
