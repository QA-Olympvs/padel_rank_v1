import { CircleCheck, FilePenLine, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { completionLabel } from '@/domain/present'
import type { Tournament } from '@/domain/types'

export function StatusBadge({ tournament }: { tournament: Tournament }) {
  const label = completionLabel(tournament)
  if (label === 'Finalizado') {
    return <Badge className="gap-1"><CircleCheck className="size-3.5" />Finalizado</Badge>
  }
  if (label === 'En curso') {
    return <Badge variant="secondary" className="gap-1"><Radio className="size-3.5" />En curso</Badge>
  }
  return <Badge variant="outline" className="gap-1"><FilePenLine className="size-3.5" />Borrador</Badge>
}
