import { DEFAULT_SCORING, LIMITS, scoringOf, type MatchPhase, type SetScore, type TournamentConfig } from './types.ts'

export interface SetTally {
  setsA: number
  setsB: number
  gamesA: number
  gamesB: number
  valid: boolean
  drawn: boolean
}

export function usesSetCount(config: TournamentConfig): boolean {
  return scoringOf(config).scoringMode === 'sets_won'
}

/** En liguilla y grupos se juegan N sets. En el cuadro, gana quien llega primero a N. */
export function setCountMode(config: TournamentConfig, phase?: MatchPhase): 'sum' | 'first_to' | null {
  if (!usesSetCount(config)) return null
  return phase === 'knockout' || phase === 'playoff' ? 'first_to' : 'sum'
}

export function tallyMatch(sets: SetScore[], config: TournamentConfig, phase?: MatchPhase): SetTally {
  const mode = setCountMode(config, phase)
  if (mode === 'first_to') return tallyFirstTo(sets, scoringOf(config).setsToPlay)
  if (mode === 'sum') return tallySetSum(sets, scoringOf(config).setsToPlay)
  return tallyBestOf(sets)
}

export function tallySets(sets: SetScore[]): SetTally {
  return tallyBestOf(sets)
}

export function setsError(sets: SetScore[], config: TournamentConfig, phase?: MatchPhase): string | null {
  const scoring = scoringOf(config)
  const mode = setCountMode(config, phase)
  if (mode === 'first_to') {
    if (sets.length !== 1) return `Anota los sets que ganó cada pareja. Gana quien llegue a ${scoring.setsToPlay}.`
    const setsA = sets[0].gamesA
    const setsB = sets[0].gamesB
    if (!isCountInRange(setsA, scoring.setsToPlay) || !isCountInRange(setsB, scoring.setsToPlay)) {
      return `Los sets ganados tienen que ser números enteros entre 0 y ${scoring.setsToPlay}.`
    }
    const high = Math.max(setsA, setsB)
    const low = Math.min(setsA, setsB)
    if (high !== scoring.setsToPlay || low >= scoring.setsToPlay) {
      return `Gana la primera pareja que llega a ${scoring.setsToPlay} sets. El resultado tiene que ser ${scoring.setsToPlay} contra 0-${scoring.setsToPlay - 1}.`
    }
    return null
  }

  if (mode === 'sum') {
    if (sets.length !== 1) return `Anota los sets ganados por cada pareja. Deben sumar ${scoring.setsToPlay}.`
    const setsA = sets[0].gamesA
    const setsB = sets[0].gamesB
    if (!isCountInRange(setsA, scoring.setsToPlay) || !isCountInRange(setsB, scoring.setsToPlay)) {
      return `Los sets ganados tienen que ser números enteros entre 0 y ${scoring.setsToPlay}.`
    }
    if (setsA + setsB !== scoring.setsToPlay) {
      return `En suma de ${scoring.setsToPlay} los sets ganados deben sumar ${scoring.setsToPlay}. Ahora suman ${setsA + setsB}.`
    }
    return null
  }

  if (sets.length < 1) return 'Añade al menos un set.'
  if (sets.length > LIMITS.maxSets) return `Un partido puede tener como máximo ${LIMITS.maxSets} sets.`

  for (const [index, set] of sets.entries()) {
    if (!isValidGameCount(set.gamesA) || !isValidGameCount(set.gamesB)) {
      return `El set ${index + 1} necesita juegos enteros entre 0 y ${LIMITS.maxGames}.`
    }
    if (set.gamesA === set.gamesB) {
      return `El set ${index + 1} está empatado a juegos. Tiene que haber un ganador del set.`
    }
  }

  const tally = tallyBestOf(sets)
  if (!tally.valid || tally.drawn) {
    return 'El marcador no tiene un ganador. Si van un set a uno, juega el tercer set.'
  }
  return null
}

export function formatSets(sets: SetScore[], scoringMode: TournamentConfig['scoringMode'] = DEFAULT_SCORING.scoringMode): string {
  if (sets.length === 0) return 'Sin resultado'
  if (scoringMode === 'sets_won' && sets.length === 1) return `${sets[0].gamesA}-${sets[0].gamesB}`
  return sets.map((set) => `${set.gamesA}-${set.gamesB}`).join(', ')
}

function tallyBestOf(sets: SetScore[]): SetTally {
  let setsA = 0
  let setsB = 0
  let gamesA = 0
  let gamesB = 0

  if (sets.length < 1 || sets.length > LIMITS.maxSets) {
    return emptyTally()
  }

  for (const set of sets) {
    if (!isValidGameCount(set.gamesA) || !isValidGameCount(set.gamesB)) return emptyTally()
    if (set.gamesA === set.gamesB) return emptyTally()
    gamesA += set.gamesA
    gamesB += set.gamesB
    if (set.gamesA > set.gamesB) setsA += 1
    else setsB += 1
  }

  const drawn = setsA === setsB
  return { setsA, setsB, gamesA, gamesB, valid: !drawn, drawn }
}

function tallySetSum(sets: SetScore[], setsToPlay: number): SetTally {
  if (sets.length !== 1) return emptyTally()
  const setsA = sets[0].gamesA
  const setsB = sets[0].gamesB
  if (!isCountInRange(setsA, setsToPlay) || !isCountInRange(setsB, setsToPlay)) return emptyTally()
  if (setsA + setsB !== setsToPlay) return emptyTally()
  return {
    setsA,
    setsB,
    gamesA: setsA,
    gamesB: setsB,
    valid: true,
    drawn: setsA === setsB,
  }
}

function tallyFirstTo(sets: SetScore[], target: number): SetTally {
  if (sets.length !== 1) return emptyTally()
  const setsA = sets[0].gamesA
  const setsB = sets[0].gamesB
  if (!isCountInRange(setsA, target) || !isCountInRange(setsB, target)) return emptyTally()
  const high = Math.max(setsA, setsB)
  const low = Math.min(setsA, setsB)
  if (high !== target || low >= target) return emptyTally()
  return {
    setsA,
    setsB,
    gamesA: setsA,
    gamesB: setsB,
    valid: true,
    drawn: false,
  }
}

function emptyTally(): SetTally {
  return { setsA: 0, setsB: 0, gamesA: 0, gamesB: 0, valid: false, drawn: false }
}

function isValidGameCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= LIMITS.maxGames
}

function isCountInRange(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= max
}
