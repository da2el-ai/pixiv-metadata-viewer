import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // 既存のファイルを削除しない
    sourcemap: true,
    rollupOptions: {
      input: {
        'meta-badge': resolve(__dirname, 'src/scss/meta-badge.scss'),
        'meta-panel': resolve(__dirname, 'src/scss/meta-panel.scss')
      },
      output: {
        assetFileNames: '[name].[ext]'
      }
    }
  }
});
