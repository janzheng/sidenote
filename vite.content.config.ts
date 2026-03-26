import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'url'
import path from 'path'

// Get the directory path
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [svelte()],
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
      // Exclude defuddle from the content script bundle to avoid TDZ errors
      // on heavy pages (Google Maps). Defuddle is loaded as a global via
      // a separate UMD script in manifest.json content_scripts.
      external: ['defuddle'],
      output: {
        entryFileNames: 'content-script.js',
        inlineDynamicImports: true, // avoid runtime chunks
        globals: {
          'defuddle': 'Defuddle'
        }
      }
    }
  }
}) 