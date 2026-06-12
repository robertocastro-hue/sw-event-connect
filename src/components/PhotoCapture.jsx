import { useState } from 'react'

export default function PhotoCapture({ existingUrl, onChange }) {
  const [previewUrl, setPreviewUrl] = useState(existingUrl || null)

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
    onChange(file)
  }

  function clearPhoto() {
    setPreviewUrl(null)
    onChange(null)
  }

  return (
    <div>
      <div className="recorder">
        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
          📷 Take / upload badge photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
        </label>
        {previewUrl && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearPhoto}>
            Remove
          </button>
        )}
      </div>
      {previewUrl && <img src={previewUrl} alt="Badge preview" className="photo-preview" />}
    </div>
  )
}
