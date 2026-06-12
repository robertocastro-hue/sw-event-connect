import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const COLUMNS = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'company', label: 'Company Name' },
  { key: 'job_title', label: 'Job Title' },
  { key: 'notes', label: 'Event Interaction Notes' },
  { key: 'event_name', label: 'Event Name' },
  { key: 'interaction_date', label: 'Interaction Date' },
  { key: 'follow_up_label', label: 'Needs Follow Up' }
]

export default function Export() {
  const [events, setEvents] = useState([])
  const [eventFilter, setEventFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [excludeExported, setExcludeExported] = useState(true)

  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    supabase
      .from('events')
      .select('id, name')
      .order('start_date', { ascending: false })
      .then(({ data }) => setEvents(data || []))
  }, [])

  async function runSearch() {
    setLoading(true)
    setError('')
    setStatus('')

    let query = supabase
      .from('interactions')
      .select(
        `id, first_name, last_name, email, phone, company, job_title, notes,
         interaction_date, follow_up, exported_at, events ( name )`
      )
      .order('interaction_date', { ascending: false })

    if (eventFilter) query = query.eq('event_id', eventFilter)
    if (from) query = query.gte('interaction_date', from)
    if (to) query = query.lte('interaction_date', to)
    if (excludeExported) query = query.is('exported_at', null)

    const { data, error } = await query
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setRows(data || [])
    setSelected(new Set((data || []).map((r) => r.id)))
  }

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === rows.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(rows.map((r) => r.id)))
    }
  }

  function buildCsv(selectedRows) {
    const header = COLUMNS.map((c) => csvEscape(c.label)).join(',')
    const lines = selectedRows.map((row) => {
      const record = {
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone: row.phone,
        company: row.company,
        job_title: row.job_title,
        notes: row.notes,
        event_name: row.events?.name || '',
        interaction_date: row.interaction_date,
        follow_up_label: row.follow_up ? 'Yes' : 'No'
      }
      return COLUMNS.map((c) => csvEscape(record[c.key])).join(',')
    })
    return [header, ...lines].join('\n')
  }

  function handleDownload() {
    const selectedRows = rows.filter((r) => selected.has(r.id))
    if (selectedRows.length === 0) {
      setError('Select at least one interaction to export.')
      return
    }
    const csv = buildCsv(selectedRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `sw-event-connect-export-${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function handleMarkExported() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setLoading(true)
    const { error } = await supabase
      .from('interactions')
      .update({ exported_at: new Date().toISOString() })
      .in('id', ids)
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setStatus(`Marked ${ids.length} interaction(s) as exported.`)
    runSearch()
  }

  return (
    <div>
      <div className="page-header">
        <span className="eyebrow">Event Connect</span>
        <h1>Export to HubSpot</h1>
        <p>
          Download a CSV formatted for HubSpot's contact import. Notes map to a custom "Event Interaction
          Notes" contact property &mdash; create that property in HubSpot once, then map it during import.
        </p>
      </div>

      <div className="card">
        <div className="toolbar">
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
          <div className="field">
            <label htmlFor="from">From</label>
            <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="to">To</label>
            <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field" style={{ flex: '0 0 auto' }}>
            <label>&nbsp;</label>
            <div className="checkbox-row">
              <input
                id="excludeExported"
                type="checkbox"
                checked={excludeExported}
                onChange={(e) => setExcludeExported(e.target.checked)}
              />
              <label htmlFor="excludeExported">Hide already exported</label>
            </div>
          </div>
          <div className="field" style={{ flex: '0 0 auto' }}>
            <label>&nbsp;</label>
            <button className="btn btn-primary" onClick={runSearch} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {status && <div className="alert alert-success">{status}</div>}

      {rows.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={selected.size === rows.length} onChange={toggleAll} />
                  </th>
                  <th>Contact</th>
                  <th>Company</th>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Exported</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                      />
                    </td>
                    <td>
                      {row.first_name} {row.last_name}
                      <div style={{ color: 'var(--sw-text-muted)', fontSize: 12 }}>{row.email}</div>
                    </td>
                    <td>{row.company || '—'}</td>
                    <td>{row.events?.name || '—'}</td>
                    <td>{row.interaction_date || '—'}</td>
                    <td>{row.exported_at ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleDownload}>
              Download CSV ({selected.size})
            </button>
            <button className="btn btn-secondary" onClick={handleMarkExported} disabled={selected.size === 0}>
              Mark selected as exported
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 && !loading && (
        <div className="card">
          <div className="empty-state">
            <h3>No results yet</h3>
            <p>Set your filters and click Search to find interactions to export.</p>
          </div>
        </div>
      )}
    </div>
  )
}
