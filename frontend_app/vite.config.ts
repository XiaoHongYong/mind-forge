import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Tauri android/ios `dev` sets this so the device can reach Vite on the LAN.
// Desktop stays on loopback; mobile binds all interfaces and points HMR at the LAN host.
const tauriDevHost = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  envDir: '..',
  plugins: [react()],
  resolve: {
    alias: {
      '@mindforge/connectors': fileURLToPath(new URL('../packages/connectors/src/index.ts', import.meta.url)),
      '@mindforge/mindmap-core': fileURLToPath(new URL('../packages/mindmap-core/src/index.ts', import.meta.url)),
    },
  },
  optimizeDeps: {
    // hash-wasm loads its own WASM files at runtime — exclude from pre-bundling
    exclude: ['hash-wasm'],
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('lucide-react')) {
            return 'lucide-icons';
          }
        },
      },
    },
  },
  server: {
    host: tauriDevHost ? '0.0.0.0' : '127.0.0.1',
    port: 5274,
    strictPort: true,
    hmr: tauriDevHost
      ? {
          protocol: 'ws',
          host: tauriDevHost,
          port: 5274,
        }
      : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
});
