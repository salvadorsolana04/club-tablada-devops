import { defineConfig } from '@playwright/test'

// Las dos suites corren contra un entorno DESPLEGADO, nunca contra un doble:
//   e2e/api.spec.js      → integración: pedidos HTTP a la api (API_BASE_URL), sin navegador
//   e2e/division.spec.js → e2e: un Chromium de verdad usando el front (E2E_BASE_URL)
// Cada job del pipeline corre su archivo por nombre.
export default defineConfig({
  testDir: './e2e',
  // QA es uno solo y el límite de 3 comunicados diarios se cuenta en su base: dos pruebas
  // creando a la vez se pisarían el conteo. Una por vez.
  workers: 1,
  timeout: 60_000, // tope de CADA test: el free tier puede tardar en contestar
  expect: { timeout: 15_000 }, // tope de CADA aserción (el default es 5 s)
  retries: 1, // absorbe una demora suelta; si un test pasa recién al reintentar, sale «flaky»
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000', // el FRONT
    trace: 'on-first-retry', // la traza se graba en el reintento de un fallo
    screenshot: 'only-on-failure',
  },
  // html: el reporte navegable (screenshot + traza); json: lo lee el pipeline para el Summary
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'playwright-report/resultados.json' }],
    ['list'],
  ],
})
