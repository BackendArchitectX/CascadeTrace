import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        history: resolve(rootDir, 'history.html'),
      },
    },
  },
})
