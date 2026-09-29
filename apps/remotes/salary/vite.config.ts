import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {
  createRemoteFederationConfig,
  createWorkspaceAliases,
  federationBuildOptions,
} from '@chrisasstanina/shared-federation/federation';

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  envDir: resolve(__dirname, '../../..'),
  plugins: [react(), tailwindcss(), createRemoteFederationConfig({ name: 'salary' })],
  ...federationBuildOptions,
  server: {
    port: 5006,
    strictPort: true,
    cors: true,
  },
  preview: {
    port: 5006,
    strictPort: true,
    cors: true,
  },
  resolve: {
    alias: createWorkspaceAliases(),
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
  },
  optimizeDeps: {
    include: ['@chrisasstanina/ui', 'motion'],
  },
});
