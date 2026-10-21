import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { describeGroupPlan, planGroups } from '@/domain/groups'
import { configError } from '@/domain/validate'
import {
  FORMAT_LABEL,
  GROUP_ASSIGNMENT_LABEL,
  LIMITS,
  PAIRING_LABEL,
  SCORING_LABEL,
  type CompetitionFormat,
  type GroupAssignment,
  type PairingMode,
  type ScoringMode,
  type TournamentConfig,
} from '@/domain/types'

interface Draft {
  name: string
  format: CompetitionFormat
  pairCount: string
  courtCount: string
  pairingMode: PairingMode
  groupAssignment: GroupAssignment
  groupSize: string
  qualifiersPerGroup: string
  scoringMode: ScoringMode
  pointsPerWin: string
  setsToPlay: string
}

const formats: Array<{ value: CompetitionFormat; label: string; hint: string }> = [
  { value: 'round_robin', label: FORMAT_LABEL.round_robin, hint: 'Todas las parejas juegan entre sí.' },
  { value: 'elimination', label: FORMAT_LABEL.elimination, hint: 'El ganador pasa de ronda. Si sobran huecos, hay pases automáticos.' },
  { value: 'groups_knockout', label: FORMAT_LABEL.groups_knockout, hint: 'Liguilla por grupos y después cuadro eliminatorio.' },
]

