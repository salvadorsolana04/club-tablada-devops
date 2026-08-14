import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargarPerfil = async () => {
    try {
      const { data } = await api.get('/perfil/')
      setUsuario(data)
    } catch {
      setUsuario(null)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (localStorage.getItem('access_token')) {
      cargarPerfil()
    } else {
      setCargando(false)
    }
  }, [])

  const login = async (username, password) => {
    const { data } = await api.post('/auth/token/', { username, password })
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    await cargarPerfil()
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
