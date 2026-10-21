export type CompetitionFormat = 'round_robin' | 'elimination' | 'groups_knockout'

export type PairingMode = 'manual' | 'random'

export type GroupAssignment = 'auto' | 'manual'

export type ScoringMode = 'match_points' | 'sets_won'

export type TournamentStatus = 'draft' | 'active'

export interface TournamentConfig {
  name: string
  format: CompetitionFormat
  pairCount: number
  courtCount: number
  pairingMode: PairingMode
  /** Cómo se meten las parejas en los grupos. Solo aplica a grupos y eliminación. */
  groupAssignment?: GroupAssignment
  groupSize: number
  qualifiersPerGroup: number
  /** Cómo se suman los puntos en liguilla y grupos. */
  scoringMode: ScoringMode
  /** Puntos que suma el ganador del partido cuando el modo es por victoria. */
  pointsPerWin: number
  /** En grupos/liguilla: sets que se suman. En el cuadro: primero que llega a este número. */
  setsToPlay: number
}

export interface Player {
  id: string
  name: string
}

export interface Pair {
  id: string
  playerIds: [string, string]
}

export interface Group {
  id: string
  name: string
  pairIds: string[]
}

export interface SetScore {
  gamesA: number
  gamesB: number
}

export type MatchSide =
  | { kind: 'pair'; pairId: string }
  | { kind: 'bye' }
  | { kind: 'winner'; matchId: string }
  | { kind: 'group'; groupId: string; rank: number }
  /** Plaza del cuadro por puntos entre todas las clasificadas. 1 = la mejor. */
  | { kind: 'overall'; rank: number }

export type MatchPhase = 'round_robin' | 'group' | 'playoff' | 'knockout'

export interface Match {
  id: string
  phase: MatchPhase
  round: number
  roundName: string
  groupId?: string
  /** Turno horario. -1 cuando el partido es un pase automático y no ocupa cancha. */
  wave: number
  court: number | null
  sideA: MatchSide
  sideB: MatchSide
  sets: SetScore[]
  /** Parejas que había en la pista cuando se guardó el resultado. */
  playedBy: { pairAId: string; pairBId: string } | null
}

export interface Tournament {
  id: string
  createdAt: string
  updatedAt: string
  status: TournamentStatus
  config: TournamentConfig
  players: Player[]
  pairs: Pair[]
  groups: Group[]
  matches: Match[]
  groupBalanceNote: string | null
}

export const FORMAT_LABEL: Record<CompetitionFormat, string> = {
  round_robin: 'Todos contra todos',
  elimination: 'Eliminación directa',
  groups_knockout: 'Grupos y eliminación',
}

export const PAIRING_LABEL: Record<PairingMode, string> = {
  manual: 'Parejas elegidas',
  random: 'Parejas aleatorias',
}

export const GROUP_ASSIGNMENT_LABEL: Record<GroupAssignment, string> = {
  auto: 'Grupos automáticos',
  manual: 'Grupos a mano',
}

export const SCORING_LABEL: Record<ScoringMode, string> = {
  match_points: 'Puntos por partido ganado',
  sets_won: 'Suma de sets',
}

export const DEFAULT_SCORING = {
  scoringMode: 'match_points' as ScoringMode,
  pointsPerWin: 2,
  setsToPlay: 6,
}

export const DEFAULT_GROUP_ASSIGNMENT: GroupAssignment = 'auto'

export function scoringOf(config: Pick<TournamentConfig, 'scoringMode' | 'pointsPerWin' | 'setsToPlay'>): {
  scoringMode: ScoringMode
  pointsPerWin: number
  setsToPlay: number
} {
  return {
    scoringMode: config.scoringMode ?? DEFAULT_SCORING.scoringMode,
    pointsPerWin: config.pointsPerWin ?? DEFAULT_SCORING.pointsPerWin,
    setsToPlay: config.setsToPlay ?? DEFAULT_SCORING.setsToPlay,
  }
}

export const LIMITS = {
  name: 80,
  playerName: 40,
  minPairs: 2,
  maxPairs: 32,
  minCourts: 1,
  maxCourts: 12,
  minGroupSize: 2,
  maxGroupSize: 8,
  maxSets: 3,
  maxGames: 99,
  minPointsPerWin: 1,
  maxPointsPerWin: 5,
  minSetsToPlay: 3,
  maxSetsToPlay: 9,
} as const
