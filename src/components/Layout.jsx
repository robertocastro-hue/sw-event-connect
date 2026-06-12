import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const LOGO_URL = 'https://www.smartwires.com/wp-content/uploads/2023/07/SW-Logo-New-e1714671185274.png'

export default function Layout({ children }) {
  const { isAdmin, signOut, profile } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <img src={LOGO_URL} alt="Smart Wires" className="topbar-logo" />
          <span className="topbar-title">Event Connect</span>
        </div>
        <button
          className="topbar-toggle"
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen((m) => !m)}
        >
          ☰
        </button>
        <nav className={`topbar-nav ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Interactions
          </NavLink>
          <NavLink to="/new" className={({ isActive }) => (isActive ? 'active' : '')}>
            New Interaction
          </NavLink>
          <NavLink to="/export" className={({ isActive }) => (isActive ? 'active' : '')}>
            Export
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'active' : '')}>
              Users
            </NavLink>
          )}
          <NavLink to="/account" className={({ isActive }) => (isActive ? 'active' : '')}>
            {profile?.full_name ? profile.full_name.split(' ')[0] : 'Account'}
          </NavLink>
          <button className="linklike" onClick={handleSignOut}>
            Sign out
          </button>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  )
}

export { LOGO_URL }
