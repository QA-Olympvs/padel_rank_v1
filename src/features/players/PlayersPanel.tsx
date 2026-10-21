import { useState } from 'react'
import { Shuffle, Trash2, UserPlus } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  addManualPair,
  addPlayer,
  assignPairToGroup,
  autoFillGroups,
  drawRandomPairs,
  removePair,
  removePlayer,
  startTournament,
  type ActionResult,
} from '@/domain/actions'
import { groupAssignmentOf, planGroups, unassignedPairIds } from '@/domain/groups'
import { pairLabel } from '@/domain/present'
import { readinessError } from '@/domain/validate'
import type { Tournament } from '@/domain/types'

export function PlayersPanel({
  tournament,
  onSave,
}: {
  tournament: Tournament
  onSave: (result: ActionResult) => string | null
}) {
  const [name, setName] = useState('')
  const [firstId, setFirstId] = useState<string | null>(null)
  const [secondId, setSecondId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const locked = tournament.status !== 'draft'
  const pendingSetup = locked ? null : readinessError(tournament)
  const expected = tournament.config.pairCount * 2
  const used = new Set(tournament.pairs.flatMap((pair) => pair.playerIds))
  const available = tournament.players.filter((player) => !used.has(player.id))
  const secondOptions = available.filter((player) => player.id !== firstId)

  function apply(result: ActionResult, onOk?: () => void) {
    const message = onSave(result)
    setError(message)
    if (!message) onOk?.()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Jugadores</CardTitle>
          <CardDescription>
            {tournament.players.length} de {expected}. No se pueden repetir nombres.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!locked && (
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault()
                apply(addPlayer(tournament, name), () => setName(''))
              }}
            >
              <Input
                value={name}
                placeholder="Nombre y apellido"
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
              />
              <Button type="submit">
                <UserPlus />
                Añadir
              </Button>
            </form>
          )}
          {tournament.players.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay jugadores.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {tournament.players.map((player) => (
                <li key={player.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>{player.name}</span>
                  {!locked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar a ${player.name}`}
                      onClick={() => apply(removePlayer(tournament, player.id))}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parejas</CardTitle>
          <CardDescription>
            {tournament.pairs.length} de {tournament.config.pairCount}.
            {tournament.config.pairingMode === 'manual'
              ? ' Elige dos jugadores libres para cada pareja.'
              : groupAssignmentOf(tournament) === 'auto' && tournament.config.format === 'groups_knockout'
                ? ' El sorteo usa el orden para los grupos y los pases.'
                : ' El sorteo forma las parejas al azar.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!locked && tournament.config.pairingMode === 'manual' && (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <PlayerSelect
                placeholder="Jugador 1"
                players={available}
                value={firstId}
                onChange={setFirstId}
              />
              <PlayerSelect
                placeholder="Jugador 2"
                players={secondOptions}
                value={secondId}
                onChange={setSecondId}
              />
              <Button
                type="button"
                onClick={() => apply(addManualPair(tournament, firstId ?? '', secondId ?? ''), () => {
                  setFirstId(null)
                  setSecondId(null)
                })}
              >
                Formar pareja
              </Button>
            </div>
          )}

          {!locked && tournament.config.pairingMode === 'random' && (
            <Button type="button" variant="secondary" onClick={() => apply(drawRandomPairs(tournament))}>
              <Shuffle />
              {tournament.pairs.length > 0 ? 'Volver a sortear' : 'Sortear parejas'}
            </Button>
          )}

          {tournament.pairs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Las parejas aparecerán aquí antes de iniciar.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {tournament.pairs.map((pair, index) => (
                <li key={pair.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <span>
                    <span className="mr-2 text-xs font-medium text-muted-foreground">Pareja {index + 1}</span>
                    {pairLabel(tournament, pair.id)}
                  </span>
                  {!locked && tournament.config.pairingMode === 'manual' && (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar pareja ${index + 1}`} onClick={() => apply(removePair(tournament, pair.id))}>
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {!locked && tournament.config.format === 'groups_knockout' && groupAssignmentOf(tournament) === 'manual' && (
        <GroupsDraftCard tournament={tournament} apply={apply} />
      )}

      {tournament.groupBalanceNote && <Alert><AlertDescription>{tournament.groupBalanceNote}</AlertDescription></Alert>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {!locked && (
        <div className="flex justify-end">
          <Button size="lg" onClick={() => apply(startTournament(tournament))}>
            Iniciar torneo
          </Button>
        </div>
      )}
      {!locked && !error && pendingSetup && (
        <p className="text-right text-sm text-muted-foreground">{pendingSetup}</p>
      )}
    </div>
  )
}

const UNASSIGNED = '__none__'

function GroupsDraftCard({
  tournament,
  apply,
}: {
  tournament: Tournament
  apply: (result: ActionResult) => void
}) {
  const pending = unassignedPairIds(tournament)
  const plan = planGroups(tournament.config.pairCount, tournament.config.groupSize, tournament.config.qualifiersPerGroup)
  const caps = plan.sizes

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grupos</CardTitle>
        <CardDescription>
          {pending.length === 0
            ? 'Cada pareja ya tiene grupo. Puedes moverlas o volver a repartir.'
            : `Faltan ${pending.length} ${pending.length === 1 ? 'pareja' : 'parejas'} por asignar.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button type="button" variant="secondary" onClick={() => apply(autoFillGroups(tournament))}>
          <Shuffle />
          Repartir en grupos
        </Button>
        {tournament.pairs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Forma las parejas y luego asígnalas a cada grupo.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tournament.pairs.map((pair, index) => {
              const current = tournament.groups.find((group) => group.pairIds.includes(pair.id))
              return (
                <li key={pair.id} className="grid gap-2 rounded-lg border px-3 py-2 sm:grid-cols-[1fr_12rem] sm:items-center">
                  <span>
                    <span className="mr-2 text-xs font-medium text-muted-foreground">Pareja {index + 1}</span>
                    {pairLabel(tournament, pair.id)}
                  </span>
                  <Select
                    value={current?.id ?? UNASSIGNED}
                    items={[
                      { value: UNASSIGNED, label: 'Sin grupo' },
                      ...tournament.groups.map((group, groupIndex) => ({
                        value: group.id,
                        label: `${group.name} (${group.pairIds.length}/${caps[groupIndex] || tournament.config.groupSize})`,
                      })),
                    ]}
                    onValueChange={(value) => apply(assignPairToGroup(tournament, pair.id, value === UNASSIGNED ? null : value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sin grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Sin grupo</SelectItem>
                      {tournament.groups.map((group, groupIndex) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name} ({group.pairIds.length}/{caps[groupIndex] || tournament.config.groupSize})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function PlayerSelect({
  players,
  value,
  placeholder,
  onChange,
}: {
  players: Array<{ id: string; name: string }>
  value: string | null
  placeholder: string
  onChange: (value: string | null) => void
}) {
  return (
    <Select
      value={value}
      items={players.map((player) => ({ value: player.id, label: player.name }))}
      onValueChange={(next) => onChange(next)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {players.map((player) => (
          <SelectItem key={player.id} value={player.id}>
            {player.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
