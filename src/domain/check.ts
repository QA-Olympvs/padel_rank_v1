import {
  addManualPair,
  addPlayer,
  clearResult,
  createTournament,
  drawRandomPairs,
  recordResult,
  startTournament,
} from './actions.ts'
import { presentBracket, presentMatches, presentTables } from './present.ts'
import { deserializeStore, serializeStore } from './storage.ts'
import { DEFAULT_SCORING, type SetScore, type Tournament, type TournamentConfig } from './types.ts'

const roundRobin: TournamentConfig = {
  name: 'Liga de prueba',
  format: 'round_robin',
  pairCount: 4,
  courtCount: 2,
  pairingMode: 'manual',
  groupSize: 4,
  qualifiersPerGroup: 2,
  ...DEFAULT_SCORING,
}

const started = start(roundRobin, [
  ['Ana', 'Luis'],
  ['Bea', 'Nora'],
  ['Cia', 'Otto'],
  ['Dina', 'Pau'],
])
const matches = presentMatches(started)
assert(matches.length === 6, `todos contra todos de 4 debe tener 6 partidos, tiene ${matches.length}`)
assert(new Set(matches.map((match) => match.wave)).size === 3, 'con 2 canchas hay 3 turnos')
assertNoWaveConflicts(started)
for (const pair of started.pairs) {
  const played = matches.filter((match) => match.sideA.pairId === pair.id || match.sideB.pairId === pair.id)
  assert(played.length === 3, 'cada pareja juega 3 partidos')
}

const odd = start({ ...roundRobin, name: 'Impar', pairCount: 3, courtCount: 1 }, [
  ['Ana', 'Luis'],
  ['Bea', 'Nora'],
  ['Cia', 'Otto'],
])
assert(presentMatches(odd).length === 3, 'con 3 parejas no se crea un partido de descanso')
assert(presentMatches(odd).every((match) => match.court === 1), 'una sola cancha se reutiliza en turnos distintos')

const scored = must(recordResult(started, matches[0].id, [{ gamesA: 6, gamesB: 4 }, { gamesA: 6, gamesB: 3 }]))
const table = presentTables(scored)[0]
assert(table.rows[0].points === 2, 'el ganador suma 2 puntos')
assert(table.rows[0].setsFor === 2, 'cuenta los sets a favor')
assert(table.rows.some((row) => row.points === 0 && row.played === 1), 'el perdedor queda con 0 puntos')

const threeStarted = start({ ...roundRobin, name: 'Tres puntos', pointsPerWin: 3 }, [
  ['Ana', 'Luis'],
  ['Bea', 'Nora'],
  ['Cia', 'Otto'],
  ['Dina', 'Pau'],
])
const threePoints = must(recordResult(threeStarted, presentMatches(threeStarted)[0].id, [{ gamesA: 6, gamesB: 4 }, { gamesA: 6, gamesB: 3 }]))
assert(presentTables(threePoints)[0].rows[0].points === 3, 'con 3 puntos por victoria el ganador suma 3')

const setSum = start({
  ...roundRobin,
  name: 'Suma de 6',
  scoringMode: 'sets_won',
  setsToPlay: 6,
}, [
  ['Ana', 'Luis'],
  ['Bea', 'Nora'],
  ['Cia', 'Otto'],
  ['Dina', 'Pau'],
])
const setMatch = presentMatches(setSum)[0]
assert(!recordResult(setSum, setMatch.id, [{ gamesA: 5, gamesB: 0 }]).ok, 'en suma de 6 los sets tienen que sumar 6')
const setScored = must(recordResult(setSum, setMatch.id, [{ gamesA: 4, gamesB: 2 }]))
const setTable = presentTables(setScored)[0]
const winnerRow = setTable.rows.find((row) => row.pairId === setMatch.sideA.pairId)
const loserRow = setTable.rows.find((row) => row.pairId === setMatch.sideB.pairId)
assert(winnerRow?.points === 4, `en suma de 6 el ganador suma 4 y fue ${winnerRow?.points}`)
assert(loserRow?.points === 2, 'el perdedor suma los 2 sets que ganó')
const setDraw = must(recordResult(setSum, setMatch.id, [{ gamesA: 3, gamesB: 3 }]))
const drawRows = presentTables(setDraw)[0].rows.filter((row) => row.played === 1)
assert(drawRows.length === 2 && drawRows.every((row) => row.points === 3), 'un 3-3 suma 3 puntos a cada pareja')
assert(presentMatches(setDraw).find((match) => match.id === setMatch.id)?.status === 'finished', 'un empate a sets cierra el partido de liguilla')

