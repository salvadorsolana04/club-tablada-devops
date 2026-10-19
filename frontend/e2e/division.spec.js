import { expect, test } from '@playwright/test'

// e2e: un navegador de verdad usando el front desplegado (E2E_BASE_URL), que le habla a su
// api y a su base. Nada mockeado: si el navegador no le pega a la api, no es end-to-end.
// Los usuarios de prueba viven en una división propia (rugby · E2E): lo que crean estas
// pruebas no le aparece a ningún jugador real.
const ENTRENADOR = process.env.E2E_USER_ENTRENADOR || 'e2e-entrenador'
const PASS_ENTRENADOR = process.env.E2E_PASSWORD_ENTRENADOR
const JUGADOR = process.env.E2E_USER_JUGADOR || 'e2e-jugador'
const PASS_JUGADOR = process.env.E2E_PASSWORD_JUGADOR
const MENSAJES = '/api/v1/divisiones/mensajes/' // a través del front: nginx lo pasa a la api

const creados = new Set() // títulos que crea cada test: se borran aunque el test falle

async function tokenDe(request, username, password) {
  const r = await request.post('/api/v1/auth/token/', { data: { username, password } })
  expect(r.status(), `login de ${username}`).toBe(200)
  return { Authorization: `Bearer ${(await r.json()).access}` }
}

// Limpieza por la api, y comprobada: después de esto no queda ninguno de los títulos del test.
test.afterEach(async ({ request }) => {
  if (creados.size === 0) return
  const auth = await tokenDe(request, ENTRENADOR, PASS_ENTRENADOR)
  const lista = await (await request.get(MENSAJES, { headers: auth })).json()
  for (const m of lista.filter((m) => creados.has(m.titulo))) {
    await request.delete(`${MENSAJES}${m.id}/`, { headers: auth })
  }
  const despues = await (await request.get(MENSAJES, { headers: auth })).json()
  expect(despues.filter((m) => creados.has(m.titulo))).toHaveLength(0)
  creados.clear()
})

// Entra como lo hace una persona: el formulario de login y el link de la barra.
async function entrarAMiDivision(page, usuario, password) {
  expect(password, `falta la contraseña de ${usuario}`).toBeTruthy()
  await page.goto('/login')
  await page.getByLabel('Usuario / DNI').fill(usuario)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await page.getByRole('link', { name: 'Mi División' }).click()
  await expect(page.getByText('rugby · E2E')).toBeVisible()
}

test('el entrenador publica un comunicado, lo ve en su división, lo borra y ya no está', async ({
  page,
}) => {
  const titulo = `e2e crear ${Date.now()}` // único: no choca con otra corrida
  creados.add(titulo)
  await entrarAMiDivision(page, ENTRENADOR, PASS_ENTRENADOR)

  await page.getByLabel('Título del comunicado').fill(titulo)
  await page.getByLabel('Mensaje del comunicado').fill('Comunicado de prueba de la suite e2e')
  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible() // el dato que ESTE test creó

  await page.getByRole('button', { name: `Borrar ${titulo}` }).click()
  await expect(page.getByRole('heading', { name: titulo })).toHaveCount(0) // y el borrado, comprobado
})

test('un título de más de 200 caracteres: el usuario ve el error y no se crea nada', async ({
  page,
  request,
}) => {
  const titulo = `e2e largo ${Date.now()} ${'x'.repeat(200)}` // pasa el máximo del modelo (200)
  creados.add(titulo)
  await entrarAMiDivision(page, ENTRENADOR, PASS_ENTRENADOR)

  await page.getByLabel('Título del comunicado').fill(titulo)
  await page.getByLabel('Mensaje del comunicado').fill('Este comunicado no debería publicarse')
  const respuesta = page.waitForResponse(
    (r) => r.url().includes(MENSAJES) && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
  expect((await respuesta).status()).toBe(400) // lo rechazó la api de verdad, no el navegador

  await expect(page.getByRole('alert')).toHaveText('No se pudo enviar el comunicado.') // el usuario lo ve

  const auth = await tokenDe(request, ENTRENADOR, PASS_ENTRENADOR)
  const lista = await (await request.get(MENSAJES, { headers: auth })).json()
  expect(lista.some((m) => m.titulo === titulo)).toBe(false) // y en la base no hay nada
})

// El de todos los días: el entrenador avisa algo y el jugador lo lee en Mi División.
// Si mañana esto no anda, el que escribe es el jugador que no se enteró del entrenamiento.
test('el jugador entra a Mi División y ve el comunicado que le mandó su entrenador', async ({
  page,
  request,
}) => {
  const sello = Date.now()
  const titulo = `e2e jugador ${sello}`
  const mensaje = `Mañana entrenamiento 18:30 en cancha 2 (${sello})`
  creados.add(titulo)
  const auth = await tokenDe(request, ENTRENADOR, PASS_ENTRENADOR)
  const alta = await request.post(MENSAJES, { headers: auth, data: { titulo, mensaje } })
  expect(alta.status()).toBe(201)

  await entrarAMiDivision(page, JUGADOR, PASS_JUGADOR)
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible()
  await expect(page.getByText(mensaje)).toBeVisible()
  // y como no es suyo, no le aparece el botón de borrarlo
  await expect(page.getByRole('button', { name: `Borrar ${titulo}` })).toHaveCount(0)
})
