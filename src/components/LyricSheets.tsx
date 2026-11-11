import { analyzeSong } from '../lib/matching'
import type { Id, Member, Song } from '../types'

export interface SheetOptions {
  showTitle: string
  fontSize: 'sm' | 'md' | 'lg' | 'xl'
  showLineup: boolean
  twoColumn: boolean
  coverPage: boolean
}

interface Props {
  songs: Song[]
  members: Member[]
  options: SheetOptions
  /** Members who are here; lineups use backups for anyone missing. */
  available: ReadonlySet<Id>
}

export function LyricSheets({ songs, members, options, available }: Props) {
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '?'

  return (
    <div className={`sheets font-${options.fontSize}`}>
      {options.coverPage && (
        <article className="sheet sheet-cover">
          <h1>{options.showTitle || 'Set list'}</h1>
          <ol>
            {songs.map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
          </ol>
        </article>
      )}

      {songs.map((s, i) => {
        const result = analyzeSong(s, available)
        const problem = result.status === 'unplayable' ? result.problem : null
        // Optional parts nobody's playing tonight are simply left off.
        const entries =
          result.status === 'unconfigured' ? [] : result.parts.filter((p) => p.memberIds.length > 0 || p.required)
        return (
          <article key={s.id} className="sheet">
            <header className="sheet-header">
              <h2>
                <span className="sheet-number">{i + 1}.</span> {s.title}
              </h2>
              {s.artist && <div className="sheet-artist">{s.artist}</div>}
              {options.showLineup && entries.length > 0 && (
                <div className="sheet-lineup">
                  {entries.map((e) => (
                    <span key={e.partId}>
                      {e.partName}:{' '}
                      {e.memberIds.length > 0 ? (
                        e.memberIds.map((id, i) => (
                          <strong key={id}>
                            {i > 0 && ', '}
                            {nameOf(id)}
                            {e.subs.includes(id) && <span className="sheet-sub"> (sub)</span>}
                          </strong>
                        ))
                      ) : (
                        <strong className="sheet-missing">—</strong>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {options.showLineup && problem && <div className="sheet-problem">⚠ {problem}</div>}
            </header>
            <div className={`sheet-lyrics ${options.twoColumn ? 'two-col' : ''}`}>
              {s.lyrics.trim() || <em>No lyrics yet — add them on the Songs tab.</em>}
            </div>
          </article>
        )
      })}
    </div>
  )
}
