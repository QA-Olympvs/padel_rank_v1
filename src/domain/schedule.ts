import type { Match, MatchSide } from './types.ts'

/**
 * Asigna turnos y canchas sin que una pareja o una cancha coincidan en el mismo turno.
 * La fase de grupos termina antes de los desempates y de la eliminación.
 * Si los partidos de liguilla ya tienen turno, no se reasignan.
 */
export function scheduleMatches(matches: Match[], courtCount: number): Match[] {
  const scheduled = matches.map((match) => ({ ...match }))
  const regular = scheduled.filter((match) => match.phase !== 'knockout' && match.phase !== 'playoff')
  const regularLocked = regular.some((match) => match.wave !== 0)

  let wave = 1
  if (regularLocked) {
    wave = Math.max(0, ...regular.map((match) => match.wave)) + 1
  } else {
    wave = schedulePool(regular, courtCount, 1)
  }

  const playoffs = scheduled.filter((match) => match.phase === 'playoff')
  resetWaves(playoffs)
  wave = schedulePool(playoffs, courtCount, wave)

  const knockouts = scheduled.filter((match) => match.phase === 'knockout')
  resetWaves(knockouts)
  const rounds = [...new Set(knockouts.map((match) => match.round))].sort((a, b) => a - b)
  for (const round of rounds) {
    wave = schedulePool(
      knockouts.filter((match) => match.round === round),
      courtCount,
      wave,
    )
  }
  return scheduled
}

function resetWaves(matches: Match[]) {
  for (const match of matches) {
    match.wave = 0
    match.court = null
  }
}

function schedulePool(matches: Match[], courtCount: number, startWave: number): number {
  const pending = matches.filter((match) => !isBye(match))
  for (const match of matches) {
    if (isBye(match)) {
      match.court = null
      match.wave = -1
    }
  }

  let wave = startWave
  while (pending.length > 0) {
    const usedPairs = new Set<string>()
    let placed = 0
    for (let index = 0; index < pending.length && placed < courtCount;) {
      const match = pending[index]
      const pairIds = knownPairIds(match)
      if (pairIds.some((pairId) => usedPairs.has(pairId))) {
        index += 1
        continue
      }
      for (const pairId of pairIds) usedPairs.add(pairId)
      match.wave = wave
      match.court = placed + 1
      pending.splice(index, 1)
      placed += 1
    }
    if (placed === 0) {
      const match = pending.shift()
      if (!match) break
      match.wave = wave
      match.court = 1
    }
    wave += 1
  }
  return wave
}

function isBye(match: Match): boolean {
  return match.sideA.kind === 'bye' || match.sideB.kind === 'bye'
}

function knownPairIds(match: Match): string[] {
  return [match.sideA, match.sideB].flatMap((side) => pairIdOf(side))
}

function pairIdOf(side: MatchSide): string[] {
  return side.kind === 'pair' ? [side.pairId] : []
}
