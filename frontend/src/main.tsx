import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { applyTheme, useThemeStore } from './store/theme'

// 첫 페인트 전에 테마를 반영해 라이트/다크가 번쩍이지 않게 한다
applyTheme(useThemeStore.getState().mode)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