const knockoutSets = start({
  name: 'Cuadro a 6',
  format: 'elimination',
  pairCount: 2,
  courtCount: 1,
  pairingMode: 'manual',
  groupSize: 4,
  qualifiersPerGroup: 2,
  scoringMode: 'sets_won',
  pointsPerWin: 2,
  setsToPlay: 6,
}, [
  ['Ana', 'Luis'],
  ['Bea', 'Nora'],
])
const final = presentMatches(knockoutSets).find((match) => match.roundName === 'Final' && match.status === 'ready')
assert(final !== undefined, 'hay una final jugable')
assert(!recordResult(knockoutSets, final.id, [{ gamesA: 4, gamesB: 2 }]).ok, 'en el cuadro 4-2 no vale: nadie llegó a 6')
const finalWon = must(recordResult(knockoutSets, final.id, [{ gamesA: 6, gamesB: 4 }]))
assert(presentMatches(finalWon).find((match) => match.id === final.id)?.winnerId === final.sideA.pairId, 'quien llega a 6 gana el cruce')

const tie = scoreRoundRobin(start({ ...roundRobin, name: 'Empate', pairCount: 4, courtCount: 2 }, [
  ['Ana', 'Luis'],
  ['Bea', 'Nora'],
  ['Cia', 'Otto'],
  ['Dina', 'Pau'],
]), [
  [0, 1, [[6, 4], [6, 4]]],
  [0, 2, [[4, 6], [4, 6]]],
  [1, 2, [[6, 4], [6, 4]]],
  [2, 3, [[0, 6], [0, 6]]],
])
const tieTable = presentTables(tie)
const labels = tieTable[0].rows.map((row) => row.label)
assert(labels[0] === 'Dina / Pau', `la diferencia de sets pone primero a Dina / Pau y fue ${labels[0]}`)
assert(labels[1] === 'Ana / Luis', `el enfrentamiento directo pone a Ana / Luis por delante de Bea / Nora y fue ${labels[1]}`)
assert(labels[2] === 'Bea / Nora', `Bea / Nora queda tercera y fue ${labels[2]}`)
assert(tieTable[0].rows[1].tied === false, 'el enfrentamiento directo rompe el empate')

const bracket = start({
  name: 'Cuadro',
  format: 'elimination',
  pairCount: 5,
  courtCount: 2,
  pairingMode: 'manual',
  groupSize: 4,
  qualifiersPerGroup: 2,
  ...DEFAULT_SCORING,
}, [
  ['Ana', 'Luis'],
  ['Bea', 'Nora'],
  ['Cia', 'Otto'],
  ['Dina', 'Pau'],
  ['Eva', 'Raul'],
])
const rounds = presentBracket(bracket)
assert(rounds[0].name === 'Cuartos de final', rounds[0].name)
assert(rounds.at(-1)?.name === 'Final', 'el cuadro acaba en la final')
assert(presentMatches(bracket).filter((match) => match.status === 'bye').length === 3, '5 parejas dejan 3 pases')
assertNoWaveConflicts(bracket)

let current = bracket
const opening = presentMatches(current).find((match) => match.status === 'ready' && match.round === 1)
assert(opening !== undefined, 'hay un partido jugable en la primera ronda')
current = must(recordResult(current, opening.id, [{ gamesA: 6, gamesB: 2 }, { gamesA: 6, gamesB: 2 }]))
const winnerId = presentMatches(current).find((match) => match.id === opening.id)?.winnerId
const advanced = presentMatches(current).some((match) => match.round > opening.round && (
  match.sideA.pairId === winnerId || match.sideB.pairId === winnerId
))
assert(advanced, 'el ganador pasa a la siguiente ronda')

