import { presentBracket, type MatchView } from '@/domain/present'
import type { MatchSide, Tournament } from '@/domain/types'

export type BracketDensity = 'admin' | 'board'

export interface BracketMetrics {
  matchH: number
  matchW: number
  gap: number
  slot: number
  gutter: number
  headerH: number
  pad: number
}

export interface LaidMatch {
  match: MatchView
  x: number
  y: number
  cx: number
  cy: number
  roundIndex: number
  index: number
}

export interface BracketLayout {
  rounds: Array<{ round: number; name: string; matches: MatchView[] }>
  placed: LaidMatch[]
  byId: Map<string, LaidMatch>
  width: number
  height: number
  bodyTop: number
  metrics: BracketMetrics
}

export function metricsFor(density: BracketDensity): BracketMetrics {
  if (density === 'board') {
    return { matchH: 80, matchW: 288, gap: 16, slot: 96, gutter: 52, headerH: 36, pad: 16 }
  }
  return { matchH: 72, matchW: 256, gap: 16, slot: 88, gutter: 48, headerH: 32, pad: 12 }
}

export function buildBracketLayout(tournament: Tournament, density: BracketDensity): BracketLayout {
  const metrics = metricsFor(density)
  const order = new Map(tournament.matches.map((match, index) => [match.id, index]))
  const rounds = presentBracket(tournament).map((round) => ({
    ...round,
    matches: [...round.matches].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)),
  }))
  const firstCount = Math.max(rounds[0]?.matches.length ?? 1, 1)
  const bodyH = (firstCount - 1) * metrics.slot + metrics.matchH
  const width = metrics.pad * 2 + rounds.length * metrics.matchW + Math.max(0, rounds.length - 1) * metrics.gutter
  const height = metrics.pad * 2 + metrics.headerH + bodyH
  const placed: LaidMatch[] = []
  const byId = new Map<string, LaidMatch>()

  rounds.forEach((round, roundIndex) => {
    const span = firstCount / Math.max(round.matches.length, 1)
    round.matches.forEach((match, index) => {
      const cy = metrics.pad + metrics.headerH + (index * span + (span - 1) / 2) * metrics.slot + metrics.matchH / 2
      const y = cy - metrics.matchH / 2
      const x = metrics.pad + roundIndex * (metrics.matchW + metrics.gutter)
      const item: LaidMatch = {
        match,
        x,
        y,
        cx: x + metrics.matchW / 2,
        cy,
        roundIndex,
        index,
      }
      placed.push(item)
      byId.set(match.id, item)
    })
  })

  return { rounds, placed, byId, width, height, bodyTop: metrics.pad + metrics.headerH, metrics }
}

export function winnerSourceId(side: MatchSide): string | null {
  return side.kind === 'winner' ? side.matchId : null
}

export function connectorPaths(tournament: Tournament, layout: BracketLayout): Array<{ d: string; lit: boolean }> {
  const { byId, metrics } = layout
  const paths: Array<{ d: string; lit: boolean }> = []

  for (const next of layout.placed) {
    const source = tournament.matches.find((item) => item.id === next.match.id)
    if (!source) continue
    const leftId = winnerSourceId(source.sideA)
    const rightId = winnerSourceId(source.sideB)
    const feeders = [leftId, rightId].map((id) => (id ? byId.get(id) : undefined)).filter((item): item is LaidMatch => Boolean(item))
    if (feeders.length === 0) continue

    const x1 = feeders[0].x + metrics.matchW
    const x2 = next.x
    const mid = x1 + (x2 - x1) / 2
    const yNext = next.cy
    const ys = feeders.map((item) => item.cy).sort((a, b) => a - b)
    const yTop = ys[0]
    const yBottom = ys[ys.length - 1]
    const lit = next.match.status === 'finished'
    const stems = feeders.map((item) => `M ${x1} ${item.cy} H ${mid}`).join(' ')
    const d = `${stems} M ${mid} ${yTop} V ${yBottom} M ${mid} ${yNext} H ${x2}`
    paths.push({ d, lit })
  }

  return paths
}
