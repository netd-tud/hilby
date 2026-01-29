import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  root: 'playground',
  build: {
    outDir: '../dist-playground',
    emptyOutDir: true,
    rollupOptions: {
        input: {
            main: resolve(__dirname, 'playground/index.html'),
        }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
