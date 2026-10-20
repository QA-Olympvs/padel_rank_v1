import { useMemo } from 'react'
import type { MatchView } from '@/domain/present'
import type { Tournament } from '@/domain/types'
import { cn } from '@/lib/utils'
import { BracketConnector } from './BracketConnector'
import { BracketRound } from './BracketRound'
import { buildBracketLayout, connectorPaths, type BracketDensity } from './layout'

export function TournamentBracket({
  tournament,
  density = 'admin',
  onEdit,
  className,
}: {
  tournament: Tournament
  density?: BracketDensity
  onEdit?: (match: MatchView) => void
  className?: string
}) {
  const layout = useMemo(() => buildBracketLayout(tournament, density), [tournament, density])
  const paths = useMemo(() => connectorPaths(tournament, layout), [tournament, layout])

  if (layout.rounds.length === 0) return null

  return (
    <div className={cn('h-full min-h-0 w-full overflow-auto', className)}>
      <div className="mx-auto" style={{ width: layout.width, minHeight: '100%' }}>
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          <BracketConnector width={layout.width} height={layout.height} paths={paths} />
          {layout.rounds.map((round, roundIndex) => (
            <div
              key={round.round}
              className="absolute top-0"
              style={{ left: layout.metrics.pad + roundIndex * (layout.metrics.matchW + layout.metrics.gutter) }}
            >
              <BracketRound
                name={round.name}
                items={layout.placed.filter((item) => item.roundIndex === roundIndex)}
                matchH={layout.metrics.matchH}
                matchW={layout.metrics.matchW}
                headerH={layout.metrics.headerH}
                padTop={layout.metrics.pad}
                density={density}
                onEdit={onEdit}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
