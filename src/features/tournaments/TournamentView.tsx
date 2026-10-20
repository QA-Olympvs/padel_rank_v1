import { useState } from 'react'
import { ArrowLeft, Download, GitBranch, ListOrdered, Monitor, Settings2, Swords, Trash2, Users } from 'lucide-react'
import { ConfirmDelete } from '@/components/ConfirmDelete'
import { StatusBadge } from '@/components/StatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { updateSettings, type ActionResult } from '@/domain/actions'
import { BracketPanel } from '@/features/bracket/BracketPanel'
import { MatchesPanel } from '@/features/matches/MatchesPanel'
import { PlayersPanel } from '@/features/players/PlayersPanel'
import { StandingsPanel } from '@/features/standings/StandingsPanel'
import { openPublicBoard } from '@/features/board/openBoard'
import { TournamentForm } from '@/features/tournaments/TournamentForm'
import type { Tournament, TournamentConfig } from '@/domain/types'

type Section = 'setup' | 'players' | 'matches' | 'standings' | 'bracket'

export function TournamentView({
  tournament,
  storageError,
  onSave,
  onDelete,
  onExport,
  onBack,
}: {
  tournament: Tournament
  storageError: string | null
  onSave: (result: ActionResult) => string | null
  onDelete: () => void
  onExport: () => void
  onBack: () => void
}) {
  const [section, setSection] = useState<Section>(tournament.status === 'draft' ? 'players' : 'matches')

  function saveSettings(config: TournamentConfig): string | null {
    return onSave(updateSettings(tournament, config))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Button variant="ghost" className="-ml-2 mb-1" onClick={onBack}>
            <ArrowLeft />
            Torneos
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{tournament.config.name}</h1>
            <StatusBadge tournament={tournament} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tournament.status !== 'draft' && (
            <Button variant="outline" onClick={() => openPublicBoard(tournament.id)}>
              <Monitor />
              Pantalla pública
            </Button>
          )}
          <Button variant="outline" onClick={onExport}>
            <Download />
            Exportar
          </Button>
          <ConfirmDelete
            title="Eliminar torneo"
            description={`Se borrará «${tournament.config.name}» y todos sus resultados de este navegador.`}
            trigger={<Button variant="destructive"><Trash2 />Eliminar</Button>}
            onConfirm={onDelete}
          />
        </div>
      </div>

      {storageError && (
        <Alert variant="destructive">
          <AlertDescription>{storageError}</AlertDescription>
        </Alert>
      )}

      <Tabs value={section} onValueChange={(value) => { if (isSection(value)) setSection(value) }}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="setup" className="h-8 flex-none px-3"><Settings2 />Configuración</TabsTrigger>
          <TabsTrigger value="players" className="h-8 flex-none px-3"><Users />Jugadores</TabsTrigger>
          <TabsTrigger value="matches" className="h-8 flex-none px-3"><Swords />Partidos</TabsTrigger>
          <TabsTrigger value="standings" className="h-8 flex-none px-3"><ListOrdered />Clasificación</TabsTrigger>
          <TabsTrigger value="bracket" className="h-8 flex-none px-3"><GitBranch />Cuadro</TabsTrigger>
        </TabsList>

        <TabsContent value="setup">
          <Card>
            <CardHeader>
              <CardTitle>Configuración</CardTitle>
              <CardDescription>
                {tournament.status === 'draft'
                  ? 'Puedes ajustar el formato hasta que inicies el torneo. Si cambias el formato o las parejas, se vacían las parejas ya formadas.'
                  : 'Con el torneo en curso puedes cambiar el nombre, las canchas y los puntos por victoria. El resto queda fijo.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TournamentForm
                key={`${tournament.id}:${tournament.status}:${tournament.config.pairCount}`}
                initial={tournament.config}
                locked={tournament.status !== 'draft'}
                submitLabel="Guardar configuración"
                onSubmit={saveSettings}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="players">
          <PlayersPanel tournament={tournament} onSave={onSave} />
        </TabsContent>
        <TabsContent value="matches">
          <MatchesPanel tournament={tournament} onSave={onSave} />
        </TabsContent>
        <TabsContent value="standings">
          <StandingsPanel tournament={tournament} />
        </TabsContent>
        <TabsContent value="bracket">
          <BracketPanel tournament={tournament} onSave={onSave} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function isSection(value: unknown): value is Section {
  return value === 'setup' || value === 'players' || value === 'matches' || value === 'standings' || value === 'bracket'
}
