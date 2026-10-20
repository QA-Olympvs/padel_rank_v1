import { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  CircleCheck,
  Equal,
  FilePenLine,
  GitBranch,
  LayoutList,
  Maximize2,
  Medal,
  Pause,
  Play,
  Radio,
  TriangleAlert,
  Trophy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { completionLabel, presentBracket, presentTables, type TableView } from '@/domain/present'
import type { Tournament } from '@/domain/types'
import { TournamentBracket } from '@/features/bracket/TournamentBracket'
import { columnsFor } from '@/features/standings/columns'
import { useTournaments } from '@/hooks/useTournaments'
import { cn } from '@/lib/utils'

const ROTATE_MS = 6_000
const ROWS_PER_SLIDE = 10

type Slide =
  | { kind: 'table'; key: string; title: string; table: TableView; rows: TableView['rows']; pageLabel: string | null }
  | { kind: 'bracket'; key: string; title: string }

export function BoardScreen({ tournamentId }: { tournamentId: string }) {
  const { tournaments } = useTournaments()
  const tournament = tournaments.find((item) => item.id === tournamentId)
  const slides = useMemo(() => tournament ? buildSlides(tournament) : [], [tournament])
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [paused, setPaused] = useState(false)
  const [controls, setControls] = useState(true)

  useEffect(() => {
    setIndex((current) => slides.length === 0 ? 0 : current % slides.length)
  }, [slides.length])

  function goTo(nextIndex: number, dir?: 1 | -1) {
    if (slides.length === 0) return
    const target = ((nextIndex % slides.length) + slides.length) % slides.length
    setDirection(dir ?? slideDirection(index, target, slides.length))
    setIndex(target)
  }

  useEffect(() => {
    if (paused || slides.length <= 1) return
    const tick = window.setInterval(() => {
      setDirection(1)
      setIndex((current) => (current + 1) % slides.length)
    }, ROTATE_MS)
    return () => window.clearInterval(tick)
  }, [paused, slides.length, index])

  useEffect(() => {
    let hide = window.setTimeout(() => setControls(false), 2800)
    function wake() {
      setControls(true)
      window.clearTimeout(hide)
      hide = window.setTimeout(() => setControls(false), 2800)
    }
    function onKey(event: KeyboardEvent) {
      wake()
      if (event.key === 'ArrowRight') goTo(index + 1, 1)
      if (event.key === 'ArrowLeft') goTo(index - 1, -1)
      if (event.key === ' ') {
        event.preventDefault()
        setPaused((value) => !value)
      }
      if (event.key === 'f' || event.key === 'F') void toggleFullscreen()
    }
    window.addEventListener('mousemove', wake)
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(hide)
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('keydown', onKey)
    }
  }, [slides.length, index])

  if (!tournament) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-8 text-center">
        <p className="text-2xl text-muted-foreground">Este torneo no está en este navegador.</p>
      </div>
    )
  }

  const slide = slides[index]
  const status = completionLabel(tournament)
  const live = status === 'En curso'

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_0%_0%,oklch(0.95_0.03_155/0.55),transparent_50%),radial-gradient(700px_circle_at_100%_100%,oklch(0.96_0.02_95/0.4),transparent_46%)]" />

      <header className="relative z-10 flex items-center justify-between gap-6 px-8 pt-7 pb-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            {live ? (
              <Radio className="size-4" style={{ animation: 'board-live 1.6s ease-in-out infinite' }} />
            ) : status === 'Finalizado' ? (
              <Trophy className="size-4" />
            ) : (
              <FilePenLine className="size-4" />
            )}
            Clasificación en vivo
          </p>
          <h1 className="mt-4 truncate text-4xl font-semibold tracking-tight md:text-4xl">{tournament.config.name}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusChip status={status} />
          {slides.length > 1 && (
            <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground tabular-nums">
              {index + 1} / {slides.length}
            </span>
          )}
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col px-8 pb-5">
        {slide ? (
          <section
            key={slide.key}
            className="flex min-h-0 flex-1 flex-col rounded-3xl border border-border/80 bg-card px-7 py-6 shadow-sm"
            style={{ animation: `${direction === 1 ? 'board-slide-next' : 'board-slide-prev'} 480ms cubic-bezier(0.22, 1, 0.36, 1)` }}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                  {slide.kind === 'table' ? <LayoutList className="size-5" /> : <GitBranch className="size-5" />}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {slide.kind === 'table' ? 'Tabla' : 'Eliminatoria'}
                  </p>
                  <h2 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">{slide.title}</h2>
                </div>
              </div>
              {slide.kind === 'table' && slide.pageLabel && (
                <p className="text-sm text-muted-foreground">{slide.pageLabel}</p>
              )}
            </div>
            {slide.kind === 'table' ? (
              <BoardTable tournament={tournament} table={slide.table} rows={slide.rows} />
            ) : (
              <BoardBracket tournament={tournament} />
            )}
          </section>
        ) : (
          <p className="relative m-auto text-2xl text-muted-foreground">La clasificación aparece al iniciar el torneo.</p>
        )}
      </main>

      {slides.length > 1 && (
        <div className="relative z-10 px-8 pb-4">
          <div className="h-1 overflow-hidden rounded-full bg-border">
            <div
              key={`${slide?.key}:${paused}`}
              className="h-full rounded-full bg-primary"
              style={paused ? { width: '100%' } : { animation: `board-progress ${ROTATE_MS}ms linear` }}
            />
          </div>
          <div className="mt-3 flex justify-center gap-2">
            {slides.map((item, slideIndex) => (
              <button
                key={item.key}
                type="button"
                aria-label={item.title}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  slideIndex === index ? 'w-7 bg-primary' : 'w-2 bg-foreground/15 hover:bg-foreground/30',
                )}
                onClick={() => goTo(slideIndex)}
              />
            ))}
          </div>
        </div>
      )}

      <div className={cn(
        'fixed right-6 bottom-6 z-20 flex gap-2 transition-opacity duration-300',
        controls ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}>
        {slides.length > 1 && (
          <Button size="icon" variant="secondary" className="shadow-sm" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Reanudar' : 'Pausar'}>
            {paused ? <Play /> : <Pause />}
          </Button>
        )}
        <Button size="icon" variant="secondary" className="shadow-sm" onClick={() => void toggleFullscreen()} aria-label="Pantalla completa">
          <Maximize2 />
        </Button>
      </div>
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const icon = status === 'Finalizado'
    ? <CircleCheck className="size-4" />
    : status === 'En curso'
      ? <Radio className="size-4" />
      : <FilePenLine className="size-4" />
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
      status === 'Finalizado' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
    )}>
      {icon}
      {status}
    </span>
  )
}

