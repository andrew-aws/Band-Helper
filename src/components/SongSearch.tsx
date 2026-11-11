import { useRef, useState, type FormEvent } from 'react'
import { lyricsFromTrack, searchLyrics, type LrclibTrack } from '../api/lrclib'
import type { NewSong, Song } from '../types'

interface Props {
  songs: Song[]
  onAdd: (song: NewSong) => void
}

const formatDuration = (sec: number | null) =>
  sec ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : ''

export function SongSearch({ songs, onAdd }: Props) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [results, setResults] = useState<LrclibTrack[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const addedIds = new Set(songs.map((s) => s.lrclibId))

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() && !artist.trim()) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      setResults(await searchLyrics({ title, artist }, controller.signal))
      setPreviewId(null)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message || 'Search failed')
      }
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }

  function add(track: LrclibTrack) {
    onAdd({
      title: track.trackName,
      artist: track.artistName,
      album: track.albumName ?? undefined,
      lyrics: lyricsFromTrack(track),
      source: 'lrclib',
      lrclibId: track.id,
    })
  }

  return (
    <section className="card">
      <h2>Find lyrics</h2>
      <form className="search-form" onSubmit={handleSearch}>
        <input
          placeholder="Song title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Song title"
        />
        <input
          placeholder="Artist (optional)"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          aria-label="Artist"
        />
        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {results && results.length === 0 && <p className="muted">No results. Try a different spelling, or add it manually below.</p>}

      {results && results.length > 0 && (
        <ul className="results">
          {results.map((t) => {
            const lyrics = lyricsFromTrack(t)
            const added = addedIds.has(t.id)
            return (
              <li key={t.id} className="result">
                <div className="result-main">
                  <div>
                    <strong>{t.trackName}</strong> <span className="muted">— {t.artistName}</span>
                    <div className="small muted">
                      {[t.albumName, formatDuration(t.duration)].filter(Boolean).join(' · ')}
                      {!lyrics && <span className="badge warn">no lyrics</span>}
                      {t.instrumental && <span className="badge">instrumental</span>}
                    </div>
                  </div>
                  <div className="row">
                    {lyrics && (
                      <button onClick={() => setPreviewId(previewId === t.id ? null : t.id)}>
                        {previewId === t.id ? 'Hide' : 'Preview'}
                      </button>
                    )}
                    <button className="primary" disabled={added} onClick={() => add(t)}>
                      {added ? 'Added ✓' : 'Add'}
                    </button>
                  </div>
                </div>
                {previewId === t.id && <pre className="lyrics-preview">{lyrics}</pre>}
              </li>
            )
          })}
        </ul>
      )}

      <ManualSongForm onAdd={onAdd} />
    </section>
  )
}

function ManualSongForm({ onAdd }: { onAdd: (song: NewSong) => void }) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [lyrics, setLyrics] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), artist: artist.trim(), lyrics, source: 'manual' })
    setTitle('')
    setArtist('')
    setLyrics('')
  }

  return (
    <details className="manual">
      <summary>Add an original, or paste lyrics yourself</summary>
      <form className="stack" onSubmit={handleSubmit}>
        <div className="search-form">
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <input placeholder="Artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
        </div>
        <textarea
          placeholder="Lyrics"
          rows={8}
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
        />
        <div>
          <button type="submit" className="primary">Add song</button>
        </div>
      </form>
    </details>
  )
}
