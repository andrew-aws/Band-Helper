export type Id = string

export interface Member {
  id: Id
  name: string
}

export type PartKind = 'vocal' | 'instrument'

export interface Part {
  id: Id
  /** e.g. "Lead vocals", "Bass" */
  name: string
  /**
   * One person can take one vocal part and one instrument part in the same
   * song. If unset, it's guessed from the name (see partKind()).
   */
  kind?: PartKind
  /**
   * Who can play this part, in order of preference.
   * The first entry is the usual player; the rest are backups.
   */
  memberIds: Id[]
  /**
   * Fewest players needed (default 1). 0 makes the part optional: it's dropped
   * when nobody's available.
   */
  min?: number
  /**
   * Most players who play it at once (default 1). The first `max` people on
   * the list all play when they're here, and spots above `min` are dropped
   * when people are missing.
   */
  max?: number
}

export interface Song {
  id: Id
  title: string
  artist: string
  album?: string
  lyrics: string
  source: 'lrclib' | 'manual'
  lrclibId?: number
  parts: Part[]
}

export interface BandData {
  version: 1
  members: Member[]
  songs: Song[]
  /** Ordered song ids for the next show. */
  setlist: Id[]
}

export type NewSong = Omit<Song, 'id' | 'parts'>
