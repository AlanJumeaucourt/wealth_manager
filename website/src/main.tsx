import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Prevent flash of unstyled content
document.documentElement.classList.add('no-transitions')
window.addEventListener('load', () => {
  document.documentElement.classList.remove('no-transitions')
})

// Check for saved theme preference
const darkMode = localStorage.getItem('darkMode') === 'true'
if (darkMode) {
  document.documentElement.classList.add('dark')
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
