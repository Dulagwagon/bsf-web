import { useState, useEffect } from 'react'
import Login      from './pages/Login'
import Dashboard  from './pages/Dashboard'
import Pipeline   from './pages/Pipeline'
import Planos     from './pages/Planos'
import Cnaes      from './pages/Cnaes'
import Municipios from './pages/Municipios'
import Resultados from './pages/Resultados'
import Sidebar    from './components/Sidebar'

export default function App() {
  const [user, setUser]   = useState(null)
  const [page, setPage]   = useState('dashboard')
  const [theme, setTheme] = useState('dark')

  /* aplica o tema no <html> para que os tokens CSS funcionem globalmente */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return (
        <Dashboard
          theme={theme}
          onToggleTheme={toggleTheme}
          onRunPipeline={() => setPage('pipeline')}
        />
      )
      case 'pipeline':    return <Pipeline />
      case 'planos':      return <Planos />
      case 'cnaes':       return <Cnaes />
      case 'municipios':  return <Municipios />
      case 'resultados':  return <Resultados />
      default: return (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 12,
          color: 'var(--text-muted)', fontFamily: 'var(--font-ui)'
        }}>
          <i className="ti ti-tools" style={{ fontSize: 36, color: 'var(--gold)' }} />
          <span style={{ fontSize: 14, letterSpacing: '0.1em' }}>Em construção</span>
        </div>
      )
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar
        active={page}
        onNavigate={setPage}
        user={{ name: 'Eduardo', role: 'Administrador' }}
      />
      {renderPage()}
    </div>
  )
}