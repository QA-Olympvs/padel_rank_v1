import { buildStartedTournament } from './generate.ts'
import { fillGroupsFromPairs, groupAssignmentOf, planGroups, syncDraftGroups } from './groups.ts'
import { createId, timestamp } from './ids.ts'
import { syncPlayoffs } from './playoff.ts'
import { resolveSide, sanitizeResults } from './resolve.ts'
import { scheduleMatches } from './schedule.ts'
import { setsError } from './scores.ts'
import { nameKey, normalizeText } from './text.ts'
import { configError, readinessError } from './validate.ts'
import { LIMITS, type Pair, type SetScore, type Tournament, type TournamentConfig } from './types.ts'

export type ActionResult =
  | { ok: true; tournament: Tournament }
  | { ok: false; error: string }

export function createTournament(config: TournamentConfig): ActionResult {
  const error = configError(config)
  if (error) return { ok: false, error }
  const now = timestamp()
  const tournament: Tournament = {
    id: createId(),
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    config: { ...config, name: normalizeText(config.name), groupAssignment: config.groupAssignment ?? 'auto' },
    players: [],
    pairs: [],
    groups: [],
    matches: [],
    groupBalanceNote: null,
  }
  return { ok: true, tournament: { ...tournament, groups: syncDraftGroups(tournament) } }
}

export function updateSettings(tournament: Tournament, config: TournamentConfig): ActionResult {
  const error = configError(config)
  if (error) return { ok: false, error }
  const nextConfig = { ...config, name: normalizeText(config.name) }

  if (tournament.status === 'active') {
    if (!sameStructure(tournament.config, nextConfig)) {
      return { ok: false, error: 'Con el torneo en curso solo puedes cambiar el nombre y el número de canchas.' }
    }
    const renamed = touch({
      ...tournament,
      config: {
        ...tournament.config,
        name: nextConfig.name,
        courtCount: nextConfig.courtCount,
        pointsPerWin: nextConfig.pointsPerWin,
      },
    })
    if (nextConfig.courtCount === tournament.config.courtCount) return { ok: true, tournament: renamed }
    return {
      ok: true,
      tournament: touch({
        ...renamed,
        matches: scheduleMatches(renamed.matches, nextConfig.courtCount),
      }),
    }
  }

  const resetPairs = tournament.config.pairingMode !== nextConfig.pairingMode
    || tournament.config.pairCount !== nextConfig.pairCount
    || tournament.config.format !== nextConfig.format
  const next: Tournament = {
    ...tournament,
    config: { ...nextConfig, groupAssignment: nextConfig.groupAssignment ?? 'auto' },
    pairs: resetPairs ? [] : tournament.pairs,
  }
  return {
    ok: true,
    tournament: touch({
      ...next,
      groups: syncDraftGroups(next),
    }),
  }
}

export function addPlayer(tournament: Tournament, name: string): ActionResult {
  const draftError = draftOnly(tournament)
  if (draftError) return draftError
  const clean = normalizeText(name)
  if (!clean) return { ok: false, error: 'Escribe el nombre del jugador.' }
  if (clean.length > LIMITS.playerName) return { ok: false, error: `El nombre puede tener como máximo ${LIMITS.playerName} caracteres.` }
  if (tournament.players.length >= tournament.config.pairCount * 2) {
    return { ok: false, error: 'Ya están todos los jugadores de este torneo.' }
  }
  if (tournament.players.some((player) => nameKey(player.name) === nameKey(clean))) {
    return { ok: false, error: `Ya existe un jugador llamado «${clean}».` }
  }
  return {
    ok: true,
    tournament: touch({
      ...tournament,
      players: [...tournament.players, { id: createId(), name: clean }],
    }),
  }
}

