import { RequestCard } from './request-card'
import type { RequestWithBook } from '@/lib/services/request.service'

interface RequestListProps {
  requests: RequestWithBook[]
  onDelete?: (id: number) => void
  emptyMessage?: string
}

export function RequestList({
  requests,
  onDelete,
  emptyMessage = 'No requests found',
}: RequestListProps) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-foreground-muted">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <RequestCard key={request.id} request={request} onDelete={onDelete} />
      ))}
    </div>
  )
}
