import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Custom error handling plugin for Vite dev server.
 * Catches port 3000 bind errors (EADDRINUSE) early and provides informative diagnostic console messages.
 */
const portConflictHandlerPlugin = (): Plugin => ({
  name: 'port-conflict-handler',
  configureServer(server) {
    server.httpServer?.on('error', (err: unknown) => {
      const error = err as NodeJS.ErrnoException;
      if (error && error.code === 'EADDRINUSE') {
        console.error(
          '\n============================================================\n' +
          '[Vite Dev Server Error] Port 3000 is already in use by another process!\n' +
          'This application requires the development server to run strictly on port 3000.\n' +
          'Action: Please terminate any process occupying port 3000 or restart the dev server.\n' +
          '============================================================\n'
        );
      } else if (error) {
        console.error(`\n[Vite Dev Server Error] Failed to bind server: ${error.message || String(error)}\n`);
      }
    });
  },
});

/**
 * Safe server configuration wrapper ensuring port 3000 constraints are enforced with error boundaries.
 */
const createServerConfig = () => {
  const allowedHosts = process.env.VITE_ALLOWED_HOSTS
    ? process.env.VITE_ALLOWED_HOSTS.split(',').map((h) => h.trim()).filter(Boolean)
    : ['localhost', '127.0.0.1', '.googleusercontent.com', '.run.app'];
  try {
    return {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
      allowedHosts,
      cors: false,
      // HMR is disabled via DISABLE_HMR env var during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    };
  } catch (error) {
    console.error('[Vite Config Error] Failed to initialize server configuration:', error);
    return {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
      allowedHosts,
      cors: false,
    };
  }
};

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), portConflictHandlerPlugin()],
    define: {
      global: 'globalThis',
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'lucide-react',
        'exceljs',
        'canvas-confetti',
        '@tanstack/react-query',
        'zustand',
        'zod',
        'bcryptjs',
      ],
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
      conditions: ['import', 'module', 'browser', 'default'],
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 1200,
    },
    server: createServerConfig(),
  };
});
