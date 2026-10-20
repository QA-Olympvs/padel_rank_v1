import { useState } from 'react'
import { Swords } from 'lucide-react'
import type { ActionResult } from '@/domain/actions'
import { presentBracket, type MatchView } from '@/domain/present'
import { setCountMode } from '@/domain/scores'
import type { Tournament } from '@/domain/types'
import { ScoreDialog } from '@/features/matches/ScoreDialog'
import { TournamentBracket } from './TournamentBracket'

export function BracketPanel({
  tournament,
  onSave,
}: {
  tournament: Tournament
  onSave: (result: ActionResult) => string | null
}) {
  const rounds = presentBracket(tournament)
  const [editing, setEditing] = useState<MatchView | null>(null)
  const firstTo = setCountMode(tournament.config, 'knockout') === 'first_to'
    ? tournament.config.setsToPlay
    : null

  if (tournament.status === 'draft') {
    return <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">El cuadro se arma al iniciar el torneo.</p>
  }
  if (rounds.length === 0) {
    return <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Este formato no tiene eliminatoria.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {firstTo !== null && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Swords className="size-4 shrink-0 text-primary" />
          A partir de aquí gana quien llega primero a {firstTo} sets. Pulsa el lápiz para cargar el resultado.
        </p>
      )}
      <div className="h-[min(72svh,calc(100svh-14rem))] min-h-80 overflow-hidden rounded-xl border border-border bg-muted/40">
        <TournamentBracket tournament={tournament} density="admin" onEdit={setEditing} />
      </div>
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
