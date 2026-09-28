import { describe, expect, it, vi } from 'vitest'
import { VENTANA_BORRADO_MS, enviarComunicado, sePuedeBorrar, tiempoParaBorrar } from './comunicados.js'

const HORA = 60 * 60 * 1000
const PUBLICADO = new Date('2026-09-26T10:00:00Z').getTime()
const EMISOR = { username: 'entrenador_rugby' }
const OTRO_USUARIO = { username: 'entrenador_hockey' }

const mensajeDe = (emisor) => ({ emisor, fecha: new Date(PUBLICADO).toISOString() })

describe('sePuedeBorrar', () => {
  it.each([
    ['1h', true, HORA],
    ['23h59m', true, VENTANA_BORRADO_MS - 60 * 1000],
    ['justo 24h', true, VENTANA_BORRADO_MS], // borde: igual que el backend, justo 24 hs todavía se puede
    ['24h y 1s', false, VENTANA_BORRADO_MS + 1000],
  ])('al emisor, con %s de antigüedad → %s', (_caso, esperado, antiguedad) => {
    // Arrange
    const mensaje = mensajeDe(EMISOR)

    // Act
    const resultado = sePuedeBorrar(mensaje, EMISOR, PUBLICADO + antiguedad)

    // Assert
    expect(resultado).toBe(esperado)
  })

  it('no deja borrar el mensaje de otro usuario, aunque sea reciente', () => {
    const mensaje = mensajeDe(EMISOR)

    const resultado = sePuedeBorrar(mensaje, OTRO_USUARIO, PUBLICADO + HORA)

    expect(resultado).toBe(false)
  })

  it.each([
    ['sin usuario logueado', mensajeDe(EMISOR), null],
    ['un mensaje sin emisor', mensajeDe(null), EMISOR],
    ['un mensaje sin emisor y sin usuario', mensajeDe(null), null],
    ['una fecha inválida', { emisor: EMISOR, fecha: 'no-es-una-fecha' }, EMISOR],
  ])('con datos incompletos (%s) no muestra el botón', (_caso, mensaje, usuario) => {
    const resultado = sePuedeBorrar(mensaje, usuario, PUBLICADO + HORA)

    expect(resultado).toBe(false)
  })
})

describe('enviarComunicado', () => {
  it('hace el POST a la ruta de comunicados con título y mensaje, sin foto si no hay', async () => {
    // Arrange: el doble reemplaza a axios; no sale nada a la red
    const cliente = { post: vi.fn().mockResolvedValue({ status: 201 }) }

    // Act
    await enviarComunicado({ titulo: 'Entrenamiento', mensaje: 'Mañana 18:30', foto: null }, cliente)

    // Assert: verificamos QUÉ le pidió al cliente, no lo que devolvió
    expect(cliente.post).toHaveBeenCalledOnce()
    const [ruta, datos] = cliente.post.mock.calls[0]
    expect(ruta).toBe('/divisiones/mensajes/')
    expect(datos.get('titulo')).toBe('Entrenamiento')
    expect(datos.get('mensaje')).toBe('Mañana 18:30')
    expect(datos.has('foto')).toBe(false)
  })

  it('adjunta la foto cuando hay una', async () => {
    const cliente = { post: vi.fn().mockResolvedValue({ status: 201 }) }
    const foto = new File(['imagen'], 'cancha.jpg', { type: 'image/jpeg' })

    await enviarComunicado({ titulo: 'Partido', mensaje: 'Sábado', foto }, cliente)

    const [, datos] = cliente.post.mock.calls[0]
    expect(datos.get('foto').name).toBe('cancha.jpg')
  })

  it('propaga el error si la API rechaza el envío', async () => {
    const cliente = { post: vi.fn().mockRejectedValue(new Error('Request failed with status code 400')) }

    await expect(
      enviarComunicado({ titulo: 'Aviso', mensaje: 'Cuarto del día', foto: null }, cliente)
    ).rejects.toThrow('400')
  })
})

// Un test por camino de tiempoParaBorrar. `ahora` entra por parámetro: no depende del reloj.
describe('tiempoParaBorrar', () => {
  const mensaje = { fecha: new Date(PUBLICADO).toISOString() }
  const MINUTO = 60 * 1000

  it('devuelve null si la fecha del mensaje es inválida', () => {
    expect(tiempoParaBorrar({ fecha: 'no-es-una-fecha' }, PUBLICADO)).toBeNull()
  })

  it('devuelve null si la ventana de 24 hs ya venció', () => {
    expect(tiempoParaBorrar(mensaje, PUBLICADO + VENTANA_BORRADO_MS + 1)).toBeNull()
  })

  it('cuenta en horas mientras falte al menos una hora', () => {
    // publicado hace 20 h 30 min → quedan 3 h 30 min → se redondea para abajo
    expect(tiempoParaBorrar(mensaje, PUBLICADO + 20 * HORA + 30 * MINUTO)).toBe('quedan 3 h')
  })

  it('pasa a minutos en la última hora', () => {
    expect(tiempoParaBorrar(mensaje, PUBLICADO + VENTANA_BORRADO_MS - 12 * MINUTO)).toBe('quedan 12 min')
  })

  it('avisa cuando queda menos de un minuto (incluido el borde exacto de 24 hs)', () => {
    expect(tiempoParaBorrar(mensaje, PUBLICADO + VENTANA_BORRADO_MS)).toBe('queda menos de un minuto')
  })
})
