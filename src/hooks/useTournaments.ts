import { useEffect, useState } from 'react'
import { createTournament, type ActionResult } from '@/domain/actions'
import {
  STORAGE_KEY,
  deserializeStore,
  loadTournaments,
  saveTournaments,
  serializeStore,
} from '@/domain/storage'
import type { Tournament, TournamentConfig } from '@/domain/types'

export function useTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>(() => loadTournaments())
  const [storageError, setStorageError] = useState<string | null>(null)

  function persist(next: Tournament[]) {
    setTournaments(next)
    setStorageError(saveTournaments(next))
  }

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      const next = deserializeStore(event.newValue)
      if (next) setTournaments(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const ordered = [...tournaments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  function save(result: ActionResult): string | null {
    if (!result.ok) return result.error
    const next = result.tournament
    persist(tournaments.map((item) => (item.id === next.id ? next : item)))
    return null
  }

  function create(config: TournamentConfig): { id: string } | { error: string } {
    const result = createTournament(config)
    if (!result.ok) return { error: result.error }
    persist([result.tournament, ...tournaments])
    return { id: result.tournament.id }
  }

  function remove(id: string) {
    persist(tournaments.filter((item) => item.id !== id))
  }

  function importJson(raw: string, mode: 'merge' | 'replace'): string | null {
    const parsed = deserializeStore(raw)
    if (!parsed) return 'El archivo no contiene torneos válidos.'
    if (mode === 'replace') {
      persist(parsed)
      return null
    }
    const merged = new Map(tournaments.map((tournament) => [tournament.id, tournament]))
    for (const tournament of parsed) merged.set(tournament.id, tournament)
    persist([...merged.values()])
    return null
  }

  function exportAll() {
    downloadJson('torneos-padel.json', serializeStore(ordered))
  }

  function exportOne(tournament: Tournament) {
    const slug = tournament.config.name.toLocaleLowerCase('es').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
    downloadJson(`${slug || 'torneo'}.json`, serializeStore([tournament]))
  }

  return { tournaments: ordered, storageError, save, create, remove, importJson, exportAll, exportOne }
}

function downloadJson(filename: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
