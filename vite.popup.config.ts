import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.ts'),
      },
      output: {
        entryFileNames: 'popup.js',
        format: 'iife',
      },
    },
  },
});
