import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {
  createRemoteFederationConfig,
  federationBuildOptions,
  getRemoteViteBase,
} from '@chrisasstanina/shared-federation/federation';

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  envDir: resolve(__dirname, '../../..'),
  base: getRemoteViteBase('recipes', mode === 'development'),
  plugins: [react(), tailwindcss(), createRemoteFederationConfig({ name: 'recipes' })],
  ...federationBuildOptions,
  server: {
    port: 5003,
    strictPort: true,
    cors: true,
  },
  preview: {
    port: 5003,
    strictPort: true,
    cors: true,
  },
  resolve: {
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
  },
}));
