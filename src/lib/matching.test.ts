import { describe, expect, it } from 'vitest'
import type { Part, Song } from '../types'
import { analyzeSong, canPracticeTogether, partKind, partsFromAssignment, planPractice } from './matching'

let n = 0
const part = (name: string, ...memberIds: string[]): Part => ({ id: `p${n++}`, name, memberIds })
const sized = (min: number, max: number, name: string, ...memberIds: string[]): Part => ({
  ...part(name, ...memberIds),
  min,
  max,
})
const song = (id: string, ...parts: Part[]): Song => ({
  id,
  title: id,
  artist: '',
  lyrics: '',
  source: 'manual',
  parts,
})
const here = (...ids: string[]) => new Set(ids)

/** Compact view of a playable song's lineup: { partName: [members] } */
function lineupOf(s: Song, available: Set<string>) {
  const r = analyzeSong(s, available)
  if (r.status !== 'playable') throw new Error(`expected playable, got ${r.status}`)
  return Object.fromEntries(r.parts.map((p) => [p.partName, p.memberIds]))
}

describe('analyzeSong', () => {
  it('uses the usual lineup when everyone is here', () => {
    const s = song('a', part('Vox', 'alex', 'sam'), part('Drums', 'jo'))
    expect(lineupOf(s, here('alex', 'sam', 'jo'))).toEqual({ Vox: ['alex'], Drums: ['jo'] })
  })

  it('falls back to a backup and flags the substitution', () => {
    const s = song('a', part('Vox', 'alex', 'sam'), part('Drums', 'jo'))
    const r = analyzeSong(s, here('sam', 'jo'))
    expect(r.status).toBe('playable')
    if (r.status !== 'playable') return
    expect(r.parts[0]).toMatchObject({ memberIds: ['sam'], subs: ['sam'], dropped: 0 })
  })

  it('reshuffles people to cover every part', () => {
    // Sam is first choice for both; Alex can only do guitar.
    const s = song('a', part('Vox', 'sam', 'jo'), part('Guitar', 'sam', 'alex'))
    expect(analyzeSong(s, here('sam', 'jo', 'alex')).status).toBe('playable')
  })

  it('names parts nobody available can play', () => {
    const r = analyzeSong(song('a', part('Vox', 'alex'), part('Drums', 'jo')), here('alex'))
    expect(r).toMatchObject({ status: 'unplayable', uncoveredParts: ['Drums'] })
  })

  it('detects when one person would be needed on two instruments', () => {
    const r = analyzeSong(song('a', part('Bass', 'alex'), part('Guitar', 'alex')), here('alex'))
    expect(r).toMatchObject({ status: 'unplayable', uncoveredParts: [] })
  })

  it('gives a best-effort lineup for unplayable songs', () => {
    const r = analyzeSong(song('a', part('Vox', 'alex', 'sam'), part('Drums', 'jo')), here('sam'))
    expect(r.status).toBe('unplayable')
    if (r.status !== 'unplayable') return
    expect(r.parts.map((p) => p.memberIds)).toEqual([['sam'], []])
  })

  it('reports songs with no parts as unconfigured', () => {
    expect(analyzeSong(song('a'), here('alex')).status).toBe('unconfigured')
  })
})

describe('min/max players per part', () => {
  const guitars = () => sized(1, 3, 'Guitar', 'alex', 'sam', 'kim')

  it('everyone plays when everyone is here', () => {
    const s = song('a', guitars(), part('Drums', 'jo'))
    expect(lineupOf(s, here('alex', 'sam', 'kim', 'jo')).Guitar).toEqual(['alex', 'sam', 'kim'])
  })

  it('drops extra spots when people are missing', () => {
    const s = song('a', guitars(), part('Drums', 'jo'))
    const r = analyzeSong(s, here('sam', 'jo'))
    expect(r.status).toBe('playable')
    if (r.status !== 'playable') return
    expect(r.parts[0]).toMatchObject({ memberIds: ['sam'], subs: [], dropped: 2 })
  })

  it('drops an optional part entirely when nobody is available', () => {
    const s = song('a', part('Vox', 'alex'), sized(0, 1, 'Tambourine', 'kim'))
    expect(lineupOf(s, here('alex')).Tambourine).toEqual([])
  })

  it('still requires the minimum', () => {
    const s = song('a', sized(2, 3, 'Guitar', 'alex', 'sam', 'kim'))
    expect(analyzeSong(s, here('alex'))).toMatchObject({
      status: 'unplayable',
      uncoveredParts: ['Guitar (needs 2)'],
    })
  })

  it('never lets extra spots take someone a required part needs', () => {
    // Sam is listed first on guitar but is the only bassist.
    const s = song('a', sized(1, 2, 'Guitar', 'sam', 'alex'), part('Bass', 'sam'))
    expect(lineupOf(s, here('sam', 'alex'))).toEqual({ Guitar: ['alex'], Bass: ['sam'] })
  })

  it('lets backups fill extra spots beyond the usual players', () => {
    const s = song('a', sized(1, 2, 'Guitar', 'alex', 'sam', 'kim'))
    const r = analyzeSong(s, here('alex', 'kim'))
    expect(r.status).toBe('playable')
    if (r.status !== 'playable') return
    expect(r.parts[0]).toMatchObject({ memberIds: ['alex', 'kim'], subs: ['kim'], dropped: 0 })
  })
})