export function removePlayer(tournament: Tournament, playerId: string): ActionResult {
  const draftError = draftOnly(tournament)
  if (draftError) return draftError
  const pairs = tournament.pairs.filter((pair) => !pair.playerIds.includes(playerId))
  const next = {
    ...tournament,
    players: tournament.players.filter((player) => player.id !== playerId),
    pairs,
    groups: tournament.groups.map((group) => ({
      ...group,
      pairIds: group.pairIds.filter((id) => pairs.some((pair) => pair.id === id)),
    })),
  }
  return { ok: true, tournament: touch({ ...next, groups: syncDraftGroups(next) }) }
}

export function addManualPair(tournament: Tournament, firstId: string, secondId: string): ActionResult {
  const draftError = draftOnly(tournament)
  if (draftError) return draftError
  if (tournament.config.pairingMode !== 'manual') return { ok: false, error: 'Este torneo forma las parejas al azar.' }
  if (tournament.pairs.length >= tournament.config.pairCount) return { ok: false, error: 'Ya están todas las parejas.' }
  if (!firstId || !secondId || firstId === secondId) return { ok: false, error: 'Elige dos jugadores distintos.' }
  if (!tournament.players.some((player) => player.id === firstId) || !tournament.players.some((player) => player.id === secondId)) {
    return { ok: false, error: 'Elige jugadores que estén dados de alta.' }
  }
  if (tournament.pairs.some((pair) => pair.playerIds.includes(firstId) || pair.playerIds.includes(secondId))) {
    return { ok: false, error: 'Uno de esos jugadores ya tiene pareja.' }
  }
  const pair: Pair = { id: createId(), playerIds: [firstId, secondId] }
  const next = { ...tournament, pairs: [...tournament.pairs, pair] }
  return { ok: true, tournament: touch({ ...next, groups: syncDraftGroups(next) }) }
}

export function removePair(tournament: Tournament, pairId: string): ActionResult {
  const draftError = draftOnly(tournament)
  if (draftError) return draftError
  const next = {
    ...tournament,
    pairs: tournament.pairs.filter((pair) => pair.id !== pairId),
    groups: tournament.groups.map((group) => ({ ...group, pairIds: group.pairIds.filter((id) => id !== pairId) })),
  }
  return { ok: true, tournament: touch({ ...next, groups: syncDraftGroups(next) }) }
}

export function drawRandomPairs(tournament: Tournament, random: () => number = Math.random): ActionResult {
  const draftError = draftOnly(tournament)
  if (draftError) return draftError
  if (tournament.config.pairingMode !== 'random') return { ok: false, error: 'Este torneo usa parejas elegidas a mano.' }
  const expected = tournament.config.pairCount * 2
  if (tournament.players.length !== expected) {
    return { ok: false, error: `Registra ${expected} jugadores antes de sortear las parejas.` }
  }
  const shuffled = shuffle(tournament.players, random)
  const pairs: Pair[] = []
  for (let index = 0; index < shuffled.length; index += 2) {
    pairs.push({ id: createId(), playerIds: [shuffled[index].id, shuffled[index + 1].id] })
  }
  const next = { ...tournament, pairs }
  return { ok: true, tournament: touch({ ...next, groups: syncDraftGroups(next) }) }
}

export function assignPairToGroup(tournament: Tournament, pairId: string, groupId: string | null): ActionResult {
  const draftError = draftOnly(tournament)
  if (draftError) return draftError
  if (groupAssignmentOf(tournament) !== 'manual') return { ok: false, error: 'En este torneo los grupos se arman al iniciar.' }
  if (!tournament.pairs.some((pair) => pair.id === pairId)) return { ok: false, error: 'Esa pareja no está en el torneo.' }
  const groups = syncDraftGroups(tournament)
  const plan = planGroups(tournament.config.pairCount, tournament.config.groupSize, tournament.config.qualifiersPerGroup)
  if (plan.error) return { ok: false, error: plan.error }
  const cleared = groups.map((group) => ({ ...group, pairIds: group.pairIds.filter((id) => id !== pairId) }))
  if (!groupId) return { ok: true, tournament: touch({ ...tournament, groups: cleared }) }
  const target = cleared.findIndex((group) => group.id === groupId)
  if (target < 0) return { ok: false, error: 'No se encontró el grupo.' }
  const cap = plan.sizes[target]
  if (cleared[target].pairIds.length >= cap) return { ok: false, error: `${cleared[target].name} ya está completo.` }
  cleared[target] = { ...cleared[target], pairIds: [...cleared[target].pairIds, pairId] }
  return { ok: true, tournament: touch({ ...tournament, groups: cleared }) }
}

