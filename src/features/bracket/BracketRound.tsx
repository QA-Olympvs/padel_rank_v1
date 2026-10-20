import type { MatchView } from '@/domain/present'
import type { BracketDensity, LaidMatch } from './layout'
import { BracketMatch } from './BracketMatch'

export function BracketRound({
  name,
  items,
  matchH,
  matchW,
  headerH,
  padTop,
  density,
  onEdit,
}: {
  name: string
  items: LaidMatch[]
  matchH: number
  matchW: number
  headerH: number
  padTop: number
  density: BracketDensity
  onEdit?: (match: MatchView) => void
}) {
  return (
    <section className="relative shrink-0" style={{ width: matchW }}>
      <h3
        className="absolute left-0 right-0 truncate text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase"
        style={{ top: padTop, height: headerH, lineHeight: `${headerH}px` }}
      >
        {name}
      </h3>
      {items.map((item) => (
        <div
          key={item.match.id}
          className="absolute"
          style={{ top: item.y, left: 0, width: matchW, height: matchH }}
        >
          <BracketMatch match={item.match} density={density} onEdit={onEdit} />
        </div>
      ))}
    </section>
  )
}
