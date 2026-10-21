import { playoffsOfGroup } from './playoff.ts'
import { formatSets, tallyMatch } from './scores.ts'
import { isMatchFinished, resolveSide, roundRobinTable, tableForGroup, winnerOf, type ResolvedSide } from './resolve.ts'
import { spotStatusFor } from './standings.ts'
import type { Match, SetScore, Tournament } from './types.ts'

export type MatchStatus = 'bye' | 'waiting' | 'ready' | 'finished'

export interface SideView {
  pairId: string | null
  label: string
  winner: boolean
}

export interface MatchView {
  id: string
  phase: Match['phase']
  round: number
  roundName: string
  groupId?: string
  groupName: string | null
  wave: number
  court: number | null
  sideA: SideView
  sideB: SideView
  sets: SetScore[]
  scoreLabel: string
  scoreA: number | null
  scoreB: number | null
  winnerId: string | null
  status: MatchStatus
}

export interface TableView {
  id: string
  name: string
  qualifiers: number | null
  matchesToPlay: number
  settled: boolean
  playoffPending: boolean
  warning: string | null
  rows: Array<{
    rank: number
    pairId: string
    label: string
    played: number
    won: number
    lost: number
    points: number
    setsFor: number
    setsAgainst: number
    gamesFor: number
    gamesAgainst: number
    tied: boolean
    qualified: boolean
  }>
}

export function pairLabel(tournament: Tournament, pairId: string): string {
  const pair = tournament.pairs.find((item) => item.id === pairId)
  if (!pair) return 'Pareja eliminada'
  return pair.playerIds.map((playerId) => playerName(tournament, playerId)).join(' / ')
}

export function playerName(tournament: Tournament, playerId: string): string {
  return tournament.players.find((player) => player.id === playerId)?.name ?? 'Jugador'
}

export function presentMatches(tournament: Tournament): MatchView[] {
  return tournament.matches
    .map((match) => presentMatch(tournament, match))
    .sort((a, b) => a.wave - b.wave || (a.court ?? 0) - (b.court ?? 0) || a.round - b.round)
}

export function presentTables(tournament: Tournament): TableView[] {
  if (tournament.config.format === 'round_robin') {
    return [toTable('round-robin', 'Clasificación', null, roundRobinTable(tournament), tournament)]
  }
  if (tournament.config.format === 'groups_knockout') {
    return tournament.groups.map((group) => toTable(
      group.id,
      group.name,
      tournament.config.qualifiersPerGroup,
      tableForGroup(tournament, group),
      tournament,
    ))
  }
  return []
}

export function presentBracket(tournament: Tournament): Array<{ round: number; name: string; matches: MatchView[] }> {
  const matches = presentMatches(tournament).filter((match) => match.phase === 'knockout')
  const rounds = [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b)
  return rounds.map((round) => {
    const inRound = matches.filter((match) => match.round === round)
    return { round, name: inRound[0]?.roundName ?? `Ronda ${round}`, matches: inRound }
  })
}

export function isTournamentComplete(tournament: Tournament): boolean {
  return tournament.status === 'active'
    && tournament.matches.length > 0
    && tournament.matches.every((match) => isMatchFinished(tournament, match))
}

export function completionLabel(tournament: Tournament): string {
  if (tournament.status === 'draft') return 'Borrador'
  if (isTournamentComplete(tournament)) return 'Finalizado'
  return 'En curso'
}

function presentMatch(tournament: Tournament, match: Match): MatchView {
  const sideA = resolveSide(tournament, match.sideA)
  const sideB = resolveSide(tournament, match.sideB)
  const winnerId = winnerOf(tournament, match)
  const tally = tallyMatch(match.sets, tournament.config, match.phase)
  const status = matchStatus(sideA, sideB, winnerId, tally.valid)
  return {
    id: match.id,
    phase: match.phase,
    round: match.round,
    roundName: match.roundName,
    groupId: match.groupId,
    groupName: tournament.groups.find((group) => group.id === match.groupId)?.name ?? null,
    wave: match.wave,
    court: match.court,
    sideA: toSide(tournament, sideA, winnerId),
    sideB: toSide(tournament, sideB, winnerId),
    sets: match.sets,
    scoreLabel: status === 'bye' ? 'Pase' : formatSets(match.sets, tournament.config.scoringMode),
    scoreA: tally.valid ? tally.setsA : null,
    scoreB: tally.valid ? tally.setsB : null,
    winnerId,
    status,
  }
}

function toSide(tournament: Tournament, side: ResolvedSide, winnerId: string | null): SideView {
  if (side.state === 'pair') {
    return { pairId: side.pairId, label: pairLabel(tournament, side.pairId), winner: side.pairId === winnerId }
  }
  if (side.state === 'bye') return { pairId: null, label: 'BYE', winner: false }
  return { pairId: null, label: side.label, winner: false }
}

function matchStatus(sideA: ResolvedSide, sideB: ResolvedSide, winnerId: string | null, hasResult: boolean): MatchStatus {
  const byeVsPair = (sideA.state === 'bye' && sideB.state === 'pair') || (sideB.state === 'bye' && sideA.state === 'pair')
  if (byeVsPair || (sideA.state === 'bye' && sideB.state === 'bye')) return 'bye'
  if (winnerId || hasResult) return 'finished'
  if (sideA.state === 'pair' && sideB.state === 'pair') return 'ready'
  return 'waiting'
}

function toTable(
  id: string,
  name: string,
  qualifiers: number | null,
  rows: ReturnType<typeof roundRobinTable>,
  tournament: Tournament,
): TableView {
  const matchesToPlay = Math.max(rows.length - 1, 0)
  const leagueDone = rows.length > 0 && rows.every((row) => row.played >= matchesToPlay)
  const playoffs = playoffsOfGroup(tournament, id)
  const playoffOpen = playoffs.some((match) => !isMatchFinished(tournament, match))
  const settled = leagueDone && !playoffOpen
  const spots = leagueDone ? spotStatusFor(rows, qualifiers) : new Map()
  return {
    id,
    name,
    qualifiers,
    matchesToPlay,
    settled,
    playoffPending: playoffOpen,
    warning: tableWarning(tournament, playoffOpen, playoffs.length, leagueDone, [...spots.values()].filter((spot) => spot === 'fight').length),
    rows: rows.map((row, index) => {
      const spot = spots.get(row.pairId)
      const qualified = leagueDone && (spot === 'in' || (settled && qualifiers !== null && index < qualifiers))
      const tied = leagueDone && !settled && spot === 'fight'
      return {
        rank: row.rank,
        pairId: row.pairId,
        label: pairLabel(tournament, row.pairId),
        played: row.played,
        won: row.won,
        lost: row.lost,
        points: row.points,
        setsFor: row.setsFor,
        setsAgainst: row.setsAgainst,
        gamesFor: row.gamesFor,
        gamesAgainst: row.gamesAgainst,
        tied,
        qualified,
      }
    }),
  }
}

function tableWarning(
  tournament: Tournament,
  playoffOpen: boolean,
  playoffCount: number,
  leagueDone: boolean,
  fightingCount: number,
): string | null {
  if (playoffOpen) {
    const extra = playoffCount > 1
      ? ` Hay ${playoffCount} desempates.`
      : ''
    return `Hay empate a puntos por un cupo. Gana quien llega primero a ${tournament.config.setsToPlay} sets.${extra}`
  }
  if (!leagueDone) return null
  if (fightingCount > 0 && tournament.config.scoringMode !== 'sets_won') {
    return 'Hay un empate a puntos en la última plaza. El orden usa el resto de criterios y la inscripción.'
  }
  return null
}
