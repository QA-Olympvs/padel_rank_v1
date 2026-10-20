import { tallyMatch } from './scores.ts'
import { scoringOf, type SetScore, type TournamentConfig } from './types.ts'

export interface CountedMatch {
  pairAId: string
  pairBId: string
  sets: SetScore[]
}

export interface StandingRow {
  pairId: string
  played: number
  won: number
  lost: number
  points: number
  setsFor: number
  setsAgainst: number
  gamesFor: number
  gamesAgainst: number
  rank: number
  /** Mismo número = empate que los criterios no pudieron separar. */
  tieGroup: number | null
}

interface Stats {
  pairId: string
  order: number
  played: number
  won: number
  lost: number
  points: number
  setsFor: number
  setsAgainst: number
  gamesFor: number
  gamesAgainst: number
}

export type SpotStatus = 'in' | 'out' | 'fight'

/**
 * Cupos según los puntos (sets ganados). Una pareja Clasifica si, con su puntuación,
 * caben todas las que tienen esos puntos o más. Pelean el cupo si su puntuación
 * deja a algunas dentro y a otras fuera.
 */
export function spotStatusFor(
  rows: Array<{ pairId: string; points: number }>,
  qualifiers: number | null,
): Map<string, SpotStatus> {
  const status = new Map<string, SpotStatus>()
  const cupos = qualifiers ?? 0
  for (const row of rows) {
    if (cupos <= 0) {
      status.set(row.pairId, 'out')
      continue
    }
    const better = rows.filter((other) => other.points > row.points).length
    const equalOrBetter = rows.filter((other) => other.points >= row.points).length
    if (equalOrBetter <= cupos) status.set(row.pairId, 'in')
    else if (better >= cupos) status.set(row.pairId, 'out')
    else status.set(row.pairId, 'fight')
  }
  return status
}

export function fightingPairIds(
  rows: Array<{ pairId: string; points: number }>,
  qualifiers: number | null,
): string[] {
  const status = spotStatusFor(rows, qualifiers)
  return rows.filter((row) => status.get(row.pairId) === 'fight').map((row) => row.pairId)
}

export function standingsFor(pairIds: string[], matches: CountedMatch[], config: TournamentConfig): StandingRow[] {
  const collected = collectStats(pairIds, matches, config)
  const ranked = breakTies(collected, matches, config)
  return ranked.rows.map((row, index) => ({
    pairId: row.pairId,
    played: row.played,
    won: row.won,
    lost: row.lost,
    points: row.points,
    setsFor: row.setsFor,
    setsAgainst: row.setsAgainst,
    gamesFor: row.gamesFor,
    gamesAgainst: row.gamesAgainst,
    rank: index + 1,
    tieGroup: ranked.tieGroups.get(row.pairId) ?? null,
  }))
}

function collectStats(pairIds: string[], matches: CountedMatch[], config: TournamentConfig): Stats[] {
  const stats = new Map<string, Stats>(
    pairIds.map((pairId, order) => [
      pairId,
      {
        pairId,
        order,
        played: 0,
        won: 0,
        lost: 0,
        points: 0,
        setsFor: 0,
        setsAgainst: 0,
        gamesFor: 0,
        gamesAgainst: 0,
      },
    ]),
  )

  for (const match of matches) {
    const tally = tallyMatch(match.sets, config)
    if (!tally.valid) continue
    const home = stats.get(match.pairAId)
    const away = stats.get(match.pairBId)
    if (!home || !away) continue
    addMatch(home, tally.setsA, tally.setsB, tally.gamesA, tally.gamesB, config)
    addMatch(away, tally.setsB, tally.setsA, tally.gamesB, tally.gamesA, config)
  }

  return [...stats.values()]
}

function breakTies(rows: Stats[], matches: CountedMatch[], config: TournamentConfig): { rows: Stats[]; tieGroups: Map<string, number> } {
  const sorted = [...rows].sort((a, b) => compareBase(a, b) || a.order - b.order)
  const result: Stats[] = []
  const tieGroups = new Map<string, number>()
  let nextTieGroup = 0

  let index = 0
  while (index < sorted.length) {
    let end = index + 1
    while (end < sorted.length && compareBase(sorted[index], sorted[end]) === 0) end += 1
    const cluster = sorted.slice(index, end)
    if (cluster.length > 1) {
      const mini = miniStats(cluster, matches, config)
      cluster.sort((a, b) => compareMini(mini, a.pairId, b.pairId) || a.order - b.order)
      let cursor = 0
      while (cursor < cluster.length) {
        let tiedUntil = cursor + 1
        while (
          tiedUntil < cluster.length
          && compareMini(mini, cluster[cursor].pairId, cluster[tiedUntil].pairId) === 0
        ) {
          tiedUntil += 1
        }
        if (tiedUntil - cursor > 1) {
          for (let tiedIndex = cursor; tiedIndex < tiedUntil; tiedIndex += 1) {
            tieGroups.set(cluster[tiedIndex].pairId, nextTieGroup)
          }
          nextTieGroup += 1
        }
        cursor = tiedUntil
      }
    }
    result.push(...cluster)
    index = end
  }

  return { rows: result, tieGroups }
}

/** Partidos jugados solo entre las parejas que siguen empatadas. */
function miniStats(cluster: Stats[], matches: CountedMatch[], config: TournamentConfig): Map<string, Stats> {
  const ids = new Set(cluster.map((row) => row.pairId))
  const internal = matches.filter((match) => ids.has(match.pairAId) && ids.has(match.pairBId))
  return new Map(collectStats([...ids], internal, config).map((row) => [row.pairId, row]))
}

function compareMini(mini: Map<string, Stats>, pairAId: string, pairBId: string): number {
  const a = mini.get(pairAId)
  const b = mini.get(pairBId)
  if (!a || !b) return 0
  return compareBase(a, b)
}

function compareBase(a: Stats, b: Stats): number {
  return (
    b.points - a.points ||
    setDiff(b) - setDiff(a) ||
    gameDiff(b) - gameDiff(a) ||
    b.setsFor - a.setsFor ||
    b.gamesFor - a.gamesFor
  )
}

function addMatch(
  stats: Stats,
  setsFor: number,
  setsAgainst: number,
  gamesFor: number,
  gamesAgainst: number,
  config: TournamentConfig,
) {
  stats.played += 1
  stats.setsFor += setsFor
  stats.setsAgainst += setsAgainst
  stats.gamesFor += gamesFor
  stats.gamesAgainst += gamesAgainst
  const scoring = scoringOf(config)
  if (scoring.scoringMode === 'sets_won') {
    stats.points += setsFor
  }
  if (setsFor > setsAgainst) {
    stats.won += 1
    if (scoring.scoringMode !== 'sets_won') stats.points += scoring.pointsPerWin
  } else if (setsFor < setsAgainst) {
    stats.lost += 1
  }
}

function setDiff(stats: Stats): number {
  return stats.setsFor - stats.setsAgainst
}

function gameDiff(stats: Stats): number {
  return stats.gamesFor - stats.gamesAgainst
}