const groups = start({
  name: 'Grupos',
  format: 'groups_knockout',
  pairCount: 6,
  courtCount: 2,
  pairingMode: 'manual',
  groupSize: 3,
  qualifiersPerGroup: 2,
  ...DEFAULT_SCORING,
}, [
  ['Ana', 'Luis'],
  ['Bea', 'Nora'],
  ['Cia', 'Otto'],
  ['Dina', 'Pau'],
  ['Eva', 'Raul'],
  ['Fina', 'Teo'],
])
assert(groups.groups.length === 2, '6 parejas en grupos de 3 hacen 2 grupos')
assert(groups.groupBalanceNote === null, 'el reparto es exacto')
const groupTables = presentTables(groups)
assert(groupTables.length === 2, 'hay una tabla por grupo')
let grouped = groups
for (const match of presentMatches(grouped).filter((item) => item.phase === 'group')) {
  grouped = must(recordResult(grouped, match.id, [{ gamesA: 6, gamesB: 0 }, { gamesA: 6, gamesB: 0 }]))
}
const semis = presentMatches(grouped).filter((match) => match.roundName === 'Semifinales' && match.status === 'ready')
assert(semis.length === 2, `al cerrar los grupos hay 2 semifinales listas y hay ${semis.length}`)
assert(semis.every((match) => match.sideA.label.split(' / ')[0] !== '' ), 'las semifinales tienen parejas')
const sameGroup = semis.some((match) => {
  const groupA = groups.groups.find((group) => group.pairIds.includes(match.sideA.pairId ?? ''))
  const groupB = groups.groups.find((group) => group.pairIds.includes(match.sideB.pairId ?? ''))
  return groupA?.id === groupB?.id
})
assert(!sameGroup, 'las semifinales cruzan parejas de grupos distintos')

const playoffConfig: TournamentConfig = {
  name: 'Desempate de grupo',
  format: 'groups_knockout',
  pairCount: 4,
  courtCount: 2,
  pairingMode: 'manual',
  groupSize: 4,
  qualifiersPerGroup: 2,
  scoringMode: 'sets_won',
  pointsPerWin: 2,
  setsToPlay: 6,
}
const waitingPlayoff = scoreRoundRobin(start(playoffConfig, [
  ['Ana', 'Luis'],
  ['Bea', 'Nora'],
  ['Cia', 'Otto'],
  ['Dina', 'Pau'],
]), [
  [0, 1, [[4, 2]]],
  [0, 2, [[4, 2]]],
  [0, 3, [[5, 1]]],
  [1, 2, [[3, 3]]],
  [1, 3, [[4, 2]]],
  [2, 3, [[4, 2]]],
])
const playoffTable = presentTables(waitingPlayoff)[0]
assert(playoffTable.playoffPending, 'si dos pelean el último cupo se crea un desempate')
assert(playoffTable.rows[0].qualified && !playoffTable.rows[0].tied, 'quien va primera clasifica aunque otras estén empatadas')
assert(playoffTable.rows[1].tied && !playoffTable.rows[1].qualified, 'el empate del cupo muestra Empate y no Clasifica')
assert(playoffTable.rows[2].tied && !playoffTable.rows[2].qualified, 'la otra pareja del cupo también está empatada')
assert(!playoffTable.rows[3].tied && !playoffTable.rows[3].qualified, 'quien ya está fuera no lleva badge de empate')
const extra = presentMatches(waitingPlayoff).find((match) => match.phase === 'playoff')
assert(extra !== undefined && extra.status === 'ready', 'el desempate se puede jugar')
assert(!presentMatches(waitingPlayoff).some((match) => match.roundName === 'Final' && match.status === 'ready'), 'el cuadro espera al desempate')
assert(!recordResult(waitingPlayoff, extra.id, [{ gamesA: 3, gamesB: 3 }]).ok, 'el desempate no admite un 3-3')
const afterPlayoff = must(recordResult(waitingPlayoff, extra.id, [{ gamesA: 6, gamesB: 4 }]))
const decidedTable = presentTables(afterPlayoff)[0]
assert(!decidedTable.playoffPending, 'al jugar el desempate se cierra el grupo')
assert(decidedTable.rows[1].qualified && !decidedTable.rows[1].tied, 'la ganadora del desempate clasifica')
assert(!decidedTable.rows[2].qualified && !decidedTable.rows[2].tied, 'la perdedora se queda fuera')
const finalAfterPlayoff = presentMatches(afterPlayoff).find((match) => match.roundName === 'Final' && match.status === 'ready')
assert(finalAfterPlayoff !== undefined, 'la ganadora del desempate pasa al cuadro')
assert(
  finalAfterPlayoff.sideA.pairId === decidedTable.rows[0].pairId
    || finalAfterPlayoff.sideB.pairId === decidedTable.rows[0].pairId,
  'la primera del grupo está en la final',
)
assert(
  finalAfterPlayoff.sideA.pairId === decidedTable.rows[1].pairId
    || finalAfterPlayoff.sideB.pairId === decidedTable.rows[1].pairId,
  'quien ganó el desempate está en la final',
)

