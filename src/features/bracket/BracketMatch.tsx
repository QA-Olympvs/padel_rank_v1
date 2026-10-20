import { CircleCheck, Clock, MapPin, Pencil, Play, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MatchView } from '@/domain/present'
import { cn } from '@/lib/utils'
import type { BracketDensity } from './layout'

export function BracketMatch({
  match,
  density,
  onEdit,
}: {
  match: MatchView
  density: BracketDensity
  onEdit?: (match: MatchView) => void
}) {
  const canScore = Boolean(onEdit) && (match.status === 'ready' || match.status === 'finished')
  return (
    <article className={cn(
      'flex h-full w-full min-w-0 flex-col overflow-hidden rounded-[10px] border bg-card shadow-[0_1px_2px_oklch(0.25_0.02_160/0.06)]',
      match.status === 'ready' ? 'border-primary/40' : 'border-border',
    )}>
      <div className="flex h-6 shrink-0 items-center justify-between gap-2 border-b border-border/80 px-2">
        <MatchStatus status={match.status} />
        <div className="flex items-center gap-1">
          {match.court ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
              <MapPin className="size-3" />
              {match.court}
            </span>
          ) : null}
          {canScore && (
            <Button
              size="icon-xs"
              variant="ghost"
              className="text-muted-foreground"
              aria-label={match.status === 'finished' ? 'Editar resultado' : 'Cargar resultado'}
              onClick={() => onEdit?.(match)}
            >
              <Pencil />
            </Button>
          )}
        </div>
      </div>
      <SideRow side={match.sideA} score={match.scoreA} bye={match.status === 'bye'} density={density} />
      <div className="h-px bg-border" />
      <SideRow side={match.sideB} score={match.scoreB} bye={match.status === 'bye'} density={density} />
    </article>
  )
}

function SideRow({
  side,
  score,
  bye,
  density,
}: {
  side: MatchView['sideA']
  score: number | null
  bye: boolean
  density: BracketDensity
}) {
  const waiting = !side.pairId && side.label !== 'BYE'
  const value = bye && side.pairId ? '—' : score
  return (
    <div className={cn(
      'flex min-h-0 flex-1 items-center gap-2 border-l-2 px-2',
      side.winner ? 'border-l-primary bg-primary/8' : 'border-l-transparent',
    )}>
      {side.winner && <CircleCheck className="size-3.5 shrink-0 text-primary" />}
      <span className={cn(
        'min-w-0 flex-1 truncate',
        density === 'board' ? 'text-[15px]' : 'text-[13px]',
        side.winner && 'font-medium text-foreground',
        !side.winner && !waiting && 'text-foreground/70',
        waiting && 'italic text-muted-foreground',
        side.label === 'BYE' && 'text-muted-foreground',
      )}>
        {side.label}
      </span>
      <span className={cn(
        'w-6 shrink-0 text-right text-[13px] tabular-nums',
        side.winner ? 'font-semibold text-primary' : 'text-foreground/55',
        value == null && 'opacity-0',
      )}>
        {value ?? '–'}
      </span>
    </div>
  )
}

function MatchStatus({ status }: { status: MatchView['status'] }) {
  const map = {
    finished: { icon: <CircleCheck className="size-3" />, label: 'Finalizado' },
    waiting: { icon: <Clock className="size-3" />, label: 'Por definir' },
    bye: { icon: <SkipForward className="size-3" />, label: 'Pase' },
    ready: { icon: <Play className="size-3" />, label: 'Pendiente' },
  } as const
  const item = map[status]
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-medium',
      status === 'ready' ? 'text-primary' : 'text-muted-foreground',
    )}>
      {item.icon}
      {item.label}
    </span>
  )
}
