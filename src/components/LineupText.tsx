import type { PartLineup } from '../lib/matching'
import type { Id } from '../types'

interface Props {
  parts: PartLineup[]
  nameOf: (id: Id) => string
}

/** One-line summary of who plays what, e.g. "Vox: Sam (sub) · Guitar: Alex, Kim (1 fewer)". */
export function LineupText({ parts, nameOf }: Props) {
  return (
    <div className="lineup small">
      {parts.map((p) => {
        const empty = p.memberIds.length === 0
        return (
          <span key={p.partId} className={empty ? (p.required ? 'missing' : 'dropped') : p.subs.length ? 'sub' : ''}>
            {p.partName}:{' '}
            {empty
              ? p.required
                ? 'nobody'
                : 'dropped'
              : p.memberIds.map((id) => nameOf(id) + (p.subs.includes(id) ? ' (sub)' : '')).join(', ')}
            {!empty && p.dropped > 0 && <span className="muted"> ({p.dropped} fewer)</span>}
          </span>
        )
      })}
    </div>
  )
}
