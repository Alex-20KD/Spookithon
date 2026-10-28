import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En producción el juego se sirve bajo /juego/ (CloudFront + S3). En local
// (dev) se sirve en la raíz de localhost:3000. Por eso 'base' es condicional.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/juego/' : '/',
  plugins: [react()],
  server: {
    port: 3000,
    // El asesor con IA corre en server/ (puerto 8787). Si no está encendido, el juego usa el asesor local.
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
}))
