import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { presentTables, type TableView } from '@/domain/present'
import type { Tournament } from '@/domain/types'
import { columnsFor, type StandingsColumn } from '@/features/standings/columns'

const numberColClass = 'w-12 min-w-12 max-w-12 px-1 text-right tabular-nums'

export function StandingsPanel({ tournament }: { tournament: Tournament }) {
  const tables = presentTables(tournament)
  const setSum = tournament.config.scoringMode === 'sets_won'
  const columns = columnsFor(tournament)

  if (tournament.status === 'draft') {
    return <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">La clasificación aparece al iniciar el torneo.</p>
  }
  if (tables.length === 0) {
    return <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Este formato se sigue en el cuadro, no en una tabla.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {setSum
          ? `Clasifican ${tournament.config.qualifiersPerGroup} ${tournament.config.qualifiersPerGroup === 1 ? 'pareja' : 'parejas'} por grupo. El badge de Clasifica sale cuando esa plaza ya no se puede perder. Si hay empate a puntos por un cupo, se juega un desempate al primero que llegue a ${tournament.config.setsToPlay} sets.`
          : `Una victoria suma ${tournament.config.pointsPerWin} ${tournament.config.pointsPerWin === 1 ? 'punto' : 'puntos'}. Si hay empate, se mira la diferencia de sets, la de juegos y, al final, los partidos entre ellas.`}
      </p>
      {tables.map((table) => (
        <StandingsTable key={table.id} table={table} columns={columns} setSum={setSum} />
      ))}
    </div>
  )
}

function StandingsTable({
  table,
  columns,
  setSum,
}: {
  table: TableView
  columns: readonly StandingsColumn[]
  setSum: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{table.name}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Cada pareja juega {table.matchesToPlay} {table.matchesToPlay === 1 ? 'partido' : 'partidos'}.
          {table.playoffPending
            ? ' Falta el desempate por el último cupo.'
            : table.settled
              ? ' La fase está cerrada.'
              : ' Los clasificados se marcan al terminar todos los partidos.'}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {table.warning && <Alert><AlertDescription>{table.warning}</AlertDescription></Alert>}
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 min-w-10 px-1">#</TableHead>
              <TableHead className="min-w-40">Pareja</TableHead>
              {columns.map(([label, title]) => (
                <TableHead key={label} title={title} className={numberColClass}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map((row) => (
              <TableRow key={row.pairId} className={row.qualified ? 'bg-primary/5' : undefined}>
                <TableCell className="w-10 min-w-10 px-1 tabular-nums">{row.rank}</TableCell>
                <TableCell className="min-w-40 whitespace-normal">
                  <div className="flex min-h-8 items-center gap-2">
                    <span className="min-w-0 flex-1 font-medium">{row.label}</span>
                    <span className="flex w-[4.75rem] shrink-0 flex-col items-end justify-center gap-1">
                      {row.qualified && <Badge variant="secondary">Clasifica</Badge>}
                      {row.tied && <Badge variant="outline">Empate</Badge>}
                    </span>
                  </div>
                </TableCell>
                <NumberCell>{row.played}</NumberCell>
                <NumberCell>{row.won}</NumberCell>
                <NumberCell>{row.lost}</NumberCell>
                <NumberCell>{row.points}</NumberCell>
                <NumberCell>{row.setsFor}</NumberCell>
                <NumberCell>{row.setsAgainst}</NumberCell>
                {!setSum && <NumberCell>{row.gamesFor}</NumberCell>}
                {!setSum && <NumberCell>{row.gamesAgainst}</NumberCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function NumberCell({ children }: { children: number }) {
  return <TableCell className={`${numberColClass} whitespace-nowrap`}>{children}</TableCell>
}
