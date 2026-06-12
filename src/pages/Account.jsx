import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

export default function Account() {
  const { user, profile, isAdmin } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setStatus('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }
    setStatus('Password updated.')
    setPassword('')
    setConfirm('')
  }

  return (
    <div>
      <div className="page-header">
        <span className="eyebrow">Event Connect</span>
        <h1>Your account</h1>
      </div>

      <div className="card">
        <div className="field">
          <label>Name</label>
          <p style={{ margin: 0 }}>{profile?.full_name || '—'}</p>
        </div>
        <div className="field">
          <label>Email</label>
          <p style={{ margin: 0 }}>{user?.email}</p>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Role</label>
          <p style={{ margin: 0 }}>{isAdmin ? 'Administrator' : 'Team member'}</p>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, color: 'var(--sw-navy)' }}>Change password</h3>

        {error && <div className="alert alert-error">{error}</div>}
        {status && <div className="alert alert-success">{status}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="field">
              <label htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="hint">At least 8 characters</span>
            </div>
            <div className="field">
              <label htmlFor="confirm">Confirm new password</label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Saving...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
