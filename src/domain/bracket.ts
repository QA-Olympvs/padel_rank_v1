import type { MatchSide } from './types.ts'

export interface QualifierSeed {
  pairId: string
  points: number
  groupId: string
}

export function nextPowerOfTwo(value: number): number {
  let size = 1
  while (size < value) size *= 2
  return size
}

/** Orden clásico de cabezas de serie: 1 contra N, 4 contra 5, etc. */
export function bracketSeedOrder(size: number): number[] {
  let seeds = [1]
  let block = 1
  while (block < size) {
    const next: number[] = []
    for (const seed of seeds) next.push(seed, block * 2 + 1 - seed)
    seeds = next
    block *= 2
  }
  return seeds
}

export function knockoutRoundName(pairSlots: number): string {
  if (pairSlots <= 2) return 'Final'
  if (pairSlots <= 4) return 'Semifinales'
  if (pairSlots <= 8) return 'Cuartos de final'
  if (pairSlots <= 16) return 'Octavos de final'
  if (pairSlots <= 32) return 'Dieciseisavos de final'
  return `Ronda de ${pairSlots}`
}

export function placeInBracket(slots: MatchSide[]): MatchSide[] {
  const size = nextPowerOfTwo(Math.max(slots.length, 2))
  const placed = bracketSeedOrder(size).map((seed) => slots[seed - 1] ?? { kind: 'bye' as const })
  return splitByeVsBye(separateSameGroup(splitByeVsBye(placed)))
}

/** Un BYE nunca debe jugar contra otro BYE: se cambia por una pareja real. */
function splitByeVsBye(slots: MatchSide[]): MatchSide[] {
  const next = [...slots]
  for (let index = 0; index < next.length; index += 2) {
    if (next[index].kind !== 'bye' || next[index + 1].kind !== 'bye') continue
    const swapAt = next.findIndex((side, other) => {
      if (side.kind === 'bye') return false
      const mate = other % 2 === 0 ? other + 1 : other - 1
      return next[mate].kind !== 'bye'
    })
    if (swapAt < 0) continue
    const mate = swapAt % 2 === 0 ? swapAt + 1 : swapAt - 1
    const displaced = next[mate]
    next[mate] = next[index]
    next[index] = displaced
  }
  return next
}

/**
 * Intenta que dos parejas del mismo grupo no se crucen en la primera ronda.
 * Si no hay un intercambio posible, se deja el cuadro estándar.
 */
function separateSameGroup(slots: MatchSide[]): MatchSide[] {
  const next = [...slots]
  for (let index = 0; index < next.length; index += 2) {
    const leftGroup = groupOf(next[index])
    const rightGroup = groupOf(next[index + 1])
    if (!leftGroup || leftGroup !== rightGroup) continue

    for (let other = 1; other < next.length; other += 2) {
      if (other === index + 1) continue
      const candidate = next[other]
      const candidateGroup = groupOf(candidate)
      const opponentGroup = groupOf(next[other - 1])
      if (candidateGroup === leftGroup) continue
      if (opponentGroup && opponentGroup === rightGroup) continue
      if (facesBye(next, index) || facesBye(next, other - 1)) continue
      const displaced = next[index + 1]
      next[index + 1] = candidate
      next[other] = displaced
      break
    }
  }
  return next
}

function groupOf(side: MatchSide): string | null {
  return side.kind === 'group' ? side.groupId : null
}

function facesBye(slots: MatchSide[], leftIndex: number): boolean {
  return slots[leftIndex].kind === 'bye' || slots[leftIndex + 1].kind === 'bye'
}

/** Cuántos pases hay en un cuadro de eliminación con `count` clasificadas. */
export function byeCountFor(count: number): number {
  return nextPowerOfTwo(Math.max(count, 2)) - count
}

/**
 * Los pases van a las clasificadas con más puntos. Si en el corte hay más
 * empatadas que huecos, el azar decide entre esas.
 */
export function pickByePairIds(
  qualifiers: Array<{ pairId: string; points: number }>,
  byeCount: number,
  random: () => number,
): string[] {
  const needed = Math.min(Math.max(byeCount, 0), qualifiers.length)
  if (needed === 0) return []
  const ranked = [...qualifiers].sort((left, right) => right.points - left.points || left.pairId.localeCompare(right.pairId))
  const cutoff = ranked[needed - 1].points
  const locked = ranked.filter((row) => row.points > cutoff)
  const pool = ranked.filter((row) => row.points === cutoff)
  const taken = shuffle(pool, random).slice(0, needed - locked.length)
  return [...locked, ...taken].map((row) => row.pairId)
}

/** Orden de cabezas: primero quienes tienen pase, después el resto por puntos. */
export function orderQualifiersForKnockout(qualifiers: QualifierSeed[], random: () => number): string[] {
  const byeIds = new Set(pickByePairIds(qualifiers, byeCountFor(qualifiers.length), random))
  const byPoints = (left: QualifierSeed, right: QualifierSeed) => right.points - left.points || left.pairId.localeCompare(right.pairId)
  const heads = qualifiers.filter((row) => byeIds.has(row.pairId)).sort(byPoints)
  const rest = qualifiers.filter((row) => !byeIds.has(row.pairId)).sort(byPoints)
  return [...heads, ...rest].map((row) => row.pairId)
}

export function randomFrom(seed: string): () => number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return () => {
    hash += 0x6d2b79f5
    let next = hash
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
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
