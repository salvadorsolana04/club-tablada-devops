import { expect, test } from '@playwright/test'

// Integración: la api DESPLEGADA con su base de verdad, sin navegador y sin ningún doble.
// API_BASE_URL es la api (no el front), sin barra al final.
const API = `${process.env.API_BASE_URL || 'http://localhost:8000'}/api/v1`
const MENSAJES = `${API}/divisiones/mensajes/`
const ENTRENADOR = process.env.E2E_USER_ENTRENADOR || 'e2e-entrenador'
const PASSWORD = process.env.E2E_PASSWORD_ENTRENADOR

let auth // { Authorization: 'Bearer …' } del entrenador de prueba
const creados = new Set() // ids que crea cada test: se borran aunque el test falle

test.beforeAll(async ({ request }) => {
  expect(PASSWORD, 'falta E2E_PASSWORD_ENTRENADOR').toBeTruthy()
  const r = await request.post(`${API}/auth/token/`, {
    data: { username: ENTRENADOR, password: PASSWORD },
  })
  expect(r.status(), 'login del entrenador de prueba').toBe(200)
  auth = { Authorization: `Bearer ${(await r.json()).access}` }
})

test.afterEach(async ({ request }) => {
  for (const id of creados) await request.delete(`${MENSAJES}${id}/`, { headers: auth })
  creados.clear()
})

async function listar(request) {
  const r = await request.get(MENSAJES, { headers: auth })
  expect(r.status()).toBe(200)
  return await r.json()
}

async function crear(request, titulo) {
  return await request.post(MENSAJES, {
    headers: auth,
    data: { titulo, mensaje: 'Generado por la suite de integración' },
  })
}

test('el alta guarda en la base de verdad, y el borrado la saca', async ({ request }) => {
  const titulo = `api alta ${Date.now()}` // único: no choca con otra corrida
  const alta = await crear(request, titulo)
  expect(alta.status()).toBe(201)
  const creado = await alta.json()
  creados.add(creado.id)
  expect(creado.division).toBe('E2E') // la api le puso la división de quien lo mandó

  expect((await listar(request)).some((m) => m.titulo === titulo)).toBe(true) // lo devuelve la BASE

  const borrado = await request.delete(`${MENSAJES}${creado.id}/`, { headers: auth })
  expect(borrado.status()).toBe(204)
  creados.delete(creado.id)

  expect((await listar(request)).some((m) => m.titulo === titulo)).toBe(false) // y el borrado, comprobado
})

test('un título vacío lo rechaza la api, y no crea nada', async ({ request }) => {
  const antes = await listar(request)

  const alta = await crear(request, '')
  expect(alta.status()).toBe(400) // el contrato del error
  expect(await alta.json()).toHaveProperty('titulo') // y dice qué campo está mal

  expect((await listar(request)).length).toBe(antes.length) // de verdad no se creó nada
})

test('el límite de 3 comunicados por día lo cuenta la base: el cuarto se rechaza', async ({
  request,
}) => {
  // En el TP5 esta regla se probó con un doble que contestaba «ya mandó 3». Acá cuenta la
  // base de verdad, con su fecha y su zona horaria: si el conteo no encontrara los 3 de hoy,
  // el cuarto pasaría y esta prueba se pondría roja.
  const sello = Date.now()
  for (let i = 1; i <= 3; i++) {
    const alta = await crear(request, `api limite ${sello} #${i}`)
    expect(alta.status(), `el comunicado ${i} de 3 tiene que entrar`).toBe(201)
    creados.add((await alta.json()).id)
  }

  const cuarto = await crear(request, `api limite ${sello} #4`)
  expect(cuarto.status()).toBe(400)
  expect(JSON.stringify(await cuarto.json())).toContain('límite') // el motivo es el límite, no otro

  for (const id of creados) {
    const r = await request.delete(`${MENSAJES}${id}/`, { headers: auth })
    expect(r.status()).toBe(204)
  }
  creados.clear()
  const quedan = (await listar(request)).filter((m) => m.titulo.startsWith(`api limite ${sello}`))
  expect(quedan).toHaveLength(0) // el cuarto no se creó, y los tres se borraron
})
