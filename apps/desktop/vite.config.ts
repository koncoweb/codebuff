import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  // Tauri 2.0 compatibility settings
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true, // Tauri requires fixed port
    host: true,
    watch: {
      // Ignore Rust source files — Tauri handles its own reload
      ignored: ['**/src-tauri/**'],
    },
  },

  // Tauri env prefix support
  envPrefix: ['VITE_', 'TAURI_ENV_*'],

  build: {
    // WebView2 (Windows) = Chromium 105+
    target: 'chrome105',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      // @codebuff/sdk imports node:module and other Node builtins — only used
      // in the sidecar process, not the browser bundle. Externalizing prevents
      // the production build from breaking.
      external: ['@codebuff/sdk', '@codebuff/common', '@codebuff/agent-runtime'],
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
