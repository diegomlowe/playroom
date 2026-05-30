import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import stdLibBrowser from 'vite-plugin-node-stdlib-browser';

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  optimizeDeps: {
    include: [
      '@pooflabs/web',
      '@privy-io/react-auth',
      '@privy-io/react-auth/solana',
      '@solana-program/system',
      '@solana-program/memo',
      '@solana-program/token',
      '@solana/kit',
    ],
  },
  build: {
    outDir: 'dist',
    minify: true,
    sourcemap: false,
    reportCompressedSize: false,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 1500,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  plugins: [react(), stdLibBrowser()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tarobase/js-sdk': '@pooflabs/web',
      '@tarobase/server': '@pooflabs/server',
      '@tarobase/core': '@pooflabs/core',
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react-dom/client': path.resolve(__dirname, 'node_modules/react-dom/client'),
    },
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  server: {
    port: 3001,
    allowedHosts: true,
    historyApiFallback: true,
  },
});
