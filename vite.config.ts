import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
        'meta-badge': resolve(__dirname, 'src/scss/meta-badge.scss'),
        'meta-panel': resolve(__dirname, 'src/scss/meta-panel.scss')
      },
      output: [
        // content script 用 (IIFE)
        {
          format: 'iife',
          entryFileNames: chunk => (chunk.name === 'content' ? 'content.js' : '[name].js'),
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
          dir: 'dist'
        },
        // background 用 (ESM)
        {
          format: 'es',
          entryFileNames: chunk => (chunk.name === 'background' ? 'background.js' : '[name].js'),
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
          dir: 'dist'
        }
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
});
