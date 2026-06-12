import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Dashboard() {
  const [interactions, setInteractions] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const [followUpOnly, setFollowUpOnly] = useState(false)

  useEffect(() => {
    loadEvents()
  }, [])

  useEffect(() => {
    loadInteractions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventFilter, followUpOnly])

  async function loadEvents() {
    const { data } = await supabase.from('events').select('id, name').order('start_date', { ascending: false })
    setEvents(data || [])
  }

  async function loadInteractions() {
    setLoading(true)
    setError('')

    let query = supabase
      .from('interactions')
      .select(
        `id, first_name, last_name, company, job_title, email, phone, interaction_date,
         follow_up, notes, badge_photo_path, audio_note_path, exported_at,
         events ( id, name ),
         profiles ( full_name )`
      )
      .order('created_at', { ascending: false })

    if (eventFilter) {
      query = query.eq('event_id', eventFilter)
    }
    if (followUpOnly) {
      query = query.eq('follow_up', true)
    }

    const { data, error } = await query

    if (error) {
      setError(error.message)
      setInteractions([])
    } else {
      setInteractions(data || [])
    }
    setLoading(false)
  }

  const filtered = interactions.filter((row) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      `${row.first_name} ${row.last_name}`.toLowerCase().includes(q) ||
      (row.company || '').toLowerCase().includes(q) ||
      (row.email || '').toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <div className="page-header">
        <span className="eyebrow">Event Connect</span>
        <h1>Interactions</h1>
        <p>Everything the team has logged from events and customer conversations.</p>
      </div>

      <div className="toolbar">
        <div className="field">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="search"
            placeholder="Name, company, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="eventFilter">Event</label>
          <select id="eventFilter" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
            <option value="">All events</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: '0 0 auto' }}>
          <label>&nbsp;</label>
          <div className="checkbox-row">
            <input
              id="followUp"
              type="checkbox"
              checked={followUpOnly}
              onChange={(e) => setFollowUpOnly(e.target.checked)}
            />
            <label htmlFor="followUp">Needs follow-up</label>
          </div>
        </div>
        <div className="field" style={{ flex: '0 0 auto' }}>
          <label>&nbsp;</label>
          <Link to="/new" className="btn btn-primary">
            + New interaction
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">Loading interactions...</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>No interactions yet</h3>
            <p>Log your first conversation from the field with "New interaction".</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Company</th>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Logged by</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>
                        {row.first_name} {row.last_name}
                      </strong>
                      {row.job_title && (
                        <div style={{ color: 'var(--sw-text-muted)', fontSize: 12 }}>{row.job_title}</div>
                      )}
                    </td>
                    <td>{row.company || '—'}</td>
                    <td>{row.events?.name || '—'}</td>
                    <td>{row.interaction_date || '—'}</td>
                    <td>{row.profiles?.full_name || '—'}</td>
                    <td>
                      {row.follow_up && <span className="tag tag-follow">Follow up</span>}
                      {row.exported_at && (
                        <span className="tag" style={{ marginLeft: 6 }}>
                          Exported
                        </span>
                      )}
                      {row.badge_photo_path && (
                        <span className="tag" style={{ marginLeft: 6 }}>
                          Photo
                        </span>
                      )}
                      {row.audio_note_path && (
                        <span className="tag" style={{ marginLeft: 6 }}>
                          Audio
                        </span>
                      )}
                    </td>
                    <td>
                      <Link to={`/interaction/${row.id}`} className="btn btn-secondary btn-sm">
                        Open
                      </Link>
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
