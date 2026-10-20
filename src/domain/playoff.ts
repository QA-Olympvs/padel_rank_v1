import { createId } from './ids.ts'
import { scheduleMatches } from './schedule.ts'
import { tallyMatch } from './scores.ts'
import { fightingPairIds, spotStatusFor, standingsFor, type CountedMatch, type StandingRow } from './standings.ts'
import type { Group, Match, Tournament } from './types.ts'

export function syncPlayoffs(tournament: Tournament): Tournament {
  if (tournament.status !== 'active' || tournament.config.format !== 'groups_knockout') {
    return stripPlayoffs(tournament)
  }
  if (tournament.config.scoringMode !== 'sets_won') {
    return stripPlayoffs(tournament)
  }

  let matches = [...tournament.matches]
  let changed = false

  for (const group of tournament.groups) {
    const needed = neededPlayoffEdges(tournament, group)
    const existing = matches.filter((match) => match.phase === 'playoff' && match.groupId === group.id)
    const keep: Match[] = []
    const unused = [...existing]

    for (const edge of needed) {
      const index = unused.findIndex((match) => samePairings(match, edge))
      if (index >= 0) {
        keep.push(unused.splice(index, 1)[0])
        continue
      }
      keep.push(makePlayoff(group, edge))
      changed = true
    }

    if (unused.length > 0) changed = true
    if (keep.length !== existing.length || unused.length > 0) {
      matches = matches.filter((match) => !(match.phase === 'playoff' && match.groupId === group.id))
      matches.push(...keep)
    }
  }

  if (!changed) return tournament
  return {
    ...tournament,
    matches: scheduleMatches(matches, tournament.config.courtCount),
  }
}

export function applyFinishedPlayoff(rows: StandingRow[], tournament: Tournament, groupId: string): StandingRow[] {
  const playoffs = tournament.matches.filter((item) => item.phase === 'playoff' && item.groupId === groupId)
  if (playoffs.length === 0 || playoffs.some((match) => !tallyMatch(match.sets, tournament.config, match.phase).valid)) {
    return rows
  }

  const fighting = fightingPairIds(rows, tournament.config.qualifiersPerGroup)
  if (fighting.length === 0) return rows

  const order = rankByPlayoffs(fighting, playoffs, tournament)
  const spots = spotStatusFor(rows, tournament.config.qualifiersPerGroup)
  const ins = rows.filter((row) => spots.get(row.pairId) === 'in')
  const outs = rows.filter((row) => spots.get(row.pairId) === 'out')
  const fights = order.map((pairId) => rows.find((row) => row.pairId === pairId)).filter((row): row is StandingRow => Boolean(row))

  return [...ins, ...fights, ...outs].map((row, index) => ({
    ...row,
    rank: index + 1,
    tieGroup: fighting.includes(row.pairId) ? null : row.tieGroup,
  }))
}

export function playoffsOfGroup(tournament: Tournament, groupId: string): Match[] {
  return tournament.matches.filter((match) => match.phase === 'playoff' && match.groupId === groupId)
}

export function groupLeagueMatches(tournament: Tournament, groupId: string): Match[] {
  return tournament.matches.filter((match) => match.phase === 'group' && match.groupId === groupId)
}

function neededPlayoffEdges(tournament: Tournament, group: Group): Array<[string, string]> {
  const league = groupLeagueMatches(tournament, group.id)
  if (league.length === 0 || !league.every((match) => tallyMatch(match.sets, tournament.config, match.phase).valid)) {
    return []
  }
  const rows = standingsFor(group.pairIds, countedGroupMatches(tournament, group.id), tournament.config)
  const fighting = fightingPairIds(rows, tournament.config.qualifiersPerGroup)
  if (fighting.length < 2) return []
  const edges: Array<[string, string]> = []
  for (let i = 0; i < fighting.length; i += 1) {
    for (let j = i + 1; j < fighting.length; j += 1) {
      edges.push([fighting[i], fighting[j]])
    }
  }
  return edges
}

function countedGroupMatches(tournament: Tournament, groupId: string): CountedMatch[] {
  const counted: CountedMatch[] = []
  for (const match of groupLeagueMatches(tournament, groupId)) {
    if (match.sideA.kind !== 'pair' || match.sideB.kind !== 'pair') continue
    if (!tallyMatch(match.sets, tournament.config, match.phase).valid) continue
    counted.push({ pairAId: match.sideA.pairId, pairBId: match.sideB.pairId, sets: match.sets })
  }
  return counted
}

function rankByPlayoffs(pairIds: string[], playoffs: Match[], tournament: Tournament): string[] {
  const wins = new Map(pairIds.map((id) => [id, 0]))
  const diff = new Map(pairIds.map((id) => [id, 0]))
  for (const match of playoffs) {
    if (match.sideA.kind !== 'pair' || match.sideB.kind !== 'pair') continue
    const tally = tallyMatch(match.sets, tournament.config, match.phase)
    if (!tally.valid || tally.drawn) continue
    const winnerId = tally.setsA > tally.setsB ? match.sideA.pairId : match.sideB.pairId
    const loserId = winnerId === match.sideA.pairId ? match.sideB.pairId : match.sideA.pairId
    wins.set(winnerId, (wins.get(winnerId) ?? 0) + 1)
    diff.set(winnerId, (diff.get(winnerId) ?? 0) + Math.abs(tally.setsA - tally.setsB))
    diff.set(loserId, (diff.get(loserId) ?? 0) - Math.abs(tally.setsA - tally.setsB))
  }
  const original = new Map(pairIds.map((id, index) => [id, index]))
  return [...pairIds].sort((a, b) =>
    (wins.get(b) ?? 0) - (wins.get(a) ?? 0)
    || (diff.get(b) ?? 0) - (diff.get(a) ?? 0)
    || (original.get(a) ?? 0) - (original.get(b) ?? 0),
  )
}

function makePlayoff(group: Group, pairIds: [string, string]): Match {
  return {
    id: createId(),
    phase: 'playoff',
    round: 100,
    roundName: 'Desempate',
    groupId: group.id,
    wave: 0,
    court: null,
    sideA: { kind: 'pair', pairId: pairIds[0] },
    sideB: { kind: 'pair', pairId: pairIds[1] },
    sets: [],
    playedBy: null,
  }
}

function samePairings(match: Match, pairIds: [string, string]): boolean {
  if (match.sideA.kind !== 'pair' || match.sideB.kind !== 'pair') return false
  const ids = [match.sideA.pairId, match.sideB.pairId]
  return ids.includes(pairIds[0]) && ids.includes(pairIds[1])
}

function stripPlayoffs(tournament: Tournament): Tournament {
  if (!tournament.matches.some((match) => match.phase === 'playoff')) return tournament
  return {
    ...tournament,
    matches: scheduleMatches(
      tournament.matches.filter((match) => match.phase !== 'playoff'),
      tournament.config.courtCount,
    ),
  }
}
