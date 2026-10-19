// Arma el Summary de la corrida con el resultado de una suite de Playwright: cuántos pasaron,
// fallaron, salieron flaky o se saltearon, y cada test con su estado.
// Uso (desde frontend/): node ../.github/scripts/resumen-playwright.js "<título>" >> "$GITHUB_STEP_SUMMARY"
const fs = require('node:fs')

const archivo = 'playwright-report/resultados.json'
if (!fs.existsSync(archivo)) {
  console.error(`no está ${archivo}: Playwright no llegó a terminar`)
  process.exit(1) // mejor rojo que un resumen vacío
}

const { stats, suites } = JSON.parse(fs.readFileSync(archivo, 'utf8'))
const icono = { expected: '✅', unexpected: '❌', flaky: '⚠️ flaky', skipped: '⏭️' }

const filas = []
const recorrer = (suite) => {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) filas.push(`| ${icono[t.status] ?? t.status} | ${spec.title} |`)
  }
  for (const hija of suite.suites ?? []) recorrer(hija)
}
suites.forEach(recorrer)

console.log(`### ${process.argv[2]}`)
console.log(
  `**${stats.expected} passed** · ${stats.unexpected} failed · ${stats.flaky} flaky · ` +
    `${stats.skipped} skipped — ${(stats.duration / 1000).toFixed(1)} s`,
)
console.log('')
console.log('| | test |')
console.log('|---|---|')
filas.forEach((f) => console.log(f))
