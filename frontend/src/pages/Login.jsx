import { ArrowRight, Lock, User } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import logo from '../assets/logo-tablada.png'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { usuario, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (usuario) {
    return <Navigate to={location.state?.from ?? '/'} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await login(username, password)
      navigate('/')
    } catch {
      setError('Usuario o contraseña incorrectos.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 py-12"
      style={{ background: 'radial-gradient(circle at 50% 0%, #eef2f7 0%, #f8fafc 55%)' }}
    >
      <div className="w-full max-w-[400px] rounded-[18px] border border-slate-200 bg-white p-9 px-9 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.18)]">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-white p-1.5 shadow-[0_8px_20px_-6px_rgba(2,132,199,0.5)]">
            <img src={logo} alt="Escudo Club La Tablada" className="h-full w-full object-contain" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">Club La Tablada</div>
          <div className="mt-1 text-[13px] text-slate-500">
            Portal de socios &middot; Rugby y Hockey
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-700">
              {error}
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Usuario / DNI
            </label>
            <div className="flex items-center gap-2.5 rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <User size={16} strokeWidth={2} className="flex-none text-slate-400" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: 34.567.890"
                autoComplete="username"
                required
                className="w-full border-none bg-transparent font-sans text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Contraseña
            </label>
            <div className="flex items-center gap-2.5 rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <Lock size={16} strokeWidth={2} className="flex-none text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full border-none bg-transparent font-sans text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="mt-0.5 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" className="accent-sky-600" /> Recordarme
            </label>
            <a href="#" className="text-xs font-semibold text-sky-600 hover:text-sky-700">
              ¿Olvidaste tu clave?
            </a>
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="mt-1.5 flex items-center justify-center gap-2 rounded-[10px] border-none bg-gradient-to-br from-blue-900 to-slate-900 py-3.5 text-[14.5px] font-bold text-white shadow-[0_6px_16px_-4px_rgba(15,23,42,0.4)] transition hover:opacity-90 disabled:opacity-60"
          >
            {enviando ? 'Ingresando...' : 'Iniciar Sesión'}
            <ArrowRight size={16} strokeWidth={2.4} />
          </button>
        </form>
      </div>
    </div>
  )
}
