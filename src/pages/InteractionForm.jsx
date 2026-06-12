import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, BADGE_PHOTOS_BUCKET, AUDIO_NOTES_BUCKET } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import AudioRecorder from '../components/AudioRecorder'
import PhotoCapture from '../components/PhotoCapture'

const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  company: '',
  job_title: '',
  event_id: '',
  interaction_date: new Date().toISOString().slice(0, 10),
  notes: '',
  follow_up: false
}

export default function InteractionForm() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const { user } = useAuth()

  const [form, setForm] = useState(emptyForm)
  const [events, setEvents] = useState([])
  const [newEventName, setNewEventName] = useState('')
  const [showNewEvent, setShowNewEvent] = useState(false)

  const [photoFile, setPhotoFile] = useState(undefined) // undefined = unchanged, null = removed, File = new
  const [audioBlob, setAudioBlob] = useState(undefined)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [existingPhotoPath, setExistingPhotoPath] = useState(null)
  const [existingAudioPath, setExistingAudioPath] = useState(null)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadEvents()
    if (isEdit) loadInteraction()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadEvents() {
    const { data } = await supabase.from('events').select('id, name').order('name')
    setEvents(data || [])
  }

  async function loadInteraction() {
    setLoading(true)
    const { data, error } = await supabase.from('interactions').select('*').eq('id', id).single()
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setForm({
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      email: data.email || '',
      phone: data.phone || '',
      company: data.company || '',
      job_title: data.job_title || '',
      event_id: data.event_id || '',
      interaction_date: data.interaction_date || new Date().toISOString().slice(0, 10),
      notes: data.notes || '',
      follow_up: !!data.follow_up
    })
    setExistingPhotoPath(data.badge_photo_path)
    setExistingAudioPath(data.audio_note_path)

    if (data.badge_photo_path) {
      const { data: signed } = await supabase.storage
        .from(BADGE_PHOTOS_BUCKET)
        .createSignedUrl(data.badge_photo_path, 3600)
      setPhotoUrl(signed?.signedUrl || null)
    }
    if (data.audio_note_path) {
      const { data: signed } = await supabase.storage
        .from(AUDIO_NOTES_BUCKET)
        .createSignedUrl(data.audio_note_path, 3600)
      setAudioUrl(signed?.signedUrl || null)
    }
    setLoading(false)
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleCreateEvent() {
    if (!newEventName.trim()) return
    const { data, error } = await supabase
      .from('events')
      .insert({ name: newEventName.trim() })
      .select()
      .single()
    if (error) {
      setError(error.message)
      return
    }
    setEvents((evs) => [...evs, data].sort((a, b) => a.name.localeCompare(b.name)))
    update('event_id', data.id)
    setNewEventName('')
    setShowNewEvent(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.first_name.trim() && !form.last_name.trim() && !form.company.trim()) {
      setError('Enter at least a name or company so this contact can be found later.')
      return
    }

    setSaving(true)

    const payload = {
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      company: form.company.trim() || null,
      job_title: form.job_title.trim() || null,
      event_id: form.event_id || null,
      interaction_date: form.interaction_date || null,
      notes: form.notes.trim() || null,
      follow_up: form.follow_up
    }

    let interactionId = id

    try {
      if (isEdit) {
        const { error } = await supabase
          .from('interactions')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('interactions')
          .insert({ ...payload, created_by: user.id })
          .select()
          .single()
        if (error) throw error
        interactionId = data.id
      }

      // Handle photo upload/removal
      let badgePhotoPath = existingPhotoPath
      if (photoFile === null && existingPhotoPath) {
        await supabase.storage.from(BADGE_PHOTOS_BUCKET).remove([existingPhotoPath])
        badgePhotoPath = null
      } else if (photoFile instanceof File) {
        const ext = photoFile.name.split('.').pop() || 'jpg'
        const path = `${interactionId}/badge.${ext}`
        const { error: upErr } = await supabase.storage
          .from(BADGE_PHOTOS_BUCKET)
          .upload(path, photoFile, { upsert: true })
        if (upErr) throw upErr
        badgePhotoPath = path
      }

      // Handle audio upload/removal
      let audioNotePath = existingAudioPath
      if (audioBlob === null && existingAudioPath) {
        await supabase.storage.from(AUDIO_NOTES_BUCKET).remove([existingAudioPath])
        audioNotePath = null
      } else if (audioBlob instanceof Blob) {
        const path = `${interactionId}/note.webm`
        const { error: upErr } = await supabase.storage
          .from(AUDIO_NOTES_BUCKET)
          .upload(path, audioBlob, { upsert: true, contentType: audioBlob.type || 'audio/webm' })
        if (upErr) throw upErr
        audioNotePath = path
      }

      if (badgePhotoPath !== existingPhotoPath || audioNotePath !== existingAudioPath) {
        const { error: mediaErr } = await supabase
          .from('interactions')
          .update({ badge_photo_path: badgePhotoPath, audio_note_path: audioNotePath })
          .eq('id', interactionId)
        if (mediaErr) throw mediaErr
      }

      setSuccess('Saved.')
      setTimeout(() => navigate(isEdit ? `/interaction/${interactionId}` : '/'), 600)
    } catch (err) {
      setError(err.message || 'Something went wrong while saving.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this interaction? This cannot be undone.')) return
    setSaving(true)
    setError('')

    if (existingPhotoPath) await supabase.storage.from(BADGE_PHOTOS_BUCKET).remove([existingPhotoPath])
    if (existingAudioPath) await supabase.storage.from(AUDIO_NOTES_BUCKET).remove([existingAudioPath])

    const { error } = await supabase.from('interactions').delete().eq('id', id)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/')
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <div>
      <div className="page-header">
        <span className="eyebrow">Event Connect</span>
        <h1>{isEdit ? 'Edit interaction' : 'New interaction'}</h1>
        <p>Capture the conversation while it's fresh, including a badge photo or voice note.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="form-row">
            <div className="field">
              <label htmlFor="first_name">First name</label>
              <input
                id="first_name"
                type="text"
                value={form.first_name}
                onChange={(e) => update('first_name', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="last_name">Last name</label>
              <input
                id="last_name"
                type="text"
                value={form.last_name}
                onChange={(e) => update('last_name', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="company">Company</label>
              <input
                id="company"
                type="text"
                value={form.company}
                onChange={(e) => update('company', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="job_title">Job title</label>
              <input
                id="job_title"
                type="text"
                value={form.job_title}
                onChange={(e) => update('job_title', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="event_id">Event</label>
              {!showNewEvent ? (
                <>
                  <select
                    id="event_id"
                    value={form.event_id}
                    onChange={(e) => update('event_id', e.target.value)}
                  >
                    <option value="">No event / other</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                  <span className="hint">
                    Don't see it?{' '}
                    <button type="button" className="linklike" style={{ color: 'var(--sw-orange)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }} onClick={() => setShowNewEvent(true)}>
                      Add a new event
                    </button>
                  </span>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="e.g. CIGRE 2026"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleCreateEvent}>
                    Add
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowNewEvent(false)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div className="field">
              <label htmlFor="interaction_date">Date</label>
              <input
                id="interaction_date"
                type="date"
                value={form.interaction_date}
                onChange={(e) => update('interaction_date', e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="notes">Interaction notes</label>
            <textarea
              id="notes"
              placeholder="What did you talk about? Interests, pain points, next steps..."
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
            <span className="hint">This becomes the "Event interaction notes" field when exported to HubSpot.</span>
          </div>

          <div className="checkbox-row" style={{ marginBottom: 16 }}>
            <input
              id="follow_up"
              type="checkbox"
              checked={form.follow_up}
              onChange={(e) => update('follow_up', e.target.checked)}
            />
            <label htmlFor="follow_up">This contact needs follow-up</label>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Badge photo</label>
              <PhotoCapture
                existingUrl={photoUrl}
                onChange={(file) => {
                  setPhotoFile(file)
                  setPhotoUrl(file ? URL.createObjectURL(file) : null)
                }}
              />
            </div>
            <div className="field">
              <label>Audio note</label>
              <AudioRecorder existingUrl={audioUrl} onChange={setAudioBlob} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save interaction'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
          </div>
          {isEdit && (
            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={saving}>
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
