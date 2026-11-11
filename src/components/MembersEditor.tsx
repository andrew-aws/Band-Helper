import { useState, type FormEvent } from 'react'
import type { BandActions } from '../hooks/useBandData'
import type { Member } from '../types'

interface Props {
  members: Member[]
  actions: BandActions
}

export function MembersEditor({ members, actions }: Props) {
  const [name, setName] = useState('')

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    actions.addMember(name.trim())
    setName('')
  }

  return (
    <section className="card">
      <h2>Members</h2>
      <form className="row" onSubmit={handleAdd}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="primary">Add</button>
      </form>
      <ul className="members">
        {members.map((m) => (
          <li key={m.id} className="row">
            <input
              value={m.name}
              onChange={(e) => actions.renameMember(m.id, e.target.value)}
              aria-label="Member name"
            />
            <button
              className="danger icon"
              title={`Remove ${m.name}`}
              onClick={() => {
                if (confirm(`Remove ${m.name}? They'll be taken off every song.`)) actions.removeMember(m.id)
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {members.length === 0 && <p className="muted small">Add your band members first.</p>}
    </section>
  )
}
