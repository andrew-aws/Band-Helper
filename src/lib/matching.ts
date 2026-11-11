import type { Id, Part, PartKind, Song } from '../types'

// ---------------------------------------------------------------------------
// Part sizing and kind
// ---------------------------------------------------------------------------

/** Fewest players the part needs for the song to work (0 = optional part). */
export const partMin = (p: Part) => Math.max(0, p.min ?? 1)
/** Most players the part uses when everyone's around. */
export const partMax = (p: Part) => Math.max(1, partMin(p), p.max ?? 1)
/** How many people normally play this part: the first N on its list. */
export const usualCount = (p: Part) => Math.min(partMax(p), p.memberIds.length)
/** Spots to try to fill. (If min exceeds the list, the extra spots can never be filled.) */
const spotCount = (p: Part) => Math.max(partMin(p), usualCount(p))

const VOCAL_NAME = /vocal|vox|sing|voice|harmon|choir|rap|\bmc\b/i

/** Vocal or instrument: explicit setting, otherwise guessed from the name. */
export const partKind = (p: Part): PartKind => p.kind ?? (VOCAL_NAME.test(p.name) ? 'vocal' : 'instrument')

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * A "slot" is one spot that one person can fill. A part with "1 to 3 players"
 * becomes one required slot and two optional ones.
 *
 * Within one song, a person can fill one vocal slot and one instrument slot
 * (sing and play) but never two of the same kind. So each person is really
 * two resources, "vocal|sam" and "instrument|sam", and whether a song is
 * playable is a bipartite matching of slots to those resources. Once the
 * required slots are filled, the optional ones get as many of the remaining
 * people as possible.
 *
 * Across songs being rehearsed at the same time, a person can only be in one
 * song. See canPracticeTogether().
 */
export interface Slot {
  key: string
  songId: Id
  kind: PartKind
  candidates: Id[]
  required: boolean
  /** Who normally fills this spot. */
  preferred?: Id
}

/** Map of slot key -> member id. Unfilled optional slots are absent. */
export type Assignment = Map<string, Id>

type ResourceOf = (slot: Slot, member: Id) => string
/** A person can sing and play at the same time. */
const singAndPlay: ResourceOf = (s, m) => `${s.kind}|${m}`
/** A person fills one slot, full stop. */
const oneSlotEach: ResourceOf = (_, m) => m

/**
 * Kuhn's augmenting-path algorithm. Candidates are tried in preference order,
 * so usual players are favored where possible. A slot that has been filled
 * stays filled (its person may change), so we fill required slots first and
 * then fill as many optional slots as possible. The result is a maximum
 * matching. Returns null if some required slot can't be filled.
 */
function kuhn(slots: Slot[], available: ReadonlySet<Id>, resourceOf: ResourceOf): Assignment | null {
  const candidates = slots.map((s) => s.candidates.filter((m) => available.has(m)))
  const slotOfResource = new Map<string, number>()
  const memberAt: (Id | undefined)[] = []

  const tryAssign = (slot: number, visited: Set<string>): boolean => {
    for (const member of candidates[slot]) {
      const r = resourceOf(slots[slot], member)
      if (visited.has(r)) continue
      visited.add(r)
      const current = slotOfResource.get(r)
      if (current === undefined || tryAssign(current, visited)) {
        slotOfResource.set(r, slot)
        memberAt[slot] = member
        return true
      }
    }
    return false
  }

  const order = slots.map((_, i) => i).sort((a, b) => Number(slots[b].required) - Number(slots[a].required))
  for (const i of order) {
    if (!tryAssign(i, new Set()) && slots[i].required) return null
  }

  const result: Assignment = new Map()
  slots.forEach((s, i) => memberAt[i] !== undefined && result.set(s.key, memberAt[i]!))
  return result
}

/** Best lineup for a single song's slots. Returns null if a required slot can't be filled. */
function matchSong(slots: Slot[], available: ReadonlySet<Id>): Assignment | null {
  // Fast path: every usual player is here and nobody is double-booked.
  const preferred = slots.map((s) => s.preferred)
  if (
    preferred.every((m) => m !== undefined && available.has(m)) &&
    new Set(slots.map((s) => singAndPlay(s, s.preferred!))).size === slots.length
  ) {
    return new Map(slots.map((s) => [s.key, s.preferred!]))
  }
  return kuhn(slots, available, singAndPlay)
}

export const slotKey = (songId: Id, partId: Id, spot: number) => `${songId}::${partId}::${spot}`

