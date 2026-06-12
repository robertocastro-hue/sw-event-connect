import { useRef, useState, useEffect } from 'react'

export default function AudioRecorder({ existingUrl, onChange }) {
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(existingUrl || null)
  const [error, setError] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        onChange(blob)
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch (err) {
      setError('Could not access microphone. Check browser permissions.')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  function clearRecording() {
    setAudioBlob(null)
    setPreviewUrl(null)
    onChange(null)
  }

  return (
    <div className="recorder">
      {error && <div className="alert alert-error" style={{ marginBottom: 0 }}>{error}</div>}

      {!recording ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={startRecording}>
          🎙 Record audio note
        </button>
      ) : (
        <button type="button" className="btn btn-danger btn-sm" onClick={stopRecording}>
          <span className="rec-dot" /> Stop recording
        </button>
      )}

      {previewUrl && (
        <>
          <audio controls src={previewUrl} style={{ height: 32 }} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearRecording}>
            Remove
          </button>
        </>
      )}
    </div>
  )
}