const bothQualify = scoreRoundRobin(start({ ...playoffConfig, name: 'Las dos clasifican' }, [
  ['Ana', 'Luis'],
  ['Bea', 'Nora'],
  ['Cia', 'Otto'],
  ['Dina', 'Pau'],
]), [
  [0, 1, [[3, 3]]],
  [0, 2, [[5, 1]]],
  [0, 3, [[5, 1]]],
  [1, 2, [[5, 1]]],
  [1, 3, [[5, 1]]],
  [2, 3, [[3, 3]]],
])
const bothTable = presentTables(bothQualify)[0]
assert(!presentMatches(bothQualify).some((match) => match.phase === 'playoff'), 'si las dos empatadas ya tienen cupo no hay desempate')
assert(bothTable.rows[0].qualified && !bothTable.rows[0].tied, 'dos clasificadas empatadas no muestran Empate')
assert(bothTable.rows[1].qualified && !bothTable.rows[1].tied, 'la otra clasificada tampoco muestra Empate')
assert(!bothTable.rows[2].tied && !bothTable.rows[3].tied, 'un empate fuera de los cupos no muestra badge')

const samePoints = scoreRoundRobin(start({ ...playoffConfig, name: 'Empate a puntos' }, [
  ['Ana', 'Luis'],
  ['Bea', 'Nora'],
  ['Cia', 'Otto'],
  ['Dina', 'Pau'],
]), [
  [0, 1, [[5, 1]]],
  [0, 2, [[4, 2]]],
  [0, 3, [[5, 1]]],
  [1, 2, [[4, 2]]],
  [1, 3, [[4, 2]]],
  [2, 3, [[5, 1]]],
])
const samePointsTable = presentTables(samePoints)[0]
assert(samePointsTable.playoffPending, 'con empate a puntos por el cupo hay desempate aunque el H2H ya tenga ganador')
assert(samePointsTable.rows[0].qualified, 'quien tiene más puntos que el cupo sigue con Clasifica')
assert(presentMatches(samePoints).some((match) => match.phase === 'playoff' && match.status === 'ready'), 'el desempate aparece en partidos')

const playedFinal = must(recordResult(grouped, semis[0].id, [{ gamesA: 6, gamesB: 4 }, { gamesA: 7, gamesB: 5 }]))
const reopened = must(clearResult(playedFinal, presentMatches(groups).find((match) => match.phase === 'group')!.id))
assert(
  presentMatches(reopened).find((match) => match.id === semis[0].id)?.status !== 'finished',
  'si se reabre un grupo se borra el cruce que ya no está definido',
)

const uneven = start({
  name: 'Desigual',
  format: 'groups_knockout',
  pairCount: 10,
  courtCount: 3,
  pairingMode: 'random',
  groupSize: 4,
  qualifiersPerGroup: 2,
  ...DEFAULT_SCORING,
}, null, sequence(20))
assert(uneven.groupBalanceNote !== null, 'avisa cuando los grupos no son exactos')
assert(uneven.groups.reduce((sum, group) => sum + group.pairIds.length, 0) === 10, 'no se pierde ninguna pareja')
assert(Math.min(...uneven.groups.map((group) => group.pairIds.length)) > 2, 'ningún grupo clasifica a todas sus parejas')
assertNoWaveConflicts(uneven)

