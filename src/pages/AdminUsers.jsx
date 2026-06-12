import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

async function callAdminApi(method, body) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token

  const res = await fetch('/.netlify/functions/admin-users', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : undefined
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [makeAdmin, setMakeAdmin] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      const data = await callAdminApi('GET')
      setUsers(data.users || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setStatus('')
    setBusy(true)
    try {
      await callAdminApi('POST', { email: email.trim(), full_name: fullName.trim(), is_admin: makeAdmin })
      setStatus(`Invitation sent to ${email}.`)
      setEmail('')
      setFullName('')
      setMakeAdmin(false)
      setShowForm(false)
      loadUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(targetUser) {
    if (targetUser.id === currentUser.id) {
      setError("You can't delete your own account.")
      return
    }
    if (!window.confirm(`Remove ${targetUser.email}? They will lose access immediately.`)) return

    setError('')
    setStatus('')
    try {
      await callAdminApi('DELETE', { user_id: targetUser.id })
      setStatus(`Removed ${targetUser.email}.`)
      loadUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleToggleAdmin(targetUser) {
    if (targetUser.id === currentUser.id) {
      setError("You can't change your own admin status.")
      return
    }
    setError('')
    setStatus('')
    try {
      await callAdminApi('PATCH', { user_id: targetUser.id, is_admin: !targetUser.is_admin })
      loadUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSendReset(targetUser) {
    setError('')
    setStatus('')
    const { error } = await supabase.auth.resetPasswordForEmail(targetUser.email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) {
      setError(error.message)
      return
    }
    setStatus(`Password reset link sent to ${targetUser.email}.`)
  }

  return (
    <div>
      <div className="page-header">
        <span className="eyebrow">Event Connect</span>
        <h1>Users</h1>
        <p>Add or remove teammates who can log event interactions.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {status && <div className="alert alert-success">{status}</div>}

      <div className="card">
        {!showForm ? (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Add user
          </button>
        ) : (
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="newEmail">Email</label>
                <input
                  id="newEmail"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="checkbox-row" style={{ marginBottom: 16 }}>
              <input
                id="makeAdmin"
                type="checkbox"
                checked={makeAdmin}
                onChange={(e) => setMakeAdmin(e.target.checked)}
              />
              <label htmlFor="makeAdmin">Give this person admin access (can manage users)</label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Sending invite...' : 'Send invite'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
            <p className="hint" style={{ marginTop: 10 }}>
              An email invitation will be sent so they can set their own password.
            </p>
          </form>
        )}
      </div>

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name || '—'}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className="tag">{u.is_admin ? 'Admin' : 'Team member'}</span>
                    </td>
                    <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleSendReset(u)}>
                          Send password reset
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleToggleAdmin(u)}
                          disabled={u.id === currentUser.id}
                        >
                          {u.is_admin ? 'Remove admin' : 'Make admin'}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(u)}
                          disabled={u.id === currentUser.id}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
