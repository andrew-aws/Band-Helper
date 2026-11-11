import { useLocalStorage } from '../hooks/useLocalStorage'
import type { BandActions } from '../hooks/useBandData'
import { analyzeSong } from '../lib/matching'
import type { Id, Member, Song } from '../types'
import { AvailabilityPicker } from './AvailabilityPicker'
import { LyricSheets, type SheetOptions } from './LyricSheets'

interface Props {
  songs: Song[]
  setlist: Id[]
  members: Member[]
  actions: BandActions
  absent: ReadonlySet<Id>
  available: ReadonlySet<Id>
  onToggleAbsent: (id: Id) => void
}

const DEFAULT_OPTIONS: SheetOptions = {
  showTitle: '',
  fontSize: 'md',
  showLineup: true,
  twoColumn: false,
  coverPage: true,
}

export function Setlist({ songs, setlist, members, actions, absent, available, onToggleAbsent }: Props) {
  const [options, setOptions] = useLocalStorage<SheetOptions>('band-helper:sheet-options', DEFAULT_OPTIONS)
  const set = (patch: Partial<SheetOptions>) => setOptions((o) => ({ ...o, ...patch }))

  const setSongs = setlist.map((id) => songs.find((s) => s.id === id)).filter((s): s is Song => !!s)
  const notInSet = songs.filter((s) => !setlist.includes(s.id))

  const move = (i: number, dir: -1 | 1) => {
    const next = [...setlist]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    actions.setSetlist(next)
  }

  return (
    <>
      <div className="grid-2 no-print">
        <section className="card">
          <h2>Setlist</h2>
          {setSongs.length === 0 && <p className="muted">Nothing in the setlist yet.</p>}
          <ol className="setlist">
            {setSongs.map((s, i) => (
              <li key={s.id} className="row">
                <span className="setlist-number">{i + 1}.</span>
                <span className="grow">
                  {s.title}
                  {!s.lyrics.trim() && <span className="badge warn">no lyrics</span>}
                  {analyzeSong(s, available).status === 'unplayable' && (
                    <span className="badge warn">can’t cover all parts</span>
                  )}
                </span>
                <button className="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                <button className="icon" disabled={i === setSongs.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                <button className="icon danger" onClick={() => actions.toggleInSetlist(s.id)} aria-label="Remove from setlist">×</button>
              </li>
            ))}
          </ol>
          {notInSet.length > 0 && (
            <select value="" onChange={(e) => e.target.value && actions.toggleInSetlist(e.target.value)} aria-label="Add song to setlist">
              <option value="">+ Add a song…</option>
              {notInSet.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          )}
        </section>

        <section className="card">
          <h2>Lyric sheets</h2>
          <div className="stack">
            <input
              placeholder="Show name / date (optional)"
              value={options.showTitle}
              onChange={(e) => set({ showTitle: e.target.value })}
            />
            <label className="row">
              Text size
              <select value={options.fontSize} onChange={(e) => set({ fontSize: e.target.value as SheetOptions['fontSize'] })}>
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
                <option value="xl">Extra large</option>
              </select>
            </label>
            <label className="row"><input type="checkbox" checked={options.coverPage} onChange={(e) => set({ coverPage: e.target.checked })} /> Set list cover page</label>
            <label className="row"><input type="checkbox" checked={options.showLineup} onChange={(e) => set({ showLineup: e.target.checked })} /> Show who plays what on each sheet</label>
            {options.showLineup && members.length > 0 && (
              <div className="stack availability-inline">
                <span className="small muted">
                  Who’s playing this show? Backups fill in for anyone missing.
                </span>
                <AvailabilityPicker members={members} absent={absent} onToggle={onToggleAbsent} />
              </div>
            )}
            <label className="row"><input type="checkbox" checked={options.twoColumn} onChange={(e) => set({ twoColumn: e.target.checked })} /> Two columns</label>
            <div>
              <button className="primary" disabled={setSongs.length === 0} onClick={() => window.print()}>
                Print / save as PDF
              </button>
            </div>
          </div>
        </section>
      </div>

      {setSongs.length > 0 && (
        <section className="print-area">
          <h2 className="no-print">Preview</h2>
          <LyricSheets songs={setSongs} members={members} options={options} available={available} />
        </section>
      )}
    </>
  )
}
