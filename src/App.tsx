import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { BoardScreen } from '@/features/board/BoardScreen'
import { TournamentForm } from '@/features/tournaments/TournamentForm'
import { TournamentList } from '@/features/tournaments/TournamentList'
import { TournamentView } from '@/features/tournaments/TournamentView'
import { useTournaments } from '@/hooks/useTournaments'
import { DEFAULT_SCORING, type TournamentConfig } from '@/domain/types'

const OPEN_KEY = 'padel-tournament-open'

const emptyConfig: TournamentConfig = {
  name: '',
  format: 'round_robin',
  pairCount: 8,
  courtCount: 2,
  pairingMode: 'manual',
  groupSize: 4,
  qualifiersPerGroup: 2,
  ...DEFAULT_SCORING,
}

type Screen = { type: 'list' } | { type: 'create' } | { type: 'tournament'; id: string }

function boardIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('pantalla')
}

export default function App() {
  const store = useTournaments()
  const [boardId, setBoardId] = useState<string | null>(() => boardIdFromUrl())
  const [screen, setScreen] = useState<Screen>(() => {
    const id = sessionStorage.getItem(OPEN_KEY)
    return id ? { type: 'tournament', id } : { type: 'list' }
  })
  useEffect(() => {
    const onPop = () => setBoardId(boardIdFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    if (screen.type === 'tournament') sessionStorage.setItem(OPEN_KEY, screen.id)
    else sessionStorage.removeItem(OPEN_KEY)
  }, [screen])

  const openTournament = screen.type === 'tournament'
    ? store.tournaments.find((tournament) => tournament.id === screen.id)
    : undefined

  function openList() {
    setScreen({ type: 'list' })
  }

  function createTournament(config: TournamentConfig): string | null {
    const result = store.create(config)
    if ('error' in result) return result.error
    setScreen({ type: 'tournament', id: result.id })
    return null
  }

  if (boardId) {
    return <BoardScreen tournamentId={boardId} />
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <button type="button" className="flex items-center gap-3 text-left" onClick={openList}>
            <span>
              <span className="block text-lg font-semibold tracking-tight">PAXDEL - Tournaments Manager</span>
              <span className="block text-xs text-muted-foreground">Gestión local, sin cuenta</span>
            </span>
          </button>
          <p className="hidden text-xs text-muted-foreground sm:block">Guardado en este navegador</p>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6">
        {screen.type === 'list' && (
          <TournamentList
            tournaments={store.tournaments}
            onCreate={() => setScreen({ type: 'create' })}
            onOpen={(id) => setScreen({ type: 'tournament', id })}
            onDelete={store.remove}
            onExportAll={store.exportAll}
            onExportOne={store.exportOne}
            onImport={store.importJson}
          />
        )}
        {screen.type === 'create' && (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Nuevo torneo</h1>
              <p className="mt-1 text-sm text-muted-foreground">Después podrás registrar jugadores y revisar las parejas antes de generar los partidos.</p>
            </div>
            <TournamentForm
              initial={emptyConfig}
              locked={false}
              submitLabel="Crear torneo"
              onSubmit={createTournament}
            />
          </div>
        )}
        {screen.type === 'tournament' && openTournament && (
          <TournamentView
            key={openTournament.id}
            tournament={openTournament}
            storageError={store.storageError}
            onSave={store.save}
            onDelete={() => { store.remove(openTournament.id); openList() }}
            onExport={() => store.exportOne(openTournament)}
            onBack={openList}
          />
        )}
        {screen.type === 'tournament' && !openTournament && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">Ese torneo ya no está en este navegador.</p>
            <button type="button" className="text-sm font-medium text-primary" onClick={openList}>Volver a la lista</button>
          </div>
        )}
      </main>
    </div>
  )
}
