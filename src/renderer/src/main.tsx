import React from 'react'
import ReactDOM from 'react-dom/client'
import './utils/monacoSetup'
import App from './App'
import './assets/index.css'

import { ErrorBoundary } from './components/ui/ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
