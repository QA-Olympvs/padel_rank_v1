import { planGroups } from './groups.ts'
import { nameKey, normalizeText } from './text.ts'
import { LIMITS, type Tournament, type TournamentConfig } from './types.ts'

export function configError(config: TournamentConfig): string | null {
  const name = normalizeText(config.name)
  if (!name) return 'Escribe un nombre para el torneo.'
  if (name.length > LIMITS.name) return `El nombre puede tener como máximo ${LIMITS.name} caracteres.`
  if (!Number.isInteger(config.pairCount) || config.pairCount < LIMITS.minPairs || config.pairCount > LIMITS.maxPairs) {
    return `El número de parejas debe estar entre ${LIMITS.minPairs} y ${LIMITS.maxPairs}.`
  }
  if (!Number.isInteger(config.courtCount) || config.courtCount < LIMITS.minCourts || config.courtCount > LIMITS.maxCourts) {
    return `Las canchas deben estar entre ${LIMITS.minCourts} y ${LIMITS.maxCourts}.`
  }
  if (config.scoringMode !== 'match_points' && config.scoringMode !== 'sets_won') {
    return 'Elige cómo se suman los puntos.'
  }
  if (config.scoringMode === 'match_points') {
    if (!Number.isInteger(config.pointsPerWin) || config.pointsPerWin < LIMITS.minPointsPerWin || config.pointsPerWin > LIMITS.maxPointsPerWin) {
      return `Los puntos por partido ganado deben estar entre ${LIMITS.minPointsPerWin} y ${LIMITS.maxPointsPerWin}.`
    }
  }
  if (config.scoringMode === 'sets_won') {
    if (!Number.isInteger(config.setsToPlay) || config.setsToPlay < LIMITS.minSetsToPlay || config.setsToPlay > LIMITS.maxSetsToPlay) {
      return `La suma de sets debe estar entre ${LIMITS.minSetsToPlay} y ${LIMITS.maxSetsToPlay}.`
    }
  }
  if (config.format === 'groups_knockout') {
    return planGroups(config.pairCount, config.groupSize, config.qualifiersPerGroup).error
  }
  return null
}

export function readinessError(tournament: Tournament): string | null {
  const configProblem = configError(tournament.config)
  if (configProblem) return configProblem
  if (tournament.status !== 'draft') return 'Este torneo ya está en curso.'

  const expectedPlayers = tournament.config.pairCount * 2
  if (tournament.players.length !== expectedPlayers) {
    const registered = tournament.players.length
    const noun = registered === 1 ? 'jugador' : 'jugadores'
    return `Hay ${registered} ${noun} y este torneo necesita ${expectedPlayers}.`
  }

  const seen = new Set<string>()
  for (const player of tournament.players) {
    const key = nameKey(player.name)
    if (!key) return 'Hay un jugador sin nombre.'
    if (seen.has(key)) return `El jugador «${normalizeText(player.name)}» está repetido.`
    seen.add(key)
  }

  if (tournament.pairs.length !== tournament.config.pairCount) {
    return `Faltan parejas: hay ${tournament.pairs.length} de ${tournament.config.pairCount}.`
  }

  const used = new Set<string>()
  for (const pair of tournament.pairs) {
    const [first, second] = pair.playerIds
    if (!first || !second || first === second) return 'Hay una pareja incompleta.'
    if (!tournament.players.some((player) => player.id === first) || !tournament.players.some((player) => player.id === second)) {
      return 'Hay una pareja con un jugador que ya no existe.'
    }
    if (used.has(first) || used.has(second)) return 'Un jugador está en más de una pareja.'
    used.add(first)
    used.add(second)
  }

  if (tournament.config.pairingMode === 'manual' && used.size !== expectedPlayers) {
    return 'Todas las parejas tienen que estar completas antes de iniciar.'
  }

  if (tournament.config.format === 'groups_knockout' && tournament.config.groupAssignment === 'manual') {
    const plan = planGroups(tournament.config.pairCount, tournament.config.groupSize, tournament.config.qualifiersPerGroup)
    if (plan.error) return plan.error
    if (tournament.groups.length !== plan.sizes.length) return 'Asigna las parejas a cada grupo antes de iniciar.'
    for (let index = 0; index < plan.sizes.length; index += 1) {
      const group = tournament.groups[index]
      const size = plan.sizes[index]
      if (!group || group.pairIds.length !== size) {
        return `${group?.name ?? 'Un grupo'} debe tener ${size} ${size === 1 ? 'pareja' : 'parejas'}.`
      }
    }
    const assigned = tournament.groups.flatMap((group) => group.pairIds)
    if (new Set(assigned).size !== assigned.length) return 'Una pareja no puede estar en dos grupos.'
    if (assigned.length !== tournament.pairs.length) return 'Todas las parejas tienen que estar en un grupo.'
    if (assigned.some((id) => !tournament.pairs.some((pair) => pair.id === id))) {
      return 'Hay un grupo con una pareja que ya no existe.'
    }
  }
  return null
}