export function songSlots(song: Song): Slot[] {
  return song.parts.flatMap((p) =>
    Array.from({ length: spotCount(p) }, (_, i) => ({
      key: slotKey(song.id, p.id, i),
      songId: song.id,
      kind: partKind(p),
      candidates: p.memberIds,
      required: i < partMin(p),
      preferred: p.memberIds[i],
    })),
  )
}

// ---------------------------------------------------------------------------
// Lineups
// ---------------------------------------------------------------------------

export interface PartLineup {
  partId: Id
  partName: string
  /** Who's playing it, in the part's preference order. Empty = part dropped. */
  memberIds: Id[]
  /** Backups standing in for usual players. */
  subs: Id[]
  /** Usual spots left empty because people are missing. */
  dropped: number
  /** The song can't work without this part. */
  required: boolean
}

/** Turns a slot assignment back into who's playing each part of a song. */
export function partsFromAssignment(song: Song, assignment: Assignment): PartLineup[] {
  return song.parts.map((p) => {
    const assigned = new Set<Id>()
    for (let i = 0; i < spotCount(p); i++) {
      const m = assignment.get(slotKey(song.id, p.id, i))
      if (m) assigned.add(m)
    }
    const memberIds = p.memberIds.filter((m) => assigned.has(m))
    const usual = new Set(p.memberIds.slice(0, usualCount(p)))
    return {
      partId: p.id,
      partName: p.name || 'Unnamed part',
      memberIds,
      subs: memberIds.filter((m) => !usual.has(m)),
      dropped: Math.max(0, usualCount(p) - memberIds.length),
      required: partMin(p) > 0,
    }
  })
}

// ---------------------------------------------------------------------------
// Single song: can we play it with who's here?
// ---------------------------------------------------------------------------

export type SongAnalysis =
  | { status: 'unconfigured' }
  | { status: 'playable'; parts: PartLineup[] }
  | {
      status: 'unplayable'
      /** Human-readable reason. */
      problem: string
      /** Parts that don't have enough capable people here. Empty means there
       *  are enough capable people, just not enough to cover every part at once. */
      uncoveredParts: string[]
      /** Best-effort lineup (as many spots filled as possible). */
      parts: PartLineup[]
    }

export function analyzeSong(song: Song, available: ReadonlySet<Id>): SongAnalysis {
  if (song.parts.length === 0) return { status: 'unconfigured' }

  const slots = songSlots(song)
  const assignment = matchSong(slots, available)
  if (assignment) return { status: 'playable', parts: partsFromAssignment(song, assignment) }

  const uncoveredParts = song.parts
    .filter((p) => p.memberIds.filter((m) => available.has(m)).length < partMin(p))
    .map((p) => {
      const name = p.name || 'Unnamed part'
      return partMin(p) > 1 ? `${name} (needs ${partMin(p)})` : name
    })

  const bestEffort = kuhn(slots.map((s) => ({ ...s, required: false })), available, singAndPlay)!

  return {
    status: 'unplayable',
    uncoveredParts,
    problem:
      uncoveredParts.length > 0
        ? `Not enough people here for: ${uncoveredParts.join(', ')}`
        : 'Not enough people to cover every part at once',
    parts: partsFromAssignment(song, bestEffort),
  }
}

// ---------------------------------------------------------------------------
// Several songs: what can be rehearsed simultaneously?
// ---------------------------------------------------------------------------

type Pools = Map<Id, Set<Id>>

/**
 * Finds lineups for several songs at once, where each person is in at most one
 * song (but may sing and play within it). Returns null if impossible.
 *
 * The idea: split the people into one group per song so that each song is
 * playable with its own group. That split is worked out by quick checks, with
 * a small search for the hard cases. Then each song gets its best lineup from
 * its group.
 */
