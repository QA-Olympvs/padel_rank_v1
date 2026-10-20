import { useRef, useState } from 'react'
import { CalendarDays, Download, GitBranch, LayoutGrid, Plus, Repeat, Trash2, Upload, Users } from 'lucide-react'
import { ConfirmDelete } from '@/components/ConfirmDelete'
import { StatusBadge } from '@/components/StatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deserializeStore } from '@/domain/storage'
import { FORMAT_LABEL, PAIRING_LABEL, SCORING_LABEL, scoringOf, type Tournament } from '@/domain/types'

export function TournamentList({
  tournaments,
  onCreate,
  onOpen,
  onDelete,
  onExportAll,
  onExportOne,
  onImport,
}: {
  tournaments: Tournament[]
  onCreate: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onExportAll: () => void
  onExportOne: (tournament: Tournament) => void
  onImport: (raw: string, mode: 'merge' | 'replace') => string | null
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<{ raw: string; count: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importStep, setImportStep] = useState<'choose' | 'replace' | null>(null)

  async function readFile(file: File | undefined) {
    if (!file) return
    const raw = await file.text()
    const parsed = deserializeStore(raw)
    if (!parsed) {
      setError('El archivo no contiene torneos válidos.')
      setPendingFile(null)
      return
    }
    setError(null)
    setPendingFile({ raw, count: parsed.length })
    setImportStep('choose')
  }

  function closeImport() {
    setPendingFile(null)
    setImportStep(null)
  }

  function importFile(mode: 'merge' | 'replace') {
    if (!pendingFile) return
    const message = onImport(pendingFile.raw, mode)
    if (message) setError(message)
    closeImport()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            Torneos
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Crea el cuadro, anota los resultados y consulta la clasificación. Todo queda guardado en este navegador.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onExportAll} disabled={tournaments.length === 0}>
            <Download />
            Exportar
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload />
            Importar
          </Button>
          <Button onClick={onCreate}>
            <Plus />
            Nuevo torneo
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              void readFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {tournaments.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Todavía no hay torneos</CardTitle>
            <CardDescription>
              Empieza por el nombre, el formato y las canchas. Después registras a los jugadores.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={onCreate}>Crear el primero</Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tournaments.map((tournament) => (
            <Card key={tournament.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FormatIcon format={tournament.config.format} />
                  {tournament.config.name}
                </CardTitle>
                <CardDescription>
                  {FORMAT_LABEL[tournament.config.format]} · {PAIRING_LABEL[tournament.config.pairingMode]} · {SCORING_LABEL[scoringOf(tournament.config).scoringMode]}
                </CardDescription>
                <CardAction>
                  <StatusBadge tournament={tournament} />
                </CardAction>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  {tournament.config.pairCount} parejas · {tournament.config.courtCount} {tournament.config.courtCount === 1 ? 'cancha' : 'canchas'}
                </span>
                <span className="mt-1 flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" />
                  Actualizado {formatWhen(tournament.updatedAt)}
                </span>
              </CardContent>
              <CardFooter className="flex-wrap gap-2">
                <Button onClick={() => onOpen(tournament.id)}>Abrir</Button>
                <Button variant="outline" onClick={() => onExportOne(tournament)}>
                  <Download />
                  JSON
                </Button>
                <ConfirmDelete
                  title="Eliminar torneo"
                  description={`Se borrará «${tournament.config.name}» de este navegador. Esta acción no se puede deshacer.`}
                  trigger={<Button variant="destructive" size="icon" aria-label={`Eliminar ${tournament.config.name}`}><Trash2 /></Button>}
                  onConfirm={() => onDelete(tournament.id)}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={importStep !== null} onOpenChange={(open) => { if (!open) closeImport() }}>
        <DialogContent>
          {importStep === 'replace' ? (
            <>
              <DialogHeader>
                <DialogTitle>Reemplazar los torneos actuales</DialogTitle>
                <DialogDescription>
                  Se sustituirá toda la lista de este navegador por el contenido del archivo. Exporta una copia antes si quieres conservarla.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportStep('choose')}>Volver</Button>
                <Button variant="destructive" onClick={() => importFile('replace')}>Reemplazar</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Importar torneos</DialogTitle>
                <DialogDescription>
                  El archivo tiene {pendingFile?.count ?? 0} {pendingFile?.count === 1 ? 'torneo' : 'torneos'}. Puedes añadirlos a la lista o sustituir los que hay ahora.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportStep('replace')}>Reemplazar todo</Button>
                <Button onClick={() => importFile('merge')}>Añadir a la lista</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FormatIcon({ format }: { format: Tournament['config']['format'] }) {
  const Icon = format === 'elimination' ? GitBranch : format === 'groups_knockout' ? LayoutGrid : Repeat
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
      <Icon className="size-4" />
    </span>
  )
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
}
