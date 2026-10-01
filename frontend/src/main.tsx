import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initThemeFromStorage } from './lib/theme'
import './index.css'

initThemeFromStorage()
import '../../packages/artifact-ui/src/styles.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
