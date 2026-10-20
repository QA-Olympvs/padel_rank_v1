import type {
  CompetitionFormat,
  Group,
  Match,
  MatchPhase,
  MatchSide,
  Pair,
  PairingMode,
  Player,
  ScoringMode,
  SetScore,
  Tournament,
  TournamentStatus,
} from './types.ts'
import { syncPlayoffs } from './playoff.ts'
import { sanitizeResults } from './resolve.ts'
import { DEFAULT_SCORING } from './types.ts'

export const STORAGE_KEY = 'padel-tournaments-v1'

export interface TournamentFile {
  version: 1
  exportedAt: string
  tournaments: Tournament[]
}

export function serializeStore(tournaments: Tournament[]): string {
  const file: TournamentFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tournaments,
  }
  return JSON.stringify(file, null, 2)
}

export function deserializeStore(raw: string): Tournament[] | null {
  try {
    return parseTournamentFile(JSON.parse(raw))
  } catch {
    return null
  }
}

export function parseTournamentFile(value: unknown): Tournament[] | null {
  const source = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.tournaments)
      ? value.tournaments
      : null
  if (!source) return null
  const tournaments: Tournament[] = []
  for (const item of source) {
    const tournament = parseTournament(item)
    if (!tournament) return null
    tournaments.push(sanitizeResults(syncPlayoffs(tournament)))
  }
  return tournaments
}

export function loadTournaments(): Tournament[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return deserializeStore(raw) ?? []
  } catch {
    return []
  }
}

export function saveTournaments(tournaments: Tournament[]): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, serializeStore(tournaments))
    return null
  } catch {
    return 'No se pudo guardar en este navegador. Exporta una copia en JSON para no perder los torneos.'
  }
}

function parseTournament(value: unknown): Tournament | null {
  if (!isRecord(value)) return null
  const config = parseConfig(value.config)
  const players = parsePlayers(value.players)
  if (!config || !players) return null
  const pairs = parsePairs(value.pairs, players)
  const groups = parseGroups(value.groups)
  const matches = parseMatches(value.matches)
  if (!pairs || !groups || !matches) return null
  if (value.status !== 'draft' && value.status !== 'active') return null
  if (typeof value.id !== 'string' || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return null
  return {
    id: value.id,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    status: value.status as TournamentStatus,
    config,
    players,
    pairs,
    groups,
    matches,
    groupBalanceNote: typeof value.groupBalanceNote === 'string' ? value.groupBalanceNote : null,
  }
}

function parseConfig(value: unknown): Tournament['config'] | null {
  if (!isRecord(value) || typeof value.name !== 'string') return null
  if (!isFormat(value.format) || !isPairing(value.pairingMode)) return null
  if (!isInt(value.pairCount) || !isInt(value.courtCount) || !isInt(value.groupSize) || !isInt(value.qualifiersPerGroup)) return null
  const scoringMode = isScoring(value.scoringMode) ? value.scoringMode : DEFAULT_SCORING.scoringMode
  const pointsPerWin = isInt(value.pointsPerWin) ? value.pointsPerWin : DEFAULT_SCORING.pointsPerWin
  const setsToPlay = isInt(value.setsToPlay) ? value.setsToPlay : DEFAULT_SCORING.setsToPlay
  return {
    name: value.name,
    format: value.format,
    pairCount: value.pairCount,
    courtCount: value.courtCount,
    pairingMode: value.pairingMode,
    groupSize: value.groupSize,
    qualifiersPerGroup: value.qualifiersPerGroup,
    scoringMode,
    pointsPerWin,
    setsToPlay,
  }
}

function parsePlayers(value: unknown): Player[] | null {
  if (!Array.isArray(value)) return null
  const players: Player[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') return null
    players.push({ id: item.id, name: item.name })
  }
  return players
}

function parsePairs(value: unknown, players: Player[]): Pair[] | null {
  if (!Array.isArray(value)) return null
  const pairs: Pair[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || !Array.isArray(item.playerIds) || item.playerIds.length !== 2) return null
    const [first, second] = item.playerIds
    if (typeof first !== 'string' || typeof second !== 'string') return null
    if (!players.some((player) => player.id === first) || !players.some((player) => player.id === second)) return null
    pairs.push({ id: item.id, playerIds: [first, second] })
  }
  return pairs
}

function parseGroups(value: unknown): Group[] | null {
  if (!Array.isArray(value)) return null
  const groups: Group[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string' || !Array.isArray(item.pairIds)) return null
    if (!item.pairIds.every((pairId) => typeof pairId === 'string')) return null
    groups.push({ id: item.id, name: item.name, pairIds: item.pairIds as string[] })
  }
  return groups
}

function parseMatches(value: unknown): Match[] | null {
  if (!Array.isArray(value)) return null
  const matches: Match[] = []
  for (const item of value) {
    const match = parseMatch(item)
    if (!match) return null
    matches.push(match)
  }
  return matches
}

function parseMatch(value: unknown): Match | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || !isPhase(value.phase) || typeof value.roundName !== 'string') return null
  if (!isInt(value.round) || !isInt(value.wave)) return null
  if (value.court !== null && !isInt(value.court)) return null
  const sideA = parseSide(value.sideA)
  const sideB = parseSide(value.sideB)
  const sets = parseSets(value.sets)
  if (!sideA || !sideB || !sets) return null
  const playedBy = parsePlayedBy(value.playedBy)
  if (playedBy === undefined) return null
  return {
    id: value.id,
    phase: value.phase,
    round: value.round,
    roundName: value.roundName,
    groupId: typeof value.groupId === 'string' ? value.groupId : undefined,
    wave: value.wave,
    court: value.court,
    sideA,
    sideB,
    sets,
    playedBy,
  }
}

function parseSide(value: unknown): MatchSide | null {
  if (!isRecord(value)) return null
  if (value.kind === 'bye') return { kind: 'bye' }
  if (value.kind === 'pair' && typeof value.pairId === 'string') return { kind: 'pair', pairId: value.pairId }
  if (value.kind === 'winner' && typeof value.matchId === 'string') return { kind: 'winner', matchId: value.matchId }
  if (value.kind === 'group' && typeof value.groupId === 'string' && isInt(value.rank)) {
    return { kind: 'group', groupId: value.groupId, rank: value.rank }
  }
  return null
}

function parseSets(value: unknown): SetScore[] | null {
  if (!Array.isArray(value)) return null
  const sets: SetScore[] = []
  for (const item of value) {
    if (!isRecord(item) || !isInt(item.gamesA) || !isInt(item.gamesB)) return null
    sets.push({ gamesA: item.gamesA, gamesB: item.gamesB })
  }
  return sets
}

function parsePlayedBy(value: unknown): Match['playedBy'] | undefined {
  if (value === null || value === undefined) return null
  if (!isRecord(value) || typeof value.pairAId !== 'string' || typeof value.pairBId !== 'string') return undefined
  return { pairAId: value.pairAId, pairBId: value.pairBId }
}

function isFormat(value: unknown): value is CompetitionFormat {
  return value === 'round_robin' || value === 'elimination' || value === 'groups_knockout'
}

function isPairing(value: unknown): value is PairingMode {
  return value === 'manual' || value === 'random'
}

function isScoring(value: unknown): value is ScoringMode {
  return value === 'match_points' || value === 'sets_won'
}

function isPhase(value: unknown): value is MatchPhase {
  return value === 'round_robin' || value === 'group' || value === 'playoff' || value === 'knockout'
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
