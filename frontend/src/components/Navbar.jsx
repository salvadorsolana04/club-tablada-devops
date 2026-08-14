import { Newspaper, LogOut, ShieldCheck, User, Megaphone } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo-tablada.png'

const TABS = [
  { to: '/', label: 'Feed de Noticias', icon: Newspaper },
  { to: '/division', label: 'Mi División', icon: User },
]

const ROLE_META = {
  jugador: { label: 'Jugador', icon: User },
  entrenador: { label: 'Entrenador', icon: Megaphone },
  admin: { label: 'Administrador', icon: ShieldCheck },
}

export default function Navbar() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const role = ROLE_META[usuario?.rol] ?? ROLE_META.jugador
  const RoleIcon = role.icon

  const cerrarSesion = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="sticky top-0 z-20 bg-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.06)]">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[9px] bg-white p-[3px]">
            <img src={logo} alt="Escudo Club La Tablada" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="whitespace-nowrap text-[15px] font-extrabold text-white">
              Club La Tablada
            </div>
            <div className="whitespace-nowrap text-[10.5px] font-medium tracking-wide text-sky-300">
              RUGBY &amp; HOCKEY
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-[10px] bg-white/5 p-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  isActive ? 'bg-sky-600 text-white' : 'text-slate-300 hover:text-white'
                }`
              }
            >
              <tab.icon size={15} strokeWidth={2.2} className="flex-none" />
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="flex flex-none items-center gap-3">
          <div className="flex items-center gap-2 rounded-[9px] border border-white/10 bg-white/[0.08] px-2.5 py-1.5">
            <RoleIcon size={15} strokeWidth={2.2} className="flex-none text-sky-300" />
            <div className="min-w-0 whitespace-nowrap leading-tight">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                {usuario?.username}
              </div>
              <div className="text-[12.5px] font-semibold text-white">{role.label}</div>
            </div>
          </div>
          <button
            onClick={cerrarSesion}
            className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-white/10 px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-white/20"
          >
            <LogOut size={14} strokeWidth={2.2} />
            Salir
          </button>
        </div>
      </div>
    </nav>
  )
}