function slideDirection(from: number, to: number, length: number): 1 | -1 {
  if (from === length - 1 && to === 0) return 1
  if (from === 0 && to === length - 1) return -1
  return to >= from ? 1 : -1
}

function buildSlides(tournament: Tournament): Slide[] {
  const tables = presentTables(tournament)
  const slides: Slide[] = []
  for (const table of tables) {
    if (table.rows.length <= ROWS_PER_SLIDE) {
      slides.push({ kind: 'table', key: table.id, title: table.name, table, rows: table.rows, pageLabel: null })
      continue
    }
    const pages = Math.ceil(table.rows.length / ROWS_PER_SLIDE)
    for (let page = 0; page < pages; page += 1) {
      const rows = table.rows.slice(page * ROWS_PER_SLIDE, (page + 1) * ROWS_PER_SLIDE)
      slides.push({
        kind: 'table',
        key: `${table.id}-${page}`,
        title: table.name,
        table,
        rows,
        pageLabel: `${page + 1} de ${pages}`,
      })
    }
  }
  const bracket = presentBracket(tournament)
  if (bracket.length > 0 && tournament.status !== 'draft') {
    slides.push({ kind: 'bracket', key: 'bracket', title: 'Cuadro' })
  }
  return slides
}

function BoardTable({
  tournament,
  table,
  rows,
}: {
  tournament: Tournament
  table: TableView
  rows: TableView['rows']
}) {
  const setSum = tournament.config.scoringMode === 'sets_won'
  const columns = columnsFor(tournament)
  const values = (row: TableView['rows'][number]) => {
    const stats: Array<[string, number, boolean]> = [
      ['PJ', row.played, false],
      ['PG', row.won, false],
      ['PP', row.lost, false],
      ['Pts', row.points, true],
      ['SF', row.setsFor, false],
      ['SC', row.setsAgainst, false],
    ]
    if (!setSum) {
      stats.push(['JF', row.gamesFor, false], ['JC', row.gamesAgainst, false])
    }
    return stats.filter(([label]) => columns.some((column) => column[0] === label))
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {table.warning && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl bg-accent/70 px-4 py-3 text-base text-accent-foreground">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          {table.warning}
        </p>
      )}
      <div className="mb-1 hidden grid-cols-[1.5rem_2.25rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:grid">
        <span />
        <span className="text-center">#</span>
        <span>Pareja</span>
        <div className="flex gap-1">
          {columns.map(([label, title]) => (
            <span key={label} title={title} className="w-12 text-center">{label}</span>
          ))}
        </div>
      </div>
      <div className="flex flex-col">
        {rows.map((row, rowIndex) => (
          <div
            key={row.pairId}
            className={cn(
              'grid grid-cols-[1.5rem_2.25rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0 border-b border-border/70 px-3 py-3 last:border-b-0',
              row.qualified && 'rounded-xl border-b-transparent bg-primary/6',
            )}
            style={{ animation: 'board-row-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both', animationDelay: `${rowIndex * 45}ms` }}
          >
            <RankMark rank={row.rank} qualified={row.qualified} />
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight md:text-2xl">{row.label}</p>
              <span className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
                {row.qualified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">
                    <BadgeCheck className="size-3.5" />
                    Clasifica
                  </span>
                )}
                {row.tied && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    <Equal className="size-3.5" />
                    Empate
                  </span>
                )}
              </span>
            </div>
            <div className="flex gap-1">
              {values(row).map(([label, value, accent]) => (
                <span
                  key={label}
                  className={cn(
                    'flex w-12 justify-center text-lg tabular-nums md:text-xl',
                    accent ? 'font-semibold text-primary' : 'text-foreground/80',
                  )}
                >
                  {value}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RankMark({ rank, qualified }: { rank: number; qualified: boolean }) {
  const icon = rank === 1
    ? <Trophy className="size-4 text-amber-600" />
    : rank === 2
      ? <Medal className="size-4 text-slate-500" />
      : rank === 3
        ? <Medal className="size-4 text-orange-700" />
        : null
  return (
    <>
      <span className="flex size-6 items-center justify-center" aria-hidden={icon ? undefined : true}>
        {icon}
      </span>
      <span className={cn(
        'text-center text-xl font-semibold tabular-nums',
        qualified && rank > 3 ? 'text-primary' : 'text-foreground',
      )}>
        {rank}
      </span>
    </>
  )
}

function BoardBracket({ tournament }: { tournament: Tournament }) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-muted/40 ring-1 ring-border">
      <div className="absolute inset-0">
        <TournamentBracket tournament={tournament} density="board" />
      </div>
    </div>
  )
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }
  await document.documentElement.requestFullscreen()
}
