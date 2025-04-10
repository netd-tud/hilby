import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path, { resolve } from 'path'
import dts from 'vite-plugin-dts'
import { libInjectCss } from 'vite-plugin-lib-inject-css'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    libInjectCss(),
    dts({ include: ['lib'],        
      rollupTypes: true,
      tsconfigPath: "./tsconfig.app.json",
      insertTypesEntry: true,
  })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'lib/main.ts'),
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime'],
    },

    copyPublicDir: false,
    sourcemap: true,
  },
  resolve: {
    alias: {
      'hipp': path.resolve(__dirname, './dist/hipp.js') // This unifies the path to the library for both dev and production builds
    }
  }
})
