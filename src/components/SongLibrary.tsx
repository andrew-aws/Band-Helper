import { useState } from 'react'
import type { BandActions } from '../hooks/useBandData'
import type { Id, Song } from '../types'

interface Props {
  songs: Song[]
  setlist: Id[]
  actions: BandActions
}

export function SongLibrary({ songs, setlist, actions }: Props) {
  const [editingId, setEditingId] = useState<Id | null>(null)
  const [filter, setFilter] = useState('')

  const q = filter.trim().toLowerCase()
  const visible = q
    ? songs.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(q))
    : songs

  return (
    <section className="card">
      <div className="card-header">
        <h2>Song library <span className="muted small">({songs.length})</span></h2>
        {songs.length > 5 && (
          <input placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        )}
      </div>

      {songs.length === 0 && <p className="muted">No songs yet. Search for one to get started.</p>}

      <ul className="library">
        {visible.map((song) => {
          const inSetlist = setlist.includes(song.id)
          const editing = editingId === song.id
          return (
            <li key={song.id} className="library-item">
              <div className="result-main">
                <div>
                  <strong>{song.title}</strong>
                  {song.artist && <span className="muted"> — {song.artist}</span>}
                  <div className="small muted">
                    {song.parts.length
                      ? `${song.parts.length} part${song.parts.length === 1 ? '' : 's'}`
                      : 'No parts assigned'}
                    {!song.lyrics.trim() && <span className="badge warn">no lyrics</span>}
                    {song.source === 'manual' && <span className="badge">manual</span>}
                  </div>
                </div>
                <div className="row">
                  <button
                    className={inSetlist ? 'toggled' : ''}
                    onClick={() => actions.toggleInSetlist(song.id)}
                  >
                    {inSetlist ? 'In setlist ✓' : '+ Setlist'}
                  </button>
                  <button onClick={() => setEditingId(editing ? null : song.id)}>
                    {editing ? 'Done' : 'Edit'}
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      if (confirm(`Remove "${song.title}" from the library?`)) actions.removeSong(song.id)
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editing && (
                <div className="stack editor">
                  <div className="search-form">
                    <input
                      value={song.title}
                      onChange={(e) => actions.updateSong(song.id, { title: e.target.value })}
                      aria-label="Title"
                    />
                    <input
                      value={song.artist}
                      onChange={(e) => actions.updateSong(song.id, { artist: e.target.value })}
                      aria-label="Artist"
                    />
                  </div>
                  <textarea
                    rows={14}
                    value={song.lyrics}
                    onChange={(e) => actions.updateSong(song.id, { lyrics: e.target.value })}
                    aria-label="Lyrics"
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
