import { knockoutRoundName, placeInBracket } from './bracket.ts'
import { groupName, planGroups } from './groups.ts'
import { createId, timestamp } from './ids.ts'
import { scheduleMatches } from './schedule.ts'
import type { Group, Match, MatchSide, Pair, Tournament } from './types.ts'

export function buildStartedTournament(tournament: Tournament): Tournament {
  const pairs = tournament.pairs
  const groups = tournament.config.format === 'groups_knockout' ? buildGroups(pairs, tournament.config.groupSize) : []
  const plan = tournament.config.format === 'groups_knockout'
    ? planGroups(pairs.length, tournament.config.groupSize, tournament.config.qualifiersPerGroup)
    : null

  const matches = createMatches(tournament, groups)
  return {
    ...tournament,
    status: 'active',
    groups,
    matches: scheduleMatches(matches, tournament.config.courtCount),
    groupBalanceNote: plan?.note ?? null,
    updatedAt: timestamp(),
  }
}

function createMatches(tournament: Tournament, groups: Group[]): Match[] {
  if (tournament.config.format === 'round_robin') {
    return roundRobinMatches(tournament.pairs.map((pair) => pair.id), 'round_robin')
  }
  if (tournament.config.format === 'elimination') {
    return knockoutMatches(tournament.pairs.map((pair) => ({ kind: 'pair', pairId: pair.id })))
  }

  const groupMatches = groups.flatMap((group) =>
    roundRobinMatches(group.pairIds, 'group', group.id),
  )
  const qualifiers: MatchSide[] = []
  for (let rank = 1; rank <= tournament.config.qualifiersPerGroup; rank += 1) {
    for (const group of groups) qualifiers.push({ kind: 'group', groupId: group.id, rank })
  }
  return [...groupMatches, ...knockoutMatches(qualifiers)]
}

function buildGroups(pairs: Pair[], preferredSize: number): Group[] {
  const plan = planGroups(pairs.length, preferredSize, 1)
  const groups: Group[] = []
  let cursor = 0
  plan.sizes.forEach((size, index) => {
    groups.push({
      id: createId(),
      name: groupName(index),
      pairIds: pairs.slice(cursor, cursor + size).map((pair) => pair.id),
    })
    cursor += size
  })
  return groups
}

function roundRobinMatches(pairIds: string[], phase: 'round_robin' | 'group', groupId?: string): Match[] {
  return circleRounds(pairIds).flatMap((round, roundIndex) =>
    round.map(([pairAId, pairBId]) => ({
      id: createId(),
      phase,
      round: roundIndex + 1,
      roundName: `Jornada ${roundIndex + 1}`,
      groupId,
      wave: 0,
      court: null,
      sideA: { kind: 'pair', pairId: pairAId },
      sideB: { kind: 'pair', pairId: pairBId },
      sets: [],
      playedBy: null,
    })),
  )
}

/**
 * Método del círculo. Con un número impar de parejas, una descansa cada jornada
 * y ese descanso no se guarda como partido.
 */
function circleRounds(pairIds: string[]): Array<Array<[string, string]>> {
  const row = [...pairIds]
  if (row.length % 2 === 1) row.push('__bye__')
  const count = row.length
  const rotation = row.slice(1)
  const fixed = row[0]
  const rounds: Array<Array<[string, string]>> = []

  for (let round = 0; round < count - 1; round += 1) {
    const line = [fixed, ...rotation]
    const matches: Array<[string, string]> = []
    for (let index = 0; index < count / 2; index += 1) {
      const left = line[index]
      const right = line[count - 1 - index]
      if (left !== '__bye__' && right !== '__bye__') matches.push([left, right])
    }
    rounds.push(matches)
    const last = rotation.pop()
    if (last) rotation.unshift(last)
  }
  return rounds
}

function knockoutMatches(slots: MatchSide[]): Match[] {
  let current = placeInBracket(slots)
  const matches: Match[] = []
  let round = 1

  while (current.length >= 2) {
    const next: MatchSide[] = []
    const roundName = knockoutRoundName(current.length)
    for (let index = 0; index < current.length; index += 2) {
      const id = createId()
      matches.push({
        id,
        phase: 'knockout',
        round,
        roundName,
        wave: 0,
        court: null,
        sideA: current[index],
        sideB: current[index + 1],
        sets: [],
        playedBy: null,
      })
      next.push({ kind: 'winner', matchId: id })
    }
    current = next
    round += 1
  }
  return matches
}
