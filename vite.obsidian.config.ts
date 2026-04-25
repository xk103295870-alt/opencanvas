import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-obsidian',
    emptyOutDir: true,
    lib: {
      entry: 'src/obsidian-plugin.tsx',
      formats: ['cjs'],
      fileName: () => 'main.js',
      cssFileName: 'styles',
    },
    rollupOptions: {
      external: ['obsidian', 'electron', '@codemirror/autocomplete', '@codemirror/collab', '@codemirror/commands', '@codemirror/language', '@codemirror/lint', '@codemirror/search', '@codemirror/state', '@codemirror/view', '@lezer/common', '@lezer/highlight', '@lezer/lr'],
      output: {
        assetFileNames: (assetInfo) => (assetInfo.names?.includes('style.css') ? 'styles.css' : '[name][extname]'),
        exports: 'default',
      },
    },
  },
})
