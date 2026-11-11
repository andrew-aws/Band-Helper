import type { Id, Member } from '../types'

interface Props {
  members: Member[]
  absent: ReadonlySet<Id>
  onToggle: (id: Id) => void
}

export function AvailabilityPicker({ members, absent, onToggle }: Props) {
  return (
    <div className="row wrap">
      {members.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`chip-button ${absent.has(m.id) ? 'absent' : 'present'}`}
          onClick={() => onToggle(m.id)}
          aria-pressed={!absent.has(m.id)}
        >
          {absent.has(m.id) ? '✗' : '✓'} {m.name}
        </button>
      ))}
    </div>
  )
}
