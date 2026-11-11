/**
 * Client for LRCLIB (https://lrclib.net) — a free, open lyrics database.
 * No API key required and CORS is enabled, so we can call it from the browser.
 */

const BASE_URL = 'https://lrclib.net/api'

export interface LrclibTrack {
  id: number
  trackName: string
  artistName: string
  albumName: string | null
  duration: number | null
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

export interface SearchParams {
  title?: string
  artist?: string
}

export async function searchLyrics(
  { title = '', artist = '' }: SearchParams,
  signal?: AbortSignal,
): Promise<LrclibTrack[]> {
  title = title.trim()
  artist = artist.trim()

  const url = new URL(`${BASE_URL}/search`)
  if (title && artist) {
    url.searchParams.set('track_name', title)
    url.searchParams.set('artist_name', artist)
  } else {
    // `q` matches across title, artist and album.
    url.searchParams.set('q', title || artist)
  }

  const res = await fetch(url, { signal })
  if (!res.ok) {
    throw new Error(`Lyrics search failed (${res.status} ${res.statusText})`)
  }
  const tracks = (await res.json()) as LrclibTrack[]
  return dedupe(tracks)
}

/** Plain lyrics, falling back to synced lyrics with timestamps stripped. */
export function lyricsFromTrack(track: LrclibTrack): string {
  if (track.plainLyrics) return track.plainLyrics
  if (track.syncedLyrics) {
    return track.syncedLyrics
      .split('\n')
      .map((line) => line.replace(/^\[[\d:.]+\]\s?/, ''))
      .join('\n')
  }
  return ''
}

/** LRCLIB often returns the same song several times (one per album release). */
function dedupe(tracks: LrclibTrack[]): LrclibTrack[] {
  const seen = new Set<string>()
  return tracks.filter((t) => {
    const key = [
      t.trackName.toLowerCase().trim(),
      t.artistName.toLowerCase().trim(),
      lyricsFromTrack(t).slice(0, 200).toLowerCase(),
    ].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
