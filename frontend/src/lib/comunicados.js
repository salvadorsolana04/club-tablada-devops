// Lógica de los comunicados de división, fuera del componente para poder
// testearla sin DOM: lo que viene de afuera (la hora, el cliente HTTP) entra por parámetro.

export const VENTANA_BORRADO_MS = 24 * 60 * 60 * 1000

// Decide si se muestra el botón de borrar (el backend valida lo mismo en validar_borrado).
export function sePuedeBorrar(mensaje, usuario, ahora = Date.now()) {
  if (!usuario || mensaje.emisor?.username !== usuario.username) return false
  return ahora - new Date(mensaje.fecha).getTime() <= VENTANA_BORRADO_MS
}

// cliente: el que hace el POST. En la pantalla es la instancia de axios; en los tests, un doble.
export async function enviarComunicado({ titulo, mensaje, foto }, cliente) {
  const formData = new FormData()
  formData.append('titulo', titulo)
  formData.append('mensaje', mensaje)
  if (foto) formData.append('foto', foto)
  return cliente.post('/divisiones/mensajes/', formData)
}
