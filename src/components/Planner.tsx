import { useMemo, useState } from 'react'
import { analyzeSong, canPracticeTogether, partsFromAssignment, planPractice } from '../lib/matching'
import type { Id, Member, Song } from '../types'
import { AvailabilityPicker } from './AvailabilityPicker'
import { LineupText } from './LineupText'

interface Props {
  songs: Song[]
  members: Member[]
  absent: ReadonlySet<Id>
  available: ReadonlySet<Id>
  onToggleAbsent: (id: Id) => void
}

export function Planner({ songs, members, absent, available, onToggleAbsent }: Props) {
  const [skipped, setSkipped] = useState<Set<Id>>(new Set())
  const [maxAtOnce, setMaxAtOnce] = useState('')

  const nameOf = (id: Id) => members.find((m) => m.id === id)?.name ?? '?'
  const toggle = (set: ReadonlySet<Id>, id: Id) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  const { playable, unplayable, unconfigured } = useMemo(() => {
    const analyses = songs.map((song) => ({ song, result: analyzeSong(song, available) }))
    return {
      playable: analyses.filter((a) => a.result.status === 'playable'),
      unplayable: analyses.filter((a) => a.result.status === 'unplayable'),
      unconfigured: analyses.filter((a) => a.result.status === 'unconfigured'),
    }
  }, [songs, available])

  const practiceSongs = useMemo(
    () => playable.map((a) => a.song).filter((s) => !skipped.has(s.id)),
    [playable, skipped],
  )
  const max = Number(maxAtOnce) > 0 ? Number(maxAtOnce) : Infinity
  const plan = useMemo(() => planPractice(practiceSongs, available, max), [practiceSongs, available, max])

  if (members.length === 0) {
    return (
      <section className="card">
        <p className="muted">Add members and assign parts on the Lineups tab first.</p>
      </section>
    )
  }

  return (
    <>
      <section className="card">
        <h2>Who’s here?</h2>
        <AvailabilityPicker members={members} absent={absent} onToggle={onToggleAbsent} />
        <p className="summary">
          With <strong>{available.size}</strong> of {members.length} members, you can play{' '}
          <strong>{playable.length}</strong> of {songs.length - unconfigured.length} songs.
          {unconfigured.length > 0 && (
            <span className="muted small"> ({unconfigured.length} song{unconfigured.length === 1 ? ' has' : 's have'} no parts set up.)</span>
          )}
        </p>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Can play <span className="muted small">({playable.length})</span></h2>
          <ul className="analysis">
            {playable.map(({ song, result }) =>
              result.status !== 'playable' ? null : (
                <li key={song.id}>
                  <strong>{song.title}</strong>
                  <LineupText parts={result.parts} nameOf={nameOf} />
                </li>
              ),
            )}
          </ul>
        </section>

        <section className="card">
          <h2>Can’t play <span className="muted small">({unplayable.length})</span></h2>
          {unplayable.length === 0 && <p className="muted">Nothing — you’re good!</p>}
          <ul className="analysis">
            {unplayable.map(({ song, result }) =>
              result.status !== 'unplayable' ? null : (
                <li key={song.id}>
                  <strong>{song.title}</strong>
                  <div className="small muted">{result.problem}</div>
                </li>
              ),
            )}
          </ul>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <h2>Practice plan</h2>
          <label className="row small">
            Max songs at once
            <input
              type="number"
              min={1}
              placeholder="no limit"
              value={maxAtOnce}
              onChange={(e) => setMaxAtOnce(e.target.value)}
              className="narrow"
            />
          </label>
        </div>
        <p className="muted small">
          Songs in the same round need no one in two places, so they can be rehearsed at the same time
          (e.g. in separate rooms). Someone can sing and play within one song, but can’t be in two
          songs at once. Only each part’s minimum has to fit, and extra spots go to whoever’s free.
          Uncheck songs you don’t need to practice.
        </p>

        <div className="row wrap">
          {playable.map(({ song }) => (
            <label key={song.id} className="chip-button">
              <input
                type="checkbox"
                checked={!skipped.has(song.id)}
                onChange={() => setSkipped(toggle(skipped, song.id))}
              />{' '}
              {song.title}
            </label>
          ))}
        </div>

        <ol className="rounds">
          {plan.rounds.map((round, i) => (
            <li key={i} className="round">
              <h3>Round {i + 1}</h3>
              <div className="round-songs">
                {round.songIds.map((songId) => {
                  const song = songs.find((s) => s.id === songId)!
                  return (
                    <div key={songId} className="round-song">
                      <strong>{song.title}</strong>
                      <LineupText parts={partsFromAssignment(song, round.lineup)} nameOf={nameOf} />
                    </div>
                  )
                })}
              </div>
              {round.idle.length > 0 && (
                <div className="small muted">Free: {round.idle.map(nameOf).join(', ')}</div>
              )}
            </li>
          ))}
        </ol>

        {practiceSongs.length > 1 && (
          <PairMatrix songs={practiceSongs} available={available} />
        )}
      </section>
    </>
  )
}

function PairMatrix({ songs, available }: { songs: Song[]; available: ReadonlySet<Id> }) {
  const matrix = useMemo(
    () => songs.map((a) => songs.map((b) => a.id !== b.id && canPracticeTogether([a, b], available) !== null)),
    [songs, available],
  )

  return (
    <details className="matrix-details">
      <summary>Which pairs can practice at the same time?</summary>
      <div className="matrix-scroll">
        <table className="matrix">
          <thead>
            <tr>
              <th />
              {songs.map((s) => (
                <th key={s.id} className="matrix-col"><span>{s.title}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {songs.map((a, i) => (
              <tr key={a.id}>
                <th>{a.title}</th>
                {songs.map((b, j) => (
                  <td key={b.id} className={i === j ? 'self' : matrix[i][j] ? 'yes' : 'no'}>
                    {i === j ? '' : matrix[i][j] ? '✓' : '·'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
