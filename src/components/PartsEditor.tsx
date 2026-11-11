import { useState, type FormEvent } from 'react'
import type { BandActions } from '../hooks/useBandData'
import { partKind, partMax, partMin, usualCount } from '../lib/matching'
import type { Id, Member, Part, PartKind, Song } from '../types'

/** "", "×2", "1–3", "0–1" etc. Nothing shown for the default of exactly one player. */
function rangeLabel(p: Part) {
  const min = partMin(p)
  const max = partMax(p)
  if (min === max) return min === 1 ? '' : `×${min}`
  return `${min}–${max}`
}

const COMMON_PARTS = ['Lead vocals', 'Backing vocals', 'Guitar', 'Lead guitar', 'Bass', 'Drums', 'Keys']

interface Props {
  songs: Song[]
  members: Member[]
  actions: BandActions
}

export function PartsEditor({ songs, members, actions }: Props) {
  const [selectedId, setSelectedId] = useState<Id | null>(null)
  const [newPart, setNewPart] = useState('')
  const song = songs.find((s) => s.id === selectedId) ?? songs[0]

  if (!song) {
    return (
      <section className="card">
        <h2>Who plays what</h2>
        <p className="muted">Add some songs on the Songs tab first.</p>
      </section>
    )
  }

  const nameOf = (id: Id) => members.find((m) => m.id === id)?.name ?? '?'

  function handleAddPart(e: FormEvent) {
    e.preventDefault()
    if (!newPart.trim()) return
    actions.addPart(song.id, newPart.trim())
    setNewPart('')
  }

  return (
    <>
      <section className="card">
        <div className="card-header">
          <h2>Who plays what</h2>
          <select value={song.id} onChange={(e) => setSelectedId(e.target.value)} aria-label="Song">
            {songs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {s.artist ? ` — ${s.artist}` : ''}
              </option>
            ))}
          </select>
        </div>

        <p className="muted small">
          List everyone who can play each part, in order of preference. <strong>Players</strong> sets
          how many people play it. With “1 to 3”, the first three people all play when they’re here,
          and the song still works if only one shows up. Set the minimum to 0 to drop the part when
          nobody’s available. Anyone further down the list is a backup. One person can take a{' '}
          <strong>vocal</strong> part and an <strong>instrument</strong> part in the same song (sing
          and play), but not two of the same kind.
        </p>

        {song.parts.length === 0 && <p className="muted">No parts yet for this song.</p>}

        <ul className="parts">
          {song.parts.map((part) => (
            <PartRow
              key={part.id}
              part={part}
              members={members}
              nameOf={nameOf}
              onChange={(patch) => actions.updatePart(song.id, part.id, patch)}
              onRemove={() => actions.removePart(song.id, part.id)}
            />
          ))}
        </ul>

        <div className="stack add-parts">
          <form className="row" onSubmit={handleAddPart}>
            <input placeholder="New part…" value={newPart} onChange={(e) => setNewPart(e.target.value)} />
            <button type="submit">Add part</button>
          </form>
          <div className="row wrap">
            <span className="muted small">Quick add:</span>
            {COMMON_PARTS.map((name) => (
              <button key={name} type="button" className="chip-button" onClick={() => actions.addPart(song.id, name)}>
                + {name}
              </button>
            ))}
          </div>
        </div>

        {songs.length > 1 && (
          <div className="row">
            <label className="small muted" htmlFor="copy-from">Copy parts from</label>
            <select
              id="copy-from"
              value=""
              onChange={(e) => {
                const from = e.target.value
                if (!from) return
                if (song.parts.length === 0 || confirm('Replace this song’s parts?')) {
                  actions.copyParts(from, song.id)
                }
              }}
            >
              <option value="">Choose a song…</option>
              {songs
                .filter((s) => s.id !== song.id && s.parts.length > 0)
                .map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
            </select>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Overview</h2>
        <table className="overview">
          <thead>
            <tr>
              <th>Song</th>
              <th>Parts (player count and backups in parentheses)</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((s) => (
              <tr key={s.id} className={s.id === song.id ? 'selected' : ''}>
                <td>
                  <button className="link" onClick={() => setSelectedId(s.id)}>{s.title}</button>
                </td>
                <td>
                  {s.parts.length === 0 ? (
                    <span className="badge warn">not set up</span>
                  ) : (
                    s.parts.map((p) => {
                      const usual = usualCount(p)
                      return (
                        <span key={p.id} className="overview-part">
                          <strong>{p.name}</strong>
                          {rangeLabel(p) && <span className="muted small"> ({rangeLabel(p)})</span>}
                          <strong>:</strong>{' '}
                          {p.memberIds.length === 0 ? (
                            <span className="badge warn">nobody</span>
                          ) : (
                            <>
                              {p.memberIds.slice(0, usual).map(nameOf).join(', ')}
                              {p.memberIds.length > usual && (
                                <span className="muted"> ({p.memberIds.slice(usual).map(nameOf).join(', ')})</span>
                              )}
                            </>
                          )}
                        </span>
                      )
                    })
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

interface PartRowProps {
  part: Part
  members: Member[]
  nameOf: (id: Id) => string
  onChange: (patch: Partial<Omit<Part, 'id'>>) => void
  onRemove: () => void
}

function PartRow({ part, members, nameOf, onChange, onRemove }: PartRowProps) {
  const ids = part.memberIds
  const unassigned = members.filter((m) => !ids.includes(m.id))
  const min = partMin(part)
  const max = partMax(part)
  const usual = usualCount(part)
  const options = (from: number) =>
    Array.from({ length: Math.max(8, members.length) - from + 1 }, (_, i) => from + i)

  const move = (i: number, dir: -1 | 1) => {
    const next = [...ids]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    onChange({ memberIds: next })
  }

  return (
    <li className="part-row">
      <div className="part-meta">
        <div className="part-title">
          <input
            className="part-name"
            value={part.name}
            onChange={(e) => onChange({ name: e.target.value })}
            aria-label="Part name"
          />
          <select
            value={partKind(part)}
            onChange={(e) => onChange({ kind: e.target.value as PartKind })}
            aria-label="Part type"
            title="Someone can take one vocal part and one instrument part in the same song"
          >
            <option value="instrument">Instrument</option>
            <option value="vocal">Vocal</option>
          </select>
        </div>
        <div className="part-count small muted">
          Players
          <select
            value={min}
            onChange={(e) => {
              const v = Number(e.target.value)
              onChange({ min: v, max: Math.max(max, v) })
            }}
            aria-label="Minimum players"
          >
            {options(0).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          to
          <select
            value={max}
            onChange={(e) => {
              const v = Number(e.target.value)
              onChange({ max: v, min: Math.min(min, v) })
            }}
            aria-label="Maximum players"
          >
            {options(1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {ids.length < min && <div className="small error">List at least {min} {min === 1 ? 'person' : 'people'}</div>}
      </div>
      <div className="chips">
        {ids.map((id, i) => (
          <span
            key={id}
            className={`chip ${i < usual ? 'chip-primary' : ''}`}
            title={i < usual ? (max === 1 ? 'Usual player' : 'Plays when here') : `Backup #${i - usual + 1}`}
          >
            <button disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier">‹</button>
            {nameOf(id)}
            <button disabled={i === ids.length - 1} onClick={() => move(i, 1)} aria-label="Move later">›</button>
            <button onClick={() => onChange({ memberIds: ids.filter((x) => x !== id) })} aria-label={`Remove ${nameOf(id)}`}>×</button>
          </span>
        ))}
        {unassigned.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && onChange({ memberIds: [...ids, e.target.value] })}
            aria-label="Add player"
          >
            <option value="">{ids.length < max ? '+ player' : '+ backup'}</option>
            {unassigned.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
      </div>
      <button className="danger icon" onClick={onRemove} title="Remove part">×</button>
    </li>
  )
}