describe('singing and playing', () => {
  it('lets one person sing and play in the same song', () => {
    const s = song('a', part('Lead vocals', 'sam'), part('Guitar', 'sam'), part('Drums', 'jo'))
    expect(lineupOf(s, here('sam', 'jo'))).toEqual({ 'Lead vocals': ['sam'], Guitar: ['sam'], Drums: ['jo'] })
  })

  it('does not let one person take two vocal parts', () => {
    const s = song('a', part('Lead vocals', 'sam'), part('Harmony', 'sam'))
    expect(analyzeSong(s, here('sam')).status).toBe('unplayable')
  })

  it('respects an explicit kind over the name', () => {
    const shout = { ...part('Shouting', 'sam'), kind: 'vocal' as const }
    const s = song('a', shout, part('Guitar', 'sam'))
    expect(analyzeSong(s, here('sam')).status).toBe('playable')
    const notVocal = { ...part('Vocoder', 'sam'), kind: 'instrument' as const }
    expect(analyzeSong(song('b', notVocal, part('Guitar', 'sam')), here('sam')).status).toBe('unplayable')
  })

  it('guesses the kind from the name', () => {
    expect(partKind(part('Backing vox'))).toBe('vocal')
    expect(partKind(part('Lead Vocals'))).toBe('vocal')
    expect(partKind(part('Keys'))).toBe('instrument')
  })

  it('lets extra spots use someone who is already playing the other kind', () => {
    const s = song('a', part('Drums', 'jo'), sized(0, 2, 'Backing vocals', 'jo', 'kim'))
    expect(lineupOf(s, here('jo', 'kim'))['Backing vocals']).toEqual(['jo', 'kim'])
  })
})

describe('practice planning', () => {
  const all = here('alex', 'sam', 'jo', 'kim')

  it('pairs songs with disjoint lineups', () => {
    const a = song('a', part('Vox', 'alex'), part('Gtr', 'sam'))
    const b = song('b', part('Vox', 'jo'), part('Gtr', 'kim'))
    expect(canPracticeTogether([a, b], all)).not.toBeNull()
  })

  it('uses backups to make songs fit together', () => {
    const a = song('a', part('Vox', 'alex'), part('Gtr', 'sam'))
    const b = song('b', part('Vox', 'alex', 'jo'), part('Gtr', 'kim'))
    const lineup = canPracticeTogether([a, b], all)!
    expect(partsFromAssignment(b, lineup)[0].memberIds).toEqual(['jo'])
  })

  it('only needs the minimum players to fit songs together', () => {
    const a = song('a', sized(1, 3, 'Guitar', 'alex', 'sam', 'kim'))
    const b = song('b', part('Vox', 'sam'))
    const lineup = canPracticeTogether([a, b], all)!
    expect(partsFromAssignment(a, lineup)[0].memberIds).toEqual(['alex', 'kim'])
    expect(partsFromAssignment(b, lineup)[0].memberIds).toEqual(['sam'])
  })

  it('does not let someone sing in one song while playing in another', () => {
    const a = song('a', part('Vox', 'sam'))
    const b = song('b', part('Guitar', 'sam'))
    expect(canPracticeTogether([a, b], all)).toBeNull()
  })

  it('finds a split when someone has to sing and play in one song', () => {
    // Sam must do both parts of A; B needs one of Sam or Jo on drums.
    const a = song('a', part('Vox', 'sam'), part('Guitar', 'sam', 'jo'))
    const b = song('b', part('Drums', 'jo', 'sam'), part('Bass', 'kim'))
    const lineup = canPracticeTogether([a, b], here('sam', 'jo', 'kim'))!
    expect(partsFromAssignment(a, lineup).map((p) => p.memberIds)).toEqual([['sam'], ['sam']])
    expect(partsFromAssignment(b, lineup).map((p) => p.memberIds)).toEqual([['jo'], ['kim']])
  })

  it('needs the search when nobody-doubles-up fails', () => {
    // Without doubling, A needs both Sam and Jo, leaving nobody for B's drums.
    // With Sam singing and playing in A, Jo is free for B.
    const a = song('a', part('Vox', 'sam'), part('Guitar', 'sam', 'jo'))
    const b = song('b', part('Drums', 'jo'))
    const lineup = canPracticeTogether([a, b], here('sam', 'jo'))
    expect(lineup).not.toBeNull()
    expect(partsFromAssignment(b, lineup!)[0].memberIds).toEqual(['jo'])
  })

  it('splits conflicting songs into separate rounds', () => {
    const a = song('a', part('Vox', 'alex'))
    const b = song('b', part('Vox', 'alex'))
    const c = song('c', part('Drums', 'jo'))
    const plan = planPractice([a, b, c], all)
    expect(plan.rounds).toHaveLength(2)
    expect(plan.rounds[0].songIds.sort()).toEqual(['a', 'c'])
    expect(plan.rounds[1].songIds).toEqual(['b'])
    expect(plan.rounds[1].idle.sort()).toEqual(['jo', 'kim', 'sam'])
  })

  it('respects the max songs per round', () => {
    const songs = ['a', 'b', 'c'].map((id, i) => song(id, part('X', [...all][i])))
    expect(planPractice(songs, all, 2).rounds.map((r) => r.songIds.length)).toEqual([2, 1])
  })

  it('lists songs that cannot be played at all', () => {
    const plan = planPractice([song('a', part('Vox', 'nobody'))], all)
    expect(plan).toEqual({ rounds: [], unplayable: ['a'] })
  })
})
