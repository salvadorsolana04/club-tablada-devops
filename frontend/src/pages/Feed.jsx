import { ArrowRight, BadgeCheck, Calendar, ImagePlus, Megaphone, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function Feed() {
  const { usuario } = useAuth()
  const [noticias, setNoticias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [foto, setFoto] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [error, setError] = useState('')
  const [publicando, setPublicando] = useState(false)

  const cargarNoticias = async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/noticias/')
      setNoticias(data)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarNoticias()
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
    setPublicando(true)
    try {
      const formData = new FormData()
      formData.append('titulo', titulo)
      formData.append('contenido', contenido)
      if (foto) formData.append('foto', foto)
      await api.post('/noticias/', formData)
      setTitulo('')
      setContenido('')
      quitarFoto()
      await cargarNoticias()
    } catch {
      setError('No se pudo publicar la noticia.')
    } finally {
      setPublicando(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-1.5 text-[26px] font-extrabold text-slate-900">
          Novedades del Club
        </h1>
        <p className="text-sm text-slate-500">
          Comunicados oficiales, resultados y actividades de Club La Tablada.
        </p>
      </div>

      {usuario?.rol === 'admin' && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900">
              <Megaphone size={15} strokeWidth={2.2} className="text-sky-300" />
            </div>
            <span className="text-[14.5px] font-bold text-slate-900">
              Publicar Noticia Oficial
            </span>
            <span className="ml-auto rounded-full bg-sky-100 px-2.5 py-1 text-[10.5px] font-bold text-sky-600">
              SOLO ADMIN
            </span>
          </div>

          {error && <p className="mb-3 text-[13px] font-medium text-red-600">{error}</p>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título de la noticia"
              required
              className="w-full rounded-[9px] border-[1.5px] border-slate-200 px-3.5 py-2.5 font-sans text-sm text-slate-900 outline-none focus:border-sky-500"
            />
            <textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              placeholder="Contenido de la noticia..."
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
                disabled={publicando}
                className="flex items-center gap-1.5 rounded-[9px] bg-sky-600 px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-sky-700 disabled:opacity-60"
              >
                <Send size={14} strokeWidth={2.3} />
                {publicando ? 'Publicando...' : 'Publicar Noticia'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {cargando ? (
          <p className="text-slate-500">Cargando noticias...</p>
        ) : noticias.length === 0 ? (
          <p className="text-slate-500">Todavía no hay noticias publicadas.</p>
        ) : (
          noticias.map((noticia) => (
            <div
              key={noticia.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[10.5px] font-bold text-white">
                  <BadgeCheck size={11} strokeWidth={2.6} />
                  Comunicado Oficial
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar size={12} strokeWidth={2.2} />
                  {formatFecha(noticia.fecha_creacion)}
                </span>
              </div>
              <h3 className="mb-2 text-[16.5px] font-bold text-slate-900">{noticia.titulo}</h3>
              <p className="mb-3.5 whitespace-pre-line text-[13.5px] leading-relaxed text-slate-600">
                {noticia.contenido}
              </p>
              {noticia.foto && (
                <img
                  src={noticia.foto}
                  alt={noticia.titulo}
                  className="mb-3.5 max-h-80 w-full rounded-[10px] border border-slate-200 object-cover"
                />
              )}
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-sky-600">
                {noticia.creado_por?.username}
                <ArrowRight size={14} strokeWidth={2.4} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
