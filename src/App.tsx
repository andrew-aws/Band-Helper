import { useMemo, useRef, useState } from 'react'
import { MembersEditor } from './components/MembersEditor'
import { PartsEditor } from './components/PartsEditor'
import { Planner } from './components/Planner'
import { Setlist } from './components/Setlist'
import { SongLibrary } from './components/SongLibrary'
import { SongSearch } from './components/SongSearch'
import { isBandData, useBandData } from './hooks/useBandData'
import { useLocalStorage } from './hooks/useLocalStorage'
import type { Id } from './types'

const TABS = [
  { id: 'songs', label: 'Songs' },
  { id: 'lineups', label: 'Lineups' },
  { id: 'setlist', label: 'Setlist & sheets' },
  { id: 'planner', label: 'Who’s here?' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [data, actions] = useBandData()
  const [tab, setTab] = useState<TabId>('songs')
  const fileInput = useRef<HTMLInputElement>(null)

  // Who's missing — shared by the planner and the lyric sheets.
  const [absentIds, setAbsentIds] = useLocalStorage<Id[]>('band-helper:absent', [])
  const absent = useMemo(() => new Set(absentIds), [absentIds])
  const available = useMemo(
    () => new Set(data.members.filter((m) => !absent.has(m.id)).map((m) => m.id)),
    [data.members, absent],
  )
  const toggleAbsent = (id: Id) =>
    setAbsentIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  const availability = { absent, available, onToggleAbsent: toggleAbsent }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `band-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const isEmpty = data.members.length === 0 && data.songs.length === 0

  function resetData() {
    const ok = confirm(
      'Start fresh?\n\nThis deletes all songs, members, lineups and the setlist from this browser. ' +
        'Use Export first if you want to keep them.',
    )
    if (!ok) return
    actions.reset()
    setAbsentIds([])
    setTab('songs')
  }

  async function importData(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isBandData(parsed)) throw new Error('Not a band data file')
      if (confirm('Replace all current songs, members and setlist with this file?')) {
        actions.replaceAll(parsed)
        setAbsentIds([])
      }
    } catch (err) {
      alert(`Couldn't import: ${(err as Error).message}`)
    }
  }

  return (
    <div className="app">
      <header className="app-header no-print">
        <h1>Band Helper</h1>
        <div className="row">
          <button onClick={exportData} disabled={isEmpty}>Export</button>
          <button onClick={() => fileInput.current?.click()}>Import</button>
          <button className="danger" onClick={resetData} disabled={isEmpty}>Reset</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importData(file)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      <nav className="tabs no-print" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'songs' && (
          <div className="no-print">
            <SongSearch songs={data.songs} onAdd={actions.addSong} />
            <SongLibrary songs={data.songs} setlist={data.setlist} actions={actions} />
          </div>
        )}

        {tab === 'lineups' && (
          <div className="layout-sidebar no-print">
            <MembersEditor members={data.members} actions={actions} />
            <div>
              <PartsEditor songs={data.songs} members={data.members} actions={actions} />
            </div>
          </div>
        )}

        {tab === 'setlist' && (
          <Setlist
            songs={data.songs}
            setlist={data.setlist}
            members={data.members}
            actions={actions}
            {...availability}
          />
        )}

        {tab === 'planner' && (
          <div className="no-print">
            <Planner songs={data.songs} members={data.members} {...availability} />
          </div>
        )}
      </main>
    </div>
  )
}
