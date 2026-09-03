import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds straight into web/public, the directory the Express server already
// serves as static content (see index.js), so no server changes are needed.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: '../web/public',
    emptyOutDir: false,
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/images': 'http://localhost:8000',
      '/cache': 'http://localhost:8000',
      '/locales': 'http://localhost:8000',
    },
  },
})
