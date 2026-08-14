import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import Division from './pages/Division'
import Feed from './pages/Feed'
import Login from './pages/Login'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Feed />} />
            <Route path="/division" element={<Division />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
