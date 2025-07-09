import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import path from 'path'

// Get the directory path
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    // keep dist/ from the main build – don't wipe it
    emptyOutDir: false,
    outDir: 'dist',
    // entry file for your content-script
    lib: {
      entry: path.resolve(__dirname, 'src/content-script/index.ts'),
      name: 'ContentScript',
      formats: ['iife']            // <- strip import/export
    },
    rollupOptions: {
      output: {
        entryFileNames: 'content-script.js',
        inlineDynamicImports: true // avoid runtime chunks
      }
    }
  }
}) 