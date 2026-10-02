import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@app/App'
import { smartqBusinessRoutes } from '@pages'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App routes={smartqBusinessRoutes} />
  </StrictMode>,
)