const duplicate = addPlayer(must(createTournament(roundRobin)), 'Ana')
const repeated = addPlayer(must(duplicate), ' ana ')
assert(!repeated.ok, 'rechaza jugadores duplicados')

const badGroups = createTournament({
  name: 'Mal',
  format: 'groups_knockout',
  pairCount: 5,
  courtCount: 1,
  pairingMode: 'manual',
  groupSize: 4,
  qualifiersPerGroup: 2,
  ...DEFAULT_SCORING,
})
assert(!badGroups.ok, 'rechaza clasificados de más para el grupo pequeño')

const restored = deserializeStore(serializeStore([scored]))
assert(restored?.length === 1, 'el JSON conserva el torneo')
assert(restored?.[0].matches.some((match) => match.sets.length === 2), 'el JSON conserva los resultados')
assert(deserializeStore('{') === null, 'un archivo roto no se importa')

console.log('Dominio de torneos verificado.')

function start(config: TournamentConfig, manual: Array<[string, string]> | null, names?: string[]): Tournament {
  let tournament = must(createTournament(config))
  const roster = names ?? manual?.flat() ?? []
  for (const name of roster) tournament = must(addPlayer(tournament, name))
  if (manual) {
    for (const [first, second] of manual) {
      const firstId = tournament.players.find((player) => player.name === first)?.id ?? ''
      const secondId = tournament.players.find((player) => player.name === second)?.id ?? ''
      tournament = must(addManualPair(tournament, firstId, secondId))
    }
  } else {
    tournament = must(drawRandomPairs(tournament, () => 0.1))
  }
  return must(startTournament(tournament))
}

function scoreRoundRobin(tournament: Tournament, results: Array<[number, number, number[][]]>): Tournament {
  let current = tournament
  for (const [left, right, sets] of results) {
    const pairA = current.pairs[left].id
    const pairB = current.pairs[right].id
    const match = current.matches.find((item) => {
      if (item.sideA.kind !== 'pair' || item.sideB.kind !== 'pair') return false
      const ids = [item.sideA.pairId, item.sideB.pairId]
      return ids.includes(pairA) && ids.includes(pairB)
    })
    if (!match || match.sideA.kind !== 'pair' || match.sideB.kind !== 'pair') throw new Error('partido no encontrado')
    const ordered: SetScore[] = sets.map(([gamesHome, gamesAway]) => match.sideA.kind === 'pair' && match.sideA.pairId === pairA
      ? { gamesA: gamesHome, gamesB: gamesAway }
      : { gamesA: gamesAway, gamesB: gamesHome })
    current = must(recordResult(current, match.id, ordered))
  }
  return current
}

function assertNoWaveConflicts(tournament: Tournament) {
  const views = presentMatches(tournament).filter((match) => match.wave > 0)
  const byWave = new Map<number, typeof views>()
  for (const match of views) {
    const wave = byWave.get(match.wave) ?? []
    wave.push(match)
    byWave.set(match.wave, wave)
  }
  for (const [wave, waveMatches] of byWave) {
    assert(waveMatches.length <= tournament.config.courtCount, `el turno ${wave} supera las canchas`)
    const courts = waveMatches.map((match) => match.court)
    assert(new Set(courts).size === courts.length, `cancha repetida en el turno ${wave}`)
    const pairs = waveMatches.flatMap((match) => [match.sideA.pairId, match.sideB.pairId].filter((id): id is string => id !== null))
    assert(new Set(pairs).size === pairs.length, `pareja repetida en el turno ${wave}`)
  }
}

function sequence(length: number): string[] {
  return Array.from({ length }, (_, index) => `Jugador ${index + 1}`)
}

function must(result: { ok: true; tournament: Tournament } | { ok: false; error: string }): Tournament {
  if (!result.ok) throw new Error(result.error)
  return result.tournament
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
