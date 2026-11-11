import { useMemo } from 'react'
import type { BandData, Id, NewSong, Part, Song } from '../types'
import { useLocalStorage } from './useLocalStorage'

const STORAGE_KEY = 'band-helper:data'
const EMPTY: BandData = { version: 1, members: [], songs: [], setlist: [] }

const newId = () => crypto.randomUUID()

export function isBandData(value: unknown): value is BandData {
  const v = value as BandData
  return (
    !!v &&
    Array.isArray(v.members) &&
    Array.isArray(v.songs) &&
    Array.isArray(v.setlist) &&
    v.songs.every((s) => typeof s.id === 'string' && Array.isArray(s.parts))
  )
}

export function useBandData() {
  const [data, setData] = useLocalStorage<BandData>(STORAGE_KEY, EMPTY)

  const actions = useMemo(() => {
    const mapSong = (songId: Id, fn: (s: Song) => Song) =>
      setData((d) => ({ ...d, songs: d.songs.map((s) => (s.id === songId ? fn(s) : s)) }))

    const mapPart = (songId: Id, partId: Id, fn: (p: Part) => Part) =>
      mapSong(songId, (s) => ({ ...s, parts: s.parts.map((p) => (p.id === partId ? fn(p) : p)) }))

    return {
      // Members ------------------------------------------------------------
      addMember(name: string) {
        setData((d) => ({ ...d, members: [...d.members, { id: newId(), name }] }))
      },
      renameMember(id: Id, name: string) {
        setData((d) => ({
          ...d,
          members: d.members.map((m) => (m.id === id ? { ...m, name } : m)),
        }))
      },
      removeMember(id: Id) {
        setData((d) => ({
          ...d,
          members: d.members.filter((m) => m.id !== id),
          songs: d.songs.map((s) => ({
            ...s,
            parts: s.parts.map((p) => ({ ...p, memberIds: p.memberIds.filter((m) => m !== id) })),
          })),
        }))
      },

      // Songs --------------------------------------------------------------
      addSong(song: NewSong) {
        setData((d) => ({ ...d, songs: [...d.songs, { ...song, id: newId(), parts: [] }] }))
      },
      updateSong(id: Id, patch: Partial<Omit<Song, 'id'>>) {
        mapSong(id, (s) => ({ ...s, ...patch }))
      },
      removeSong(id: Id) {
        setData((d) => ({
          ...d,
          songs: d.songs.filter((s) => s.id !== id),
          setlist: d.setlist.filter((x) => x !== id),
        }))
      },

      // Setlist ------------------------------------------------------------
      setSetlist(ids: Id[]) {
        setData((d) => ({ ...d, setlist: ids }))
      },
      toggleInSetlist(id: Id) {
        setData((d) => ({
          ...d,
          setlist: d.setlist.includes(id) ? d.setlist.filter((x) => x !== id) : [...d.setlist, id],
        }))
      },

      // Parts --------------------------------------------------------------
      addPart(songId: Id, name: string) {
        mapSong(songId, (s) => ({ ...s, parts: [...s.parts, { id: newId(), name, memberIds: [] }] }))
      },
      updatePart(songId: Id, partId: Id, patch: Partial<Omit<Part, 'id'>>) {
        mapPart(songId, partId, (p) => ({ ...p, ...patch }))
      },
      removePart(songId: Id, partId: Id) {
        mapSong(songId, (s) => ({ ...s, parts: s.parts.filter((p) => p.id !== partId) }))
      },
      copyParts(fromSongId: Id, toSongId: Id) {
        setData((d) => {
          const from = d.songs.find((s) => s.id === fromSongId)
          if (!from) return d
          return {
            ...d,
            songs: d.songs.map((s) =>
              s.id === toSongId
                ? { ...s, parts: from.parts.map((p) => ({ ...p, id: newId(), memberIds: [...p.memberIds] })) }
                : s,
            ),
          }
        })
      },

      // Import / export ----------------------------------------------------
      replaceAll(next: BandData) {
        setData(next)
      },
      reset() {
        setData(EMPTY)
      },
    }
  }, [setData])

  return [data, actions] as const
}

export type BandActions = ReturnType<typeof useBandData>[1]
