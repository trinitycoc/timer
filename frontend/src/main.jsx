import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { CWLProvider } from './contexts/CWLContext'
import { AuthProvider } from './contexts/AuthContext'
import { registerSW } from 'virtual:pwa-register'

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    // Service worker found a new version - user can refresh
    console.log('New version available - refresh to update')
  },
  onOfflineReady() {
    // Service worker is ready for offline use
    console.log('App ready to work offline')
  },
  onRegistered(registration) {
    // Service worker registered
    console.log('Service worker registered:', registration)
  },
  onRegisterError(error) {
    // Service worker registration failed
    console.error('Service worker registration error:', error)
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <CWLProvider>
          <App />
        </CWLProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)

