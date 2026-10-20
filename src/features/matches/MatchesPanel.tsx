import { useState } from 'react'
import { CircleCheck, Clock, MapPin, Pencil, Play, SkipForward } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ActionResult } from '@/domain/actions'
import { presentMatches, type MatchView } from '@/domain/present'
import type { Tournament } from '@/domain/types'
import { ScoreDialog } from '@/features/matches/ScoreDialog'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'pending' | 'done'

export function MatchesPanel({
  tournament,
  onSave,
}: {
  tournament: Tournament
  onSave: (result: ActionResult) => string | null
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [groupId, setGroupId] = useState('all')
  const [editing, setEditing] = useState<MatchView | null>(null)
  const matches = presentMatches(tournament)
  const visible = matches.filter((match) => matchesFilter(match, filter) && (groupId === 'all' || match.groupId === groupId))
  const pending = matches.filter((match) => match.status === 'ready' || match.status === 'waiting').length
  const finished = matches.filter((match) => match.status === 'finished' || match.status === 'bye').length
  const waves = groupByWave(visible)

  if (tournament.status === 'draft') {
    return <Waiting message="Cuando inicies el torneo se generarán los partidos, las canchas y los turnos." />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CircleCheck className="size-3.5" />{finished} cerrados</span>
          <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{pending} pendientes</span>
          <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{tournament.config.courtCount} {tournament.config.courtCount === 1 ? 'cancha' : 'canchas'}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Todos</FilterButton>
          <FilterButton active={filter === 'pending'} onClick={() => setFilter('pending')}>Pendientes</FilterButton>
          <FilterButton active={filter === 'done'} onClick={() => setFilter('done')}>Finalizados</FilterButton>
        </div>
      </div>

      {tournament.groups.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <FilterButton active={groupId === 'all'} onClick={() => setGroupId('all')}>Todos los grupos</FilterButton>
          {tournament.groups.map((group) => (
            <FilterButton key={group.id} active={groupId === group.id} onClick={() => setGroupId(group.id)}>
              {group.name}
            </FilterButton>
          ))}
        </div>
      )}

      {tournament.groupBalanceNote && <Alert><AlertDescription>{tournament.groupBalanceNote}</AlertDescription></Alert>}

      {visible.length === 0 && <Waiting message="No hay partidos con este filtro." />}

      {waves.map(([wave, waveMatches]) => (
        <section key={wave} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">
            {wave < 1 ? 'Pases automáticos' : `Turno ${wave}`}
          </h2>
          <div className="flex flex-col gap-2">
            {waveMatches.map((match) => (
              <MatchCard key={match.id} match={match} onEdit={() => setEditing(match)} />
            ))}
          </div>
        </section>
      ))}

      <ScoreDialog
        tournament={tournament}
        match={editing}
        open={editing !== null}
        onOpenChange={(open) => { if (!open) setEditing(null) }}
        onSave={onSave}
      />
    </div>
  )
}

function MatchCard({ match, onEdit }: { match: MatchView; onEdit: () => void }) {
  const canScore = match.status === 'ready' || match.status === 'finished'
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{match.groupName ? `${match.groupName} · ` : ''}{match.roundName}</span>
            {match.court ? (
              <Badge variant="outline" className="gap-1">
                <MapPin className="size-3" />
                Cancha {match.court}
              </Badge>
            ) : null}
            <Badge variant={match.status === 'finished' ? 'secondary' : 'outline'} className="gap-1">
              {statusIcon(match.status)}
              {statusLabel(match.status)}
            </Badge>
          </div>
          <SideLine side={match.sideA} />
          <SideLine side={match.sideB} />
          <p className="mt-2 text-sm text-muted-foreground">{match.scoreLabel}</p>
        </div>
        {canScore && (
          <Button variant={match.status === 'finished' ? 'outline' : 'default'} onClick={onEdit}>
            {match.status === 'finished' ? <Pencil /> : <Play />}
            {match.status === 'finished' ? 'Editar' : 'Cargar resultado'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function SideLine({ side }: { side: MatchView['sideA'] }) {
  return (
    <p className={cn('truncate text-sm', side.winner && 'font-semibold text-primary', side.label === 'BYE' && 'text-muted-foreground')}>
      {side.label}
    </p>
  )
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <Button type="button" size="sm" variant={active ? 'default' : 'outline'} aria-pressed={active} onClick={onClick}>
      {children}
    </Button>
  )
}

function Waiting({ message }: { message: string }) {
  return <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{message}</p>
}

function groupByWave(matches: MatchView[]): Array<[number, MatchView[]]> {
  const groups = new Map<number, MatchView[]>()
  for (const match of matches) {
    const list = groups.get(match.wave) ?? []
    list.push(match)
    groups.set(match.wave, list)
  }
  return [...groups.entries()].sort(([a], [b]) => a - b)
}

function matchesFilter(match: MatchView, filter: Filter): boolean {
  if (filter === 'pending') return match.status === 'ready' || match.status === 'waiting'
  if (filter === 'done') return match.status === 'finished' || match.status === 'bye'
  return true
}

function statusIcon(status: MatchView['status']) {
  if (status === 'finished') return <CircleCheck className="size-3" />
  if (status === 'ready') return <Play className="size-3" />
  if (status === 'bye') return <SkipForward className="size-3" />
  return <Clock className="size-3" />
}

function statusLabel(status: MatchView['status']): string {
  if (status === 'finished') return 'Finalizado'
  if (status === 'ready') return 'Pendiente'
  if (status === 'bye') return 'Pase'
  return 'Por definir'
}
