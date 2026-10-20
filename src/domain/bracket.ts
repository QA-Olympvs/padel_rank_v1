import type { MatchSide } from './types.ts'

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
  return separateSameGroup(placed)
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
      if (next[index].kind === 'bye' && candidate.kind === 'bye') continue
      if (next[other - 1].kind === 'bye' && next[index + 1].kind === 'bye') continue
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
