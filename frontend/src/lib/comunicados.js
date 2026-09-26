// Lógica de los comunicados de división, fuera del componente para poder
// testearla sin DOM: lo que viene de afuera (la hora, el cliente HTTP) entra por parámetro.

export const VENTANA_BORRADO_MS = 24 * 60 * 60 * 1000
const HORA_MS = 60 * 60 * 1000
const MINUTO_MS = 60 * 1000

// Decide si se muestra el botón de borrar (el backend valida lo mismo en validar_borrado).
export function sePuedeBorrar(mensaje, usuario, ahora = Date.now()) {
  if (!usuario || mensaje.emisor?.username !== usuario.username) return false
  return ahora - new Date(mensaje.fecha).getTime() <= VENTANA_BORRADO_MS
}

// Cuánto le queda al emisor para borrar el comunicado, para mostrarlo en el botón.
// null si la fecha es inválida o la ventana ya venció.
export function tiempoParaBorrar(mensaje, ahora = Date.now()) {
  const publicado = new Date(mensaje?.fecha).getTime()
  if (Number.isNaN(publicado)) return null
  const restante = publicado + VENTANA_BORRADO_MS - ahora
  if (restante < 0) return null
  const horas = Math.floor(restante / HORA_MS)
  if (horas >= 1) return `quedan ${horas} h`
  const minutos = Math.floor(restante / MINUTO_MS)
  if (minutos >= 1) return `quedan ${minutos} min`
  return 'queda menos de un minuto'
}

// cliente: el que hace el POST. En la pantalla es la instancia de axios; en los tests, un doble.
export async function enviarComunicado({ titulo, mensaje, foto }, cliente) {
  const formData = new FormData()
  formData.append('titulo', titulo)
  formData.append('mensaje', mensaje)
  if (foto) formData.append('foto', foto)
  return cliente.post('/divisiones/mensajes/', formData)
}
