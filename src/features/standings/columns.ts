import type { Tournament } from '@/domain/types'

export const matchPointColumns = [
  ['PJ', 'Partidos jugados'],
  ['PG', 'Partidos ganados'],
  ['PP', 'Partidos perdidos'],
  ['Pts', 'Puntos'],
  ['SF', 'Sets a favor'],
  ['SC', 'Sets en contra'],
  ['JF', 'Juegos a favor'],
  ['JC', 'Juegos en contra'],
] as const

export const setSumColumns = [
  ['PJ', 'Partidos jugados'],
  ['PG', 'Partidos ganados'],
  ['PP', 'Partidos perdidos'],
  ['Pts', 'Sets ganados'],
  ['SF', 'Sets a favor'],
  ['SC', 'Sets en contra'],
] as const

export type StandingsColumn = readonly [string, string]

export function columnsFor(tournament: Tournament): readonly StandingsColumn[] {
  return tournament.config.scoringMode === 'sets_won' ? setSumColumns : matchPointColumns
}
