import { orderQualifiersForKnockout, randomFrom } from './bracket.ts'
import { applyFinishedPlayoff, groupLeagueMatches } from './playoff.ts'
import { tallyMatch } from './scores.ts'
import { standingsFor, type CountedMatch, type StandingRow } from './standings.ts'
import type { Group, Match, MatchSide, Tournament } from './types.ts'

export type ResolvedSide =
  | { state: 'pair'; pairId: string }
  | { state: 'bye' }
  | { state: 'waiting'; label: string }

export function resolveSide(tournament: Tournament, side: MatchSide, stack: Set<string> = new Set()): ResolvedSide {
  if (side.kind === 'pair') return { state: 'pair', pairId: side.pairId }
  if (side.kind === 'bye') return { state: 'bye' }
  if (side.kind === 'winner') {
    if (stack.has(side.matchId)) return { state: 'waiting', label: 'Por definir' }
    const match = tournament.matches.find((item) => item.id === side.matchId)
    if (!match) return { state: 'waiting', label: 'Por definir' }
    const winnerId = winnerOf(tournament, match, stack)
    if (!winnerId) return { state: 'waiting', label: `Ganador de ${match.roundName}` }
    return { state: 'pair', pairId: winnerId }
  }

  if (side.kind === 'overall') {
    const label = `Mejor ${side.rank}`
    const seeds = knockoutSeedPairIds(tournament)
    const pairId = seeds?.[side.rank - 1]
    if (!pairId) return { state: 'waiting', label }
    return { state: 'pair', pairId }
  }

  const group = tournament.groups.find((item) => item.id === side.groupId)
  if (!group) return { state: 'waiting', label: 'Por definir' }
  const label = `${side.rank}º ${group.name}`
  if (!isGroupComplete(tournament, group.id)) return { state: 'waiting', label }
  const row = tableForGroup(tournament, group)[side.rank - 1]
  if (!row) return { state: 'waiting', label }
  return { state: 'pair', pairId: row.pairId }
}

export function knockoutSeedPairIds(tournament: Tournament): string[] | null {
  if (tournament.config.format !== 'groups_knockout') return null
  if (tournament.groups.some((group) => !isGroupComplete(tournament, group.id))) return null
  const qualifiers = tournament.groups.flatMap((group) => {
    const rows = tableForGroup(tournament, group)
    return rows.slice(0, tournament.config.qualifiersPerGroup).map((row) => ({
      pairId: row.pairId,
      points: row.points,
      groupId: group.id,
    }))
  })
  const expected = tournament.groups.length * tournament.config.qualifiersPerGroup
  if (qualifiers.length !== expected) return null
  const seed = `${tournament.id}:${qualifiers.map((row) => `${row.pairId}:${row.points}`).sort().join('|')}`
  return orderQualifiersForKnockout(qualifiers, randomFrom(seed))
}

export function winnerOf(tournament: Tournament, match: Match, stack: Set<string> = new Set()): string | null {
  const path = new Set(stack)
  path.add(match.id)
  const sideA = resolveSide(tournament, match.sideA, path)
  const sideB = resolveSide(tournament, match.sideB, path)
  if (sideA.state === 'bye' && sideB.state === 'pair') return sideB.pairId
  if (sideB.state === 'bye' && sideA.state === 'pair') return sideA.pairId
  if (sideA.state !== 'pair' || sideB.state !== 'pair') return null
  const tally = tallyMatch(match.sets, tournament.config, match.phase)
  if (!tally.valid || tally.drawn) return null
  return tally.setsA > tally.setsB ? sideA.pairId : sideB.pairId
}

export function isMatchFinished(tournament: Tournament, match: Match): boolean {
  const sideA = resolveSide(tournament, match.sideA)
  const sideB = resolveSide(tournament, match.sideB)
  if (sideA.state === 'bye' && sideB.state === 'pair') return true
  if (sideB.state === 'bye' && sideA.state === 'pair') return true
  if (sideA.state === 'bye' && sideB.state === 'bye') return true
  if (sideA.state === 'bye' || sideB.state === 'bye') return false
  const tally = tallyMatch(match.sets, tournament.config, match.phase)
  if (!tally.valid) return false
  return match.phase === 'group' || match.phase === 'round_robin' || !tally.drawn
}

export function isGroupComplete(tournament: Tournament, groupId: string): boolean {
  const league = groupLeagueMatches(tournament, groupId)
  const extras = tournament.matches.filter((match) => match.groupId === groupId && match.phase !== 'group')
  return league.length > 0
    && league.every((match) => isMatchFinished(tournament, match))
    && extras.every((match) => isMatchFinished(tournament, match))
}

export function tableForGroup(tournament: Tournament, group: Group): StandingRow[] {
  const rows = standingsFor(
    group.pairIds,
    countedMatches(tournament, (match) => match.phase === 'group' && match.groupId === group.id),
    tournament.config,
  )
  return applyFinishedPlayoff(rows, tournament, group.id)
}

export function roundRobinTable(tournament: Tournament): StandingRow[] {
  return standingsFor(
    tournament.pairs.map((pair) => pair.id),
    countedMatches(tournament, (match) => match.phase === 'round_robin'),
    tournament.config,
  )
}

export function knockoutWouldChange(before: Tournament, after: Tournament): boolean {
  return before.matches.some((match) => {
    if (match.phase !== 'knockout' || match.sets.length === 0) return false
    const next = after.matches.find((item) => item.id === match.id)
    return !next || next.sets.length === 0
  })
}

/**
 * Si un resultado cambia quién llega a un cruce ya jugado, se borra ese resultado
 * y los que dependían de él.
 */
export function sanitizeResults(tournament: Tournament): Tournament {
  const matches = tournament.matches.map((match) => ({ ...match, sets: [...match.sets] }))
  const pending = { ...tournament, matches }
  let guard = 0

  while (guard < matches.length + 1) {
    guard += 1
    let changed = false
    for (const match of pending.matches) {
      if (match.sets.length === 0 && !match.playedBy) continue
      const sideA = resolveSide(pending, match.sideA)
      const sideB = resolveSide(pending, match.sideB)
      const aligned = sideA.state === 'pair'
        && sideB.state === 'pair'
        && match.playedBy?.pairAId === sideA.pairId
        && match.playedBy?.pairBId === sideB.pairId
      if (!aligned) {
        match.sets = []
        match.playedBy = null
        changed = true
      }
    }
    if (!changed) break
  }

  return pending
}

function countedMatches(tournament: Tournament, include: (match: Match) => boolean): CountedMatch[] {
  const counted: CountedMatch[] = []
  for (const match of tournament.matches) {
    if (!include(match) || match.sideA.kind !== 'pair' || match.sideB.kind !== 'pair') continue
    const tally = tallyMatch(match.sets, tournament.config, match.phase)
    if (!tally.valid) continue
    counted.push({ pairAId: match.sideA.pairId, pairBId: match.sideB.pairId, sets: match.sets })
  }
  return counted
}
