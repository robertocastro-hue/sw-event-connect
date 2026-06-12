import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { LOGO_URL } from '../components/Layout'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setStatus(null)
    setBusy(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setStatus('If an account exists for that email, a reset link has been sent.')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src={LOGO_URL} alt="Smart Wires" className="logo" />
        <h1>Reset your password</h1>
        <p className="sub">We'll email you a link to set a new password</p>

        {error && <div className="alert alert-error">{error}</div>}
        {status && <div className="alert alert-success">{status}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <div className="auth-foot">
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}
