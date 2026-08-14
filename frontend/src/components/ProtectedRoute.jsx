import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from './Navbar'

export default function ProtectedRoute() {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return <div className="p-8 text-center text-slate-500">Cargando...</div>
  }

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-[820px] flex-1 px-6 pb-16 pt-9">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 px-6 py-4 text-center text-[11.5px] text-slate-400">
        Club La Tablada &middot; Rugby &amp; Hockey Córdoba
      </footer>
    </div>
  )
}
