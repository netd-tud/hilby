import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        playground: resolve(__dirname, 'playground/index.html'),
      },
      output: {
        dir: "pages",
      },
    },
    cssMinify: false
  },
  optimizeDeps: {
    exclude: []
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  base: "./"
})