# Club La Tablada — Frontend

SPA en React 19 + Vite que consume la API del backend Django.

## Desarrollo

```bash
npm install
cp .env.example .env
npm run dev
```

## Build de producción

```bash
npm run build
```

## Estructura

- `src/api/axios.js` — cliente Axios con interceptor JWT.
- `src/context/AuthContext.jsx` — sesión del usuario (login/logout, perfil).
- `src/pages/` — `Login.jsx`, `Feed.jsx`, `Division.jsx`.
- `src/components/` — `Navbar.jsx`, `ProtectedRoute.jsx`.
