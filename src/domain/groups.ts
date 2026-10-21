import { createId } from './ids.ts'
import { LIMITS, type Group, type Tournament } from './types.ts'

export interface GroupPlan {
  sizes: number[]
  note: string | null
  error: string | null
}

/**
 * Reparte las parejas en grupos lo más cercanos posible al tamaño pedido.
 * Si el resto dejaría un grupo de una sola pareja, se reequilibra.
 */
export function planGroups(pairCount: number, preferredSize: number, qualifiersPerGroup: number): GroupPlan {
  if (!Number.isInteger(preferredSize) || preferredSize < LIMITS.minGroupSize || preferredSize > LIMITS.maxGroupSize) {
    return { sizes: [], note: null, error: `Cada grupo debe tener entre ${LIMITS.minGroupSize} y ${LIMITS.maxGroupSize} parejas.` }
  }
  if (!Number.isInteger(qualifiersPerGroup) || qualifiersPerGroup < 1) {
    return { sizes: [], note: null, error: 'Debe clasificar al menos una pareja por grupo.' }
  }
  if (!Number.isInteger(pairCount) || pairCount < LIMITS.minPairs) {
    return { sizes: [], note: null, error: `Hacen falta al menos ${LIMITS.minPairs} parejas.` }
  }

  let groupCount = Math.max(1, Math.ceil(pairCount / preferredSize))
  while (groupCount > 1 && Math.floor(pairCount / groupCount) < 2) {
    groupCount -= 1
  }

  const base = Math.floor(pairCount / groupCount)
  const extra = pairCount % groupCount
  const sizes = Array.from({ length: groupCount }, (_, index) => base + (index < extra ? 1 : 0))
  const smallest = Math.min(...sizes)

  if (qualifiersPerGroup >= smallest) {
    return {
      sizes,
      note: null,
      error: `Con ${pairCount} parejas, el grupo más pequeño tiene ${smallest}. Las que clasifican por grupo tienen que ser menos de ${smallest}.`,
    }
  }

  const totalQualifiers = groupCount * qualifiersPerGroup
  if (totalQualifiers < 2) {
    return { sizes, note: null, error: 'Entre todos los grupos deben clasificar al menos 2 parejas.' }
  }

  const exact = sizes.every((size) => size === preferredSize)
  const note = exact
    ? null
    : `No caben grupos exactos de ${preferredSize}. Se formarán ${describeSizes(sizes)}.`

  return { sizes, note, error: null }
}

export function describeGroupPlan(plan: GroupPlan, qualifiersPerGroup: number): string | null {
  if (plan.error || plan.sizes.length === 0) return null
  const total = plan.sizes.length * qualifiersPerGroup
  return `${describeSizes(plan.sizes)}. Clasifican ${qualifiersPerGroup} por grupo (${total} en total) y después juegan eliminación directa.`
}

export function groupName(index: number): string {
  return `Grupo ${String.fromCharCode(65 + index)}`
}

export function groupAssignmentOf(tournament: Tournament): 'auto' | 'manual' {
  return tournament.config.groupAssignment === 'manual' ? 'manual' : 'auto'
}

export function fillGroupsFromPairs(pairs: Array<{ id: string }>, sizes: number[], existing: Group[] = []): Group[] {
  let cursor = 0
  return sizes.map((size, index) => {
    const pairIds = pairs.slice(cursor, cursor + size).map((pair) => pair.id)
    cursor += size
    return {
      id: existing[index]?.id ?? createId(),
      name: groupName(index),
      pairIds,
    }
  })
}

export function syncDraftGroups(tournament: Tournament): Group[] {
  if (tournament.config.format !== 'groups_knockout' || groupAssignmentOf(tournament) !== 'manual') return []
  const plan = planGroups(tournament.config.pairCount, tournament.config.groupSize, tournament.config.qualifiersPerGroup)
  if (plan.error || plan.sizes.length === 0) return []
  const valid = new Set(tournament.pairs.map((pair) => pair.id))
  return plan.sizes.map((size, index) => {
    const previous = tournament.groups[index]
    const pairIds = (previous?.pairIds ?? []).filter((id) => valid.has(id)).slice(0, size)
    return {
      id: previous?.id ?? createId(),
      name: groupName(index),
      pairIds,
    }
  })
}

export function unassignedPairIds(tournament: Tournament): string[] {
  const used = new Set(tournament.groups.flatMap((group) => group.pairIds))
  return tournament.pairs.map((pair) => pair.id).filter((id) => !used.has(id))
}

function describeSizes(sizes: number[]): string {
  const counts = new Map<number, number>()
  for (const size of sizes) counts.set(size, (counts.get(size) ?? 0) + 1)
  return [...counts.entries()]
    .map(([size, count]) => (count === 1 ? `1 grupo de ${size}` : `${count} grupos de ${size}`))
    .join(' y ')
}