export function autoFillGroups(tournament: Tournament, random?: () => number): ActionResult {
  const draftError = draftOnly(tournament)
  if (draftError) return draftError
  if (groupAssignmentOf(tournament) !== 'manual') return { ok: false, error: 'En este torneo los grupos se arman al iniciar.' }
  if (tournament.pairs.length !== tournament.config.pairCount) {
    return { ok: false, error: `Forma las ${tournament.config.pairCount} parejas antes de repartir los grupos.` }
  }
  const plan = planGroups(tournament.config.pairCount, tournament.config.groupSize, tournament.config.qualifiersPerGroup)
  if (plan.error) return { ok: false, error: plan.error }
  const pairs = random ? shuffle(tournament.pairs, random) : [...tournament.pairs]
  return { ok: true, tournament: touch({ ...tournament, groups: fillGroupsFromPairs(pairs, plan.sizes, tournament.groups) }) }
}

export function startTournament(tournament: Tournament): ActionResult {
  const error = readinessError(tournament)
  if (error) return { ok: false, error }
  return { ok: true, tournament: buildStartedTournament(tournament) }
}

export function recordResult(tournament: Tournament, matchId: string, sets: SetScore[]): ActionResult {
  if (tournament.status !== 'active') return { ok: false, error: 'Inicia el torneo antes de cargar resultados.' }
  const match = tournament.matches.find((item) => item.id === matchId)
  if (!match) return { ok: false, error: 'No se encontró el partido.' }
  const scoreError = setsError(sets, tournament.config, match.phase)
  if (scoreError) return { ok: false, error: scoreError }
  const sideA = resolveSide(tournament, match.sideA)
  const sideB = resolveSide(tournament, match.sideB)
  if (sideA.state === 'bye' || sideB.state === 'bye') return { ok: false, error: 'Este partido es un pase automático.' }
  if (sideA.state !== 'pair' || sideB.state !== 'pair') {
    return { ok: false, error: 'Todavía no están definidas las dos parejas de este partido.' }
  }

  const matches = tournament.matches.map((item) => item.id === matchId
    ? { ...item, sets, playedBy: { pairAId: sideA.pairId, pairBId: sideB.pairId } }
    : item)
  return { ok: true, tournament: touch(sanitizeResults(syncPlayoffs({ ...tournament, matches }))) }
}

export function clearResult(tournament: Tournament, matchId: string): ActionResult {
  if (tournament.status !== 'active') return { ok: false, error: 'Inicia el torneo antes de modificar resultados.' }
  const matches = tournament.matches.map((item) => item.id === matchId ? { ...item, sets: [], playedBy: null } : item)
  return { ok: true, tournament: touch(sanitizeResults(syncPlayoffs({ ...tournament, matches }))) }
}

function draftOnly(tournament: Tournament): ActionResult | null {
  if (tournament.status === 'draft') return null
  return { ok: false, error: 'Los jugadores y las parejas quedan fijos al iniciar el torneo.' }
}

function sameStructure(current: TournamentConfig, next: TournamentConfig): boolean {
  return current.format === next.format
    && current.pairCount === next.pairCount
    && current.pairingMode === next.pairingMode
    && current.groupSize === next.groupSize
    && current.qualifiersPerGroup === next.qualifiersPerGroup
    && (current.groupAssignment ?? 'auto') === (next.groupAssignment ?? 'auto')
    && current.scoringMode === next.scoringMode
    && current.setsToPlay === next.setsToPlay
}

function touch(tournament: Tournament): Tournament {
  return { ...tournament, updatedAt: timestamp() }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const current = next[index]
    next[index] = next[swap]
    next[swap] = current
  }
  return next
}
