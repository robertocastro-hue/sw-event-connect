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
    const err = new Error(json.error || `Request failed (${res.status})`)
    err.debug = json.debug
    throw err
  }
  return json
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  let pw = ''
  for (let i = 0; i < 12; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)]
  }
  return pw
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  // New user form
  const [showForm, setShowForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState(generatePassword())
  const [makeAdmin, setMakeAdmin] = useState(false)
  const [busy, setBusy] = useState(false)

  // Inline name editing
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')

  // Password reset panel
  const [resettingId, setResettingId] = useState(null)
  const [resetPassword, setResetPassword] = useState('')

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
      await callAdminApi('POST', {
        email: email.trim(),
        full_name: fullName.trim(),
        is_admin: makeAdmin,
        password: newPassword
      })
      setStatus(
        `Account created for ${email}. Share this temporary password with them: "${newPassword}" — they can change it under Account once logged in.`
      )
      setEmail('')
      setFullName('')
      setMakeAdmin(false)
      setNewPassword(generatePassword())
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

  function startEditName(targetUser) {
    setEditingId(targetUser.id)
    setEditingName(targetUser.full_name || '')
    setResettingId(null)
  }

  async function saveName(targetUser) {
    setError('')
    setStatus('')
    try {
      await callAdminApi('PATCH', { user_id: targetUser.id, full_name: editingName.trim() })
      setEditingId(null)
      loadUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  function startReset(targetUser) {
    setResettingId(targetUser.id)
    setResetPassword(generatePassword())
    setEditingId(null)
  }

  async function saveReset(targetUser) {
    setError('')
    setStatus('')
    try {
      await callAdminApi('PATCH', { user_id: targetUser.id, password: resetPassword })
      setStatus(
        `Password updated for ${targetUser.email}. Share this new password with them: "${resetPassword}"`
      )
      setResettingId(null)
    } catch (err) {
      setError(err.message)
    }
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
            <div className="field">
              <label htmlFor="newUserPassword">Temporary password</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="newUserPassword"
                  type="text"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setNewPassword(generatePassword())}
                >
                  Generate
                </button>
              </div>
              <span className="hint">
                Share this password with them directly. They can change it anytime under Account.
              </span>
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
                {busy ? 'Creating...' : 'Create account'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
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
                    <td>
                      {editingId === u.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            style={{ minWidth: 140 }}
                            autoFocus
                          />
                          <button className="btn btn-primary btn-sm" onClick={() => saveName(u)}>
                            Save
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        u.full_name || '—'
                      )}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className="tag">{u.is_admin ? 'Admin' : 'Team member'}</span>
                    </td>
                    <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {editingId !== u.id && (
                          <button className="btn btn-secondary btn-sm" onClick={() => startEditName(u)}>
                            Edit name
                          </button>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => startReset(u)}>
                          Set password
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
                      {resettingId === u.id && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <input
                            type="text"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            style={{ fontFamily: 'monospace', minWidth: 160 }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setResetPassword(generatePassword())}
                          >
                            Generate
                          </button>
                          <button className="btn btn-primary btn-sm" onClick={() => saveReset(u)}>
                            Save password
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setResettingId(null)}>
                            Cancel
                          </button>
                        </div>
                      )}
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
