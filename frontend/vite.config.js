import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    coverage: {
      provider: 'v8',
      // json-summary deja coverage-summary.json: lo lee el paso del pipeline que arma el Summary
      // skipFull: false para que el log liste también los archivos al 100% (y se vea qué se midió)
      reporter: [['text', { skipFull: false }], 'html', 'lcov', 'json-summary'],
      // Qué entra en la cuenta: la lógica. Todo archivo de estas carpetas cuenta, aunque ningún test lo importe.
      include: ['src/lib/**'],
      // Umbral que rompe el build (justificado en decisiones.md)
      thresholds: { lines: 90, branches: 90 },
    },
  },
})
