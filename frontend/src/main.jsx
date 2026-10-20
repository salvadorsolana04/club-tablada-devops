import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Sentry: los errores del navegador, las visitas y lo que tarda cada pantalla. El DSN del front
// va escrito acá a propósito: sólo sirve para ENVIAR datos (no para leerlos), y de todos modos
// viaja en el JavaScript que baja cualquier navegador. No es un secreto.
// environment = el sitio desde el que se usa (QA, producción, preprod); en local queda apagado.
Sentry.init({
  dsn: 'https://e6185e1e8700dd75d21ab43b8dd9435e@o4512290616311808.ingest.us.sentry.io/4512290654191616',
  environment: window.location.hostname,
  enabled: !['localhost', '127.0.0.1'].includes(window.location.hostname),
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
