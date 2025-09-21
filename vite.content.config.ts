import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // 既存のファイルを削除しない
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'content',
      formats: ['iife'],
      fileName: () => 'content.js'
    },
    rollupOptions: {
      output: {
        // グローバル変数を設定しない
        extend: false,
        // IIFEの場合、外部依存関係をグローバル変数として扱う
        globals: {
          chrome: 'chrome'
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
