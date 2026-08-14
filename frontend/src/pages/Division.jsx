import { ClipboardList, ImagePlus, Send, Trash2, User, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../api/axios'
import logo from '../assets/logo-tablada.png'
import { useAuth } from '../context/AuthContext'

const VENTANA_BORRADO_MS = 24 * 60 * 60 * 1000

function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sePuedeBorrar(mensaje, usuario) {
  if (mensaje.emisor?.username !== usuario?.username) return false
  return Date.now() - new Date(mensaje.fecha).getTime() < VENTANA_BORRADO_MS
}

export default function Division() {
  const { usuario } = useAuth()
  const [mensajes, setMensajes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [titulo, setTitulo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [foto, setFoto] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [borrandoId, setBorrandoId] = useState(null)
  const [errorBorrado, setErrorBorrado] = useState('')

  const cargarMensajes = async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/divisiones/mensajes/')
      setMensajes(data)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarMensajes()
  }, [])

  const handleFotoChange = (e) => {
    const file = e.target.files[0] ?? null
    setFoto(file)
    setFotoPreview(file ? URL.createObjectURL(file) : null)
  }

  const quitarFoto = () => {
    setFoto(null)
    setFotoPreview(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const formData = new FormData()
      formData.append('titulo', titulo)
      formData.append('mensaje', mensaje)
      if (foto) formData.append('foto', foto)
      await api.post('/divisiones/mensajes/', formData)
      setTitulo('')
      setMensaje('')
      quitarFoto()
      await cargarMensajes()
    } catch {
      setError('No se pudo enviar el comunicado.')
    } finally {
      setEnviando(false)
    }
  }

  const handleDelete = async (id) => {
    setErrorBorrado('')
    setBorrandoId(id)
    try {
      await api.delete(`/divisiones/mensajes/${id}/`)
      await cargarMensajes()
    } catch {
      setErrorBorrado('No se pudo borrar el comunicado.')
    } finally {
      setBorrandoId(null)
    }
  }

  if (!usuario?.deporte || !usuario?.division) {
    return (
      <p className="text-slate-500">
        Todavía no tenés un deporte y división asignados. Contactá a un administrador.
      </p>
    )
  }

  return (
    <div>
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-7 shadow-[0_10px_28px_-10px_rgba(15,23,42,0.5)]">
        <div className="pointer-events-none absolute -right-7 -top-7 h-[150px] w-[150px] rounded-full bg-sky-600/25" />
        <div className="relative flex flex-wrap items-center gap-3.5">
          <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[13px] bg-white p-1.5">
            <img src={logo} alt="Escudo Club La Tablada" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-sky-300">
              Mi División
            </div>
            <div className="text-[21px] font-extrabold capitalize text-white">
              {usuario.deporte} &middot; {usuario.division}
            </div>
          </div>
        </div>
      </div>

      {usuario?.rol === 'entrenador' && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList size={16} strokeWidth={2.2} className="text-sky-600" />
            <span className="text-sm font-bold text-slate-900">
              Enviar Comunicado a la División
            </span>
            <span className="ml-auto rounded-full bg-sky-100 px-2.5 py-1 text-[10.5px] font-bold text-sky-600">
              SOLO ENTRENADOR
            </span>
          </div>

          {error && <p className="mb-3 text-[13px] font-medium text-red-600">{error}</p>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título del comunicado"
              required
              className="w-full rounded-[9px] border-[1.5px] border-slate-200 px-3.5 py-2.5 font-sans text-sm text-slate-900 outline-none focus:border-sky-500"
            />
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Ej: Recuerden que mañana el entrenamiento es a las 18:30 en cancha 2..."
              rows={3}
              required
              className="w-full resize-y rounded-[9px] border-[1.5px] border-slate-200 px-3.5 py-2.5 font-sans text-sm text-slate-900 outline-none focus:border-sky-500"
            />

            {fotoPreview ? (
              <div className="relative w-fit">
                <img
                  src={fotoPreview}
                  alt="Vista previa"
                  className="h-32 rounded-[9px] border border-slate-200 object-cover"
                />
                <button
                  type="button"
                  onClick={quitarFoto}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white shadow"
                >
                  <X size={13} strokeWidth={2.4} />
                </button>
              </div>
            ) : (
              <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-[9px] border-[1.5px] border-dashed border-slate-300 px-3.5 py-2 text-[12.5px] font-semibold text-slate-500 hover:border-sky-400 hover:text-sky-600">
                <ImagePlus size={15} strokeWidth={2.2} />
                Agregar foto (opcional)
                <input type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
              </label>
            )}

            <div className="mt-1 flex justify-end">
              <button
                type="submit"
                disabled={enviando}
                className="flex items-center gap-1.5 rounded-[9px] bg-slate-900 px-[18px] py-2.5 text-[13px] font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <Send size={13} strokeWidth={2.3} />
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-3.5 text-[12.5px] font-bold uppercase tracking-wide text-slate-500">
        Comunicados recientes
      </div>

      {errorBorrado && (
        <p className="mb-3 text-[13px] font-medium text-red-600">{errorBorrado}</p>
      )}

      {cargando ? (
        <p className="text-slate-500">Cargando mensajes...</p>
      ) : mensajes.length === 0 ? (
        <p className="text-slate-500">Todavía no hay comunicados para tu división.</p>
      ) : (
        <div className="relative pl-6">
          <div className="absolute bottom-1.5 left-1.5 top-1.5 w-0.5 bg-slate-200" />
          {mensajes.map((m) => (
            <div key={m.id} className="relative pb-5">
              <div className="absolute -left-[26px] top-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-sky-600 bg-white" />
              <div className="rounded-xl border border-slate-200 bg-white p-4 px-[18px] shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-sky-100">
                    <User size={13} strokeWidth={2.4} className="text-sky-700" />
                  </div>
                  <span className="text-[13px] font-bold text-slate-900">
                    {m.emisor?.username}
                  </span>
                  <span className="ml-auto text-[11px] text-slate-400">
                    {formatFecha(m.fecha)}
                  </span>
                  {sePuedeBorrar(m, usuario) && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      disabled={borrandoId === m.id}
                      title="Borrar comunicado"
                      className="flex-none text-slate-400 transition hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 size={14} strokeWidth={2.2} />
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-slate-600">
                  {m.mensaje}
                </p>
                {m.foto && (
                  <img
                    src={m.foto}
                    alt={m.titulo}
                    className="mt-3 max-h-72 w-full rounded-[9px] border border-slate-200 object-cover"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