export function canPracticeTogether(songs: Song[], available: ReadonlySet<Id>): Assignment | null {
  if (songs.length === 1) return matchSong(songSlots(songs[0]), available)

  const slotsBySong = new Map(songs.map((s) => [s.id, songSlots(s)]))
  const all = [...slotsBySong.values()].flat()

  // Even letting people be in two songs at once, it doesn't work.
  if (!kuhn(all, available, singAndPlay)) return null

  // Usually works without anyone doubling up, and that gives us a valid split.
  let pools: Pools | null = null
  const strict = kuhn(all, available, oneSlotEach)
  if (strict) {
    const songOfSlot = new Map(all.map((s) => [s.key, s.songId]))
    pools = new Map(songs.map((s) => [s.id, new Set<Id>()]))
    for (const [key, member] of strict) pools.get(songOfSlot.get(key)!)!.add(member)
  } else {
    pools = searchPools(songs, slotsBySong, available)
  }
  if (!pools) return null

  // Best lineup per song from its group, then offer anyone left over to
  // songs with open extra spots.
  const lineups = new Map(songs.map((s) => [s.id, matchSong(slotsBySong.get(s.id)!, pools.get(s.id)!)!]))
  const busy = () => new Set([...lineups.values()].flatMap((a) => [...a.values()]))
  for (const member of available) {
    if (busy().has(member)) continue
    for (const song of songs) {
      if (!song.parts.some((p) => p.memberIds.includes(member))) continue
      const trial = new Set(pools.get(song.id)).add(member)
      const lineup = matchSong(slotsBySong.get(song.id)!, trial)!
      if (lineup.size > lineups.get(song.id)!.size) {
        pools.set(song.id, trial)
        lineups.set(song.id, lineup)
        break
      }
    }
  }

  return new Map([...lineups.values()].flatMap((a) => [...a]))
}

/**
 * Backtracking search: put each person in one song's group (or none), giving
 * up on a branch as soon as some song can't work even if it got every
 * undecided person who could join it. Band-sized inputs keep this small.
 */
function searchPools(songs: Song[], slotsBySong: Map<Id, Slot[]>, available: ReadonlySet<Id>): Pools | null {
  const eligible = (m: Id) => songs.filter((s) => s.parts.some((p) => p.memberIds.includes(m)))
  const people = [...available]
    .map((m) => ({ m, songs: eligible(m) }))
    .filter((x) => x.songs.length > 0)
    .sort((a, b) => a.songs.length - b.songs.length)

  const pools: Pools = new Map(songs.map((s) => [s.id, new Set<Id>()]))

  const stillPossible = (next: number) =>
    songs.every((song) => {
      const pool = new Set(pools.get(song.id))
      for (let j = next; j < people.length; j++) {
        if (people[j].songs.includes(song)) pool.add(people[j].m)
      }
      return matchSong(slotsBySong.get(song.id)!, pool) !== null
    })

  const dfs = (i: number): boolean => {
    if (!stillPossible(i)) return false
    if (i === people.length) return true
    const { m, songs: options } = people[i]
    for (const song of options) {
      pools.get(song.id)!.add(m)
      if (dfs(i + 1)) return true
      pools.get(song.id)!.delete(m)
    }
    return dfs(i + 1) // sits this one out
  }

  return dfs(0) ? pools : null
}

export interface PracticeRound {
  songIds: Id[]
  /** Slot assignment across all songs in the round (see partsFromAssignment). */
  lineup: Assignment
  /** Available members not needed this round. */
  idle: Id[]
}

export interface PracticePlan {
  rounds: PracticeRound[]
  /** Songs that can't be played at all with who's available (or have no parts). */
  unplayable: Id[]
}

/**
 * Groups songs into rounds where every song in a round can be rehearsed at the
 * same time (no one is needed in two places). Only the minimum players
 * have to fit. Extra spots are filled with whoever is free. Greedy first-fit,
 * placing the songs that need the most people first. It isn't guaranteed to
 * find the fewest rounds, but it does a good job.
 *
 * @param maxPerRound cap on simultaneous songs (e.g. number of rehearsal rooms)
 */
export function planPractice(
  songs: Song[],
  available: ReadonlySet<Id>,
  maxPerRound = Infinity,
): PracticePlan {
  const unplayable: Id[] = []
  const rounds: { songs: Song[]; lineup: Assignment }[] = []

  const needed = (s: Song) => s.parts.reduce((n, p) => n + partMin(p), 0)
  const ordered = [...songs].sort((a, b) => needed(b) - needed(a))

  for (const song of ordered) {
    const solo = song.parts.length > 0 ? matchSong(songSlots(song), available) : null
    if (!solo) {
      unplayable.push(song.id)
      continue
    }

    let placed = false
    for (const round of rounds) {
      if (round.songs.length >= maxPerRound) continue
      const lineup = canPracticeTogether([...round.songs, song], available)
      if (lineup) {
        round.songs.push(song)
        round.lineup = lineup
        placed = true
        break
      }
    }
    if (!placed) rounds.push({ songs: [song], lineup: solo })
  }

  return {
    unplayable,
    rounds: rounds.map((r) => {
      const busy = new Set(r.lineup.values())
      return {
        songIds: r.songs.map((s) => s.id),
        lineup: r.lineup,
        idle: [...available].filter((m) => !busy.has(m)),
      }
    }),
  }
}
