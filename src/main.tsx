import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './i18n.tsx'
import { LanguageSwitcher } from './components/LanguageSwitcher.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
      <LanguageSwitcher />
    </LanguageProvider>
  </StrictMode>,
)
