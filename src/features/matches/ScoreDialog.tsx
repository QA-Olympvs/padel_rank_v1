import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { clearResult, recordResult, type ActionResult } from '@/domain/actions'
import { pairLabel, type MatchView } from '@/domain/present'
import { knockoutWouldChange } from '@/domain/resolve'
import { setCountMode, setsError, tallySets } from '@/domain/scores'
import { LIMITS, type SetScore, type Tournament } from '@/domain/types'

interface DraftSet {
  gamesA: string
  gamesB: string
}

export function ScoreDialog({
  tournament,
  match,
  open,
  onOpenChange,
  onSave,
}: {
  tournament: Tournament
  match: MatchView | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (result: ActionResult) => string | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {match && (
          <ScoreForm
            key={`${match.id}:${match.scoreLabel}:${match.phase}`}
            tournament={tournament}
            match={match}
            onClose={() => onOpenChange(false)}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ScoreForm({
  tournament,
  match,
  onClose,
  onSave,
}: {
  tournament: Tournament
  match: MatchView
  onClose: () => void
  onSave: (result: ActionResult) => string | null
}) {
  const countMode = setCountMode(tournament.config, match.phase)
  const [sets, setSets] = useState<DraftSet[]>(() => initialDraft(match, countMode !== null))
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const names = {
    a: match.sideA.pairId ? pairLabel(tournament, match.sideA.pairId) : match.sideA.label,
    b: match.sideB.pairId ? pairLabel(tournament, match.sideB.pairId) : match.sideB.label,
  }

  function updateSet(index: number, side: keyof DraftSet, value: string) {
    setConfirmReset(false)
    setSets((current) => current.map((set, setIndex) => (setIndex === index ? { ...set, [side]: value } : set)))
  }

  function erase() {
    const preview = clearResult(tournament, match.id)
    if (!preview.ok) {
      setError(preview.error)
      return
    }
    if (!confirmReset && knockoutWouldChange(tournament, preview.tournament)) {
      setConfirmReset(true)
      setError('Borrar este resultado también quita los cruces que dependían de él.')
      return
    }
    const message = onSave(preview)
    if (message) setError(message)
    else onClose()
  }

  function save() {
    const parsed = parseDraft(sets, tournament, match.phase)
    if (typeof parsed === 'string') {
      setError(parsed)
      return
    }
    const preview = recordResult(tournament, match.id, parsed)
    if (!preview.ok) {
      setError(preview.error)
      return
    }
    if (!confirmReset && knockoutWouldChange(tournament, preview.tournament)) {
      setConfirmReset(true)
      setError('Este cambio modifica quién llega al cuadro. Si continúas, se borran los cruces que ya no correspondan.')
      return
    }
    const message = onSave(preview)
    if (message) {
      setError(message)
      return
    }
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Resultado</DialogTitle>
        <DialogDescription>
          {match.groupName ? `${match.groupName} · ` : ''}{match.roundName}.{' '}
          {countMode === 'first_to'
            ? `Gana la primera pareja que llegue a ${tournament.config.setsToPlay} sets.`
            : countMode === 'sum'
              ? `Anota los sets que ganó cada pareja. Deben sumar ${tournament.config.setsToPlay}.`
              : 'Anota los juegos de cada set.'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {countMode ? (
          <SetsWonFields
            names={names}
            expected={tournament.config.setsToPlay}
            mode={countMode}
            gamesA={sets[0]?.gamesA ?? ''}
            gamesB={sets[0]?.gamesB ?? ''}
            onChange={(side, value) => updateSet(0, side, value)}
          />
        ) : (
          <MatchPointsFields
            names={names}
            sets={sets}
            onChange={updateSet}
            onAdd={() => setSets((current) => [...current, { gamesA: '', gamesB: '' }])}
            onRemove={() => setSets((current) => current.slice(0, -1))}
          />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        {match.status === 'finished' && (
          <Button type="button" variant="outline" onClick={erase}>
            {confirmReset ? 'Borrar y actualizar cuadro' : 'Borrar'}
          </Button>
        )}
        <Button type="button" onClick={save}>{confirmReset ? 'Guardar y actualizar cuadro' : 'Guardar'}</Button>
      </DialogFooter>
    </>
  )
}

function SetsWonFields({
  names,
  expected,
  mode,
  gamesA,
  gamesB,
  onChange,
}: {
  names: { a: string; b: string }
  expected: number
  mode: 'sum' | 'first_to'
  gamesA: string
  gamesB: string
  onChange: (side: keyof DraftSet, value: string) => void
}) {
  const a = /^\d+$/.test(gamesA.trim()) ? Number(gamesA) : null
  const b = /^\d+$/.test(gamesB.trim()) ? Number(gamesB) : null
  const ready = a !== null && b !== null
  const complete = mode === 'sum'
    ? ready && a + b === expected
    : ready && Math.max(a, b) === expected && Math.min(a, b) < expected

  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-muted/20 p-3">
      <p className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {mode === 'first_to' ? 'Sets ganados' : 'Suma de sets'}
      </p>
      <SetWonRow
        name={names.a}
        value={gamesA}
        leading={ready && ((mode === 'first_to' && a === expected) || (mode === 'sum' && complete && a > b))}
        onChange={(value) => onChange('gamesA', value)}
      />
      <p className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">frente a</p>
      <SetWonRow
        name={names.b}
        value={gamesB}
        leading={ready && ((mode === 'first_to' && b === expected) || (mode === 'sum' && complete && b > a))}
        onChange={(value) => onChange('gamesB', value)}
      />
      <p className={`text-center text-sm tabular-nums ${ready && !complete ? 'text-destructive' : 'text-muted-foreground'}`}>
        {hintForCount(mode, expected, a, b, complete)}
      </p>
    </div>
  )
}

function MatchPointsFields({
  names,
  sets,
  onChange,
  onAdd,
  onRemove,
}: {
  names: { a: string; b: string }
  sets: DraftSet[]
  onChange: (index: number, side: keyof DraftSet, value: string) => void
  onAdd: () => void
  onRemove: () => void
}) {
  const parsed = sets.map((set) => ({
    a: /^\d+$/.test(set.gamesA.trim()) ? Number(set.gamesA) : null,
    b: /^\d+$/.test(set.gamesB.trim()) ? Number(set.gamesB) : null,
  }))
  const complete = parsed.every((set) => set.a !== null && set.b !== null)
  const tally = complete
    ? tallySets(sets.map((set) => ({ gamesA: Number(set.gamesA), gamesB: Number(set.gamesB) })))
    : null

  return (
    <div className="flex flex-col gap-3">
      {sets.map((set, index) => {
        const a = parsed[index].a
        const b = parsed[index].b
        const ready = a !== null && b !== null
        const valid = ready && a !== b
        return (
          <div key={index} className="flex flex-col gap-2 rounded-2xl border bg-muted/20 p-3">
            <p className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Set {index + 1}
            </p>
            <SetWonRow
              name={names.a}
              value={set.gamesA}
              leading={valid && a > b}
              ariaLabel={`Juegos de ${names.a} en el set ${index + 1}`}
              onChange={(value) => onChange(index, 'gamesA', value)}
            />
            <p className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">frente a</p>
            <SetWonRow
              name={names.b}
              value={set.gamesB}
              leading={valid && b > a}
              ariaLabel={`Juegos de ${names.b} en el set ${index + 1}`}
              onChange={(value) => onChange(index, 'gamesB', value)}
            />
            <p className={`text-center text-sm tabular-nums ${ready && !valid ? 'text-destructive' : 'text-muted-foreground'}`}>
              {hintForSet(a, b)}
            </p>
          </div>
        )
      })}
      <p className="text-center text-sm text-muted-foreground">
        {tally?.valid
          ? `${tally.setsA}-${tally.setsB} · gana ${tally.setsA > tally.setsB ? names.a : names.b}`
          : 'Anota los juegos de cada set. Gana quien se lleva dos.'}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={sets.length >= LIMITS.maxSets}
          onClick={onAdd}
        >
          Añadir set
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex-1"
          disabled={sets.length <= 1}
          onClick={onRemove}
        >
          Quitar set
        </Button>
      </div>
    </div>
  )
}

function hintForSet(a: number | null, b: number | null): string {
  if (a === null || b === null) return 'Juegos de este set'
  if (a === b) return 'El set no puede quedar empatado'
  return `${Math.max(a, b)}-${Math.min(a, b)}`
}

function hintForCount(
  mode: 'sum' | 'first_to',
  expected: number,
  a: number | null,
  b: number | null,
  complete: boolean,
): string {
  if (mode === 'first_to') {
    if (a === null || b === null) return `Al primero que llegue a ${expected} sets`
    if (complete) return `${Math.max(a, b)}-${Math.min(a, b)} · gana quien llegó a ${expected}`
    return `Tiene que ganar una pareja ${expected} sets. Ahora van ${a}-${b}.`
  }
  if (a === null || b === null) return `Deben sumar ${expected} sets`
  if (complete) return `${a} + ${b} = ${expected}`
  return `${a} + ${b} = ${a + b} de ${expected}`
}

function SetWonRow({
  name,
  value,
  leading = false,
  ariaLabel,
  onChange,
}: {
  name: string
  value: string
  leading?: boolean
  ariaLabel?: string
  onChange: (value: string) => void
}) {
  return (
    <label className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${leading ? 'border-primary/40 bg-primary/5' : 'bg-muted/40'}`}>
      <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{name}</span>
      <Input
        inputMode="numeric"
        aria-label={ariaLabel ?? `Sets ganados por ${name}`}
        className="h-11 w-16 shrink-0 text-center text-lg tabular-nums"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function initialDraft(match: MatchView, setSum: boolean): DraftSet[] {
  if (setSum) {
    const first = match.sets[0]
    return [{ gamesA: first ? String(first.gamesA) : '', gamesB: first ? String(first.gamesB) : '' }]
  }
  if (match.sets.length > 0) {
    return match.sets.map((set) => ({ gamesA: String(set.gamesA), gamesB: String(set.gamesB) }))
  }
  return [{ gamesA: '', gamesB: '' }]
}

function parseDraft(sets: DraftSet[], tournament: Tournament, phase: MatchView['phase']): SetScore[] | string {
  const parsed: SetScore[] = []
  for (const [index, set] of sets.entries()) {
    if (!/^\d+$/.test(set.gamesA.trim()) || !/^\d+$/.test(set.gamesB.trim())) {
      return tournament.config.scoringMode === 'sets_won'
        ? 'Escribe los sets que ganó cada pareja.'
        : `Escribe los juegos del set ${index + 1}.`
    }
    parsed.push({ gamesA: Number(set.gamesA), gamesB: Number(set.gamesB) })
  }
  return setsError(parsed, tournament.config, phase) ?? parsed
}