export function TournamentForm({
  initial,
  locked,
  submitLabel,
  onSubmit,
}: {
  initial: TournamentConfig
  locked: boolean
  submitLabel: string
  onSubmit: (config: TournamentConfig) => string | null
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    name: initial.name,
    format: initial.format,
    pairCount: String(initial.pairCount),
    courtCount: String(initial.courtCount),
    pairingMode: initial.pairingMode,
    groupAssignment: initial.groupAssignment ?? 'auto',
    groupSize: String(initial.groupSize),
    qualifiersPerGroup: String(initial.qualifiersPerGroup),
    scoringMode: initial.scoringMode ?? 'match_points',
    pointsPerWin: String(initial.pointsPerWin ?? 2),
    setsToPlay: String(initial.setsToPlay ?? 6),
  }))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const plan = draft.format === 'groups_knockout' ? livePlan(draft) : null

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setSaved(false)
    setError(null)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = readConfig(draft)
    if (!parsed.ok) {
      setError(parsed.error)
      setSaved(false)
      return
    }
    const message = onSubmit(parsed.config)
    setError(message)
    setSaved(message === null)
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <Field label="Nombre del torneo" htmlFor="tournament-name">
        <Input
          id="tournament-name"
          value={draft.name}
          maxLength={LIMITS.name}
          placeholder="Ej. Americano de viernes"
          onChange={(event) => update('name', event.target.value)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Formato" hint={formats.find((item) => item.value === draft.format)?.hint}>
          <Select
            value={draft.format}
            items={formats}
            disabled={locked}
            onValueChange={(value) => {
              if (isFormat(value)) update('format', value)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {formats.map((format) => (
                <SelectItem key={format.value} value={format.value}>
                  {format.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Parejas" htmlFor="pair-count" hint={locked ? 'El número de parejas queda fijo al iniciar.' : `Entre ${LIMITS.minPairs} y ${LIMITS.maxPairs}.`}>
          <Input
            id="pair-count"
            inputMode="numeric"
            disabled={locked}
            value={draft.pairCount}
            onChange={(event) => update('pairCount', event.target.value)}
          />
        </Field>

        <Field label="Canchas" htmlFor="court-count" hint="Los partidos del mismo turno se juegan a la vez, cada uno en una cancha.">
          <Input
            id="court-count"
            inputMode="numeric"
            value={draft.courtCount}
            onChange={(event) => update('courtCount', event.target.value)}
          />
        </Field>

        <Field label="Formación de parejas" hint={draft.pairingMode === 'manual' ? 'Tú eliges qué dos jugadores van juntos.' : 'Se sortean al registrar a todos los jugadores.'}>
          <Select
            value={draft.pairingMode}
            items={[
              { value: 'manual', label: PAIRING_LABEL.manual },
              { value: 'random', label: PAIRING_LABEL.random },
            ]}
            disabled={locked}
            onValueChange={(value) => {
              if (value === 'manual' || value === 'random') update('pairingMode', value)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">{PAIRING_LABEL.manual}</SelectItem>
              <SelectItem value="random">{PAIRING_LABEL.random}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 rounded-xl bg-muted/60 p-4 sm:grid-cols-2">
        <Field
          label="Puntuación"
          hint={draft.scoringMode === 'sets_won'
            ? 'En grupos cada set ganado suma un punto (suma de 6). En el cuadro gana quien llega primero a esos sets.'
            : 'El ganador del partido suma los puntos que indiques.'}
        >
          <Select
            value={draft.scoringMode}
            items={[
              { value: 'match_points', label: SCORING_LABEL.match_points },
              { value: 'sets_won', label: SCORING_LABEL.sets_won },
            ]}
            disabled={locked}
            onValueChange={(value) => {
              if (isScoring(value)) update('scoringMode', value)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="match_points">{SCORING_LABEL.match_points}</SelectItem>
              <SelectItem value="sets_won">{SCORING_LABEL.sets_won}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {draft.scoringMode === 'match_points' ? (
          <Field label="Puntos por partido ganado" htmlFor="points-per-win" hint="Lo habitual es 2 o 3.">
            <Input
              id="points-per-win"
              inputMode="numeric"
              value={draft.pointsPerWin}
              onChange={(event) => update('pointsPerWin', event.target.value)}
            />
          </Field>
        ) : (
          <Field label="Sets por partido" htmlFor="sets-to-play" hint={locked ? 'Queda fijo al iniciar el torneo.' : 'En grupos se juegan todos. En octavos, cuartos y final, gana quien llega primero a esa cifra.'}>
            <Input
              id="sets-to-play"
              inputMode="numeric"
              disabled={locked}
              value={draft.setsToPlay}
              onChange={(event) => update('setsToPlay', event.target.value)}
            />
          </Field>
        )}
      </div>

      {draft.format === 'groups_knockout' && (
        <div className="grid gap-5 rounded-xl bg-muted/60 p-4 sm:grid-cols-2">
          <Field
            label="Asignación de grupos"
            hint={draft.groupAssignment === 'manual'
              ? 'Tú eliges qué parejas van a cada grupo antes de iniciar.'
              : 'Al iniciar se reparte por el orden de las parejas.'}
          >
            <Select
              value={draft.groupAssignment}
              items={[
                { value: 'auto', label: GROUP_ASSIGNMENT_LABEL.auto },
                { value: 'manual', label: GROUP_ASSIGNMENT_LABEL.manual },
              ]}
              disabled={locked}
              onValueChange={(value) => {
                if (value === 'auto' || value === 'manual') update('groupAssignment', value)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{GROUP_ASSIGNMENT_LABEL.auto}</SelectItem>
                <SelectItem value="manual">{GROUP_ASSIGNMENT_LABEL.manual}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Parejas por grupo" htmlFor="group-size" hint="Si no caben grupos exactos, se reparte la diferencia.">
            <Input
              id="group-size"
              inputMode="numeric"
              disabled={locked}
              value={draft.groupSize}
              onChange={(event) => update('groupSize', event.target.value)}
            />
          </Field>
          <Field label="Clasifican por grupo" htmlFor="qualifiers" hint="Pasan a cuartos, semifinales o final según el cupo.">
            <Input
              id="qualifiers"
              inputMode="numeric"
              disabled={locked}
              value={draft.qualifiersPerGroup}
              onChange={(event) => update('qualifiersPerGroup', event.target.value)}
            />
          </Field>
          {plan?.error && <p className="text-sm text-destructive sm:col-span-2">{plan.error}</p>}
          {plan && !plan.error && (
            <p className="text-sm text-muted-foreground sm:col-span-2">{describeGroupPlan(plan, Number(draft.qualifiersPerGroup))}</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && <p className="text-sm text-primary">Configuración guardada en este navegador.</p>}

      <div className="flex justify-end">
        <Button type="submit" size="lg">{submitLabel}</Button>
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function livePlan(draft: Draft) {
  const pairCount = readInteger(draft.pairCount)
  const groupSize = readInteger(draft.groupSize)
  const qualifiers = readInteger(draft.qualifiersPerGroup)
  if (pairCount === null || groupSize === null || qualifiers === null) return null
  return planGroups(pairCount, groupSize, qualifiers)
}

function readConfig(draft: Draft): { ok: true; config: TournamentConfig } | { ok: false; error: string } {
  const pairCount = readBounded(draft.pairCount, 'El número de parejas', LIMITS.minPairs, LIMITS.maxPairs)
  const courtCount = readBounded(draft.courtCount, 'El número de canchas', LIMITS.minCourts, LIMITS.maxCourts)
  const groupSize = readBounded(draft.groupSize, 'El tamaño del grupo', LIMITS.minGroupSize, LIMITS.maxGroupSize)
  const qualifiers = readBounded(draft.qualifiersPerGroup, 'Las parejas que clasifican', 1, LIMITS.maxGroupSize)
  const pointsPerWin = readBounded(draft.pointsPerWin, 'Los puntos por partido ganado', LIMITS.minPointsPerWin, LIMITS.maxPointsPerWin)
  const setsToPlay = readBounded(draft.setsToPlay, 'Los sets por partido', LIMITS.minSetsToPlay, LIMITS.maxSetsToPlay)
  const numbers = [pairCount, courtCount, groupSize, qualifiers, pointsPerWin, setsToPlay]
  const problem = numbers.find((item) => typeof item === 'string')
  if (typeof problem === 'string') return { ok: false, error: problem }
  if (
    typeof pairCount !== 'number'
    || typeof courtCount !== 'number'
    || typeof groupSize !== 'number'
    || typeof qualifiers !== 'number'
    || typeof pointsPerWin !== 'number'
    || typeof setsToPlay !== 'number'
  ) {
    return { ok: false, error: 'Revisa los números de la configuración.' }
  }

  const config: TournamentConfig = {
    name: draft.name,
    format: draft.format,
    pairCount,
    courtCount,
    pairingMode: draft.pairingMode,
    groupAssignment: draft.format === 'groups_knockout' ? draft.groupAssignment : 'auto',
    groupSize,
    qualifiersPerGroup: qualifiers,
    scoringMode: draft.scoringMode,
    pointsPerWin,
    setsToPlay,
  }
  const error = configError(config)
  if (error) return { ok: false, error }
  return { ok: true, config }
}

function readBounded(value: string, label: string, min: number, max: number): number | string {
  if (!/^\d+$/.test(value.trim())) return `${label} debe ser un número entero.`
  const number = Number(value)
  if (number < min || number > max) return `${label} debe estar entre ${min} y ${max}.`
  return number
}

function readInteger(value: string): number | null {
  return /^\d+$/.test(value.trim()) ? Number(value) : null
}

function isFormat(value: unknown): value is CompetitionFormat {
  return value === 'round_robin' || value === 'elimination' || value === 'groups_knockout'
}

function isScoring(value: unknown): value is ScoringMode {
  return value === 'match_points' || value === 'sets_won'
}
