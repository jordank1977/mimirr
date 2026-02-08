import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RequestStatusBadge } from './request-status-badge'
import type { RequestWithBook } from '@/lib/services/request.service'

interface RequestCardProps {
  request: RequestWithBook
  onDelete?: (id: number) => void
}

export function RequestCard({ request, onDelete }: RequestCardProps) {
  const requestDate = new Date(request.requestedAt).toLocaleDateString()

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Book Cover */}
          <div className="flex-shrink-0 w-16 h-24 relative bg-background-hover rounded overflow-hidden">
            {request.bookCoverImage ? (
              <Image
                src={request.bookCoverImage}
                alt={request.bookTitle}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-foreground-muted">
                <span className="text-2xl">📚</span>
              </div>
            )}
          </div>

          {/* Request Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">
                  {request.bookTitle}
                </h3>
                <p className="text-xs text-foreground-muted truncate">
                  {request.bookAuthor}
                </p>
              </div>
              <RequestStatusBadge status={request.status} />
            </div>

            <div className="mt-2 space-y-1 text-xs text-foreground-muted">
              <p>Requested: {requestDate}</p>
              {request.notes && (
                <p className="italic line-clamp-2">Note: {request.notes}</p>
              )}
            </div>

            {/* Actions */}
            {request.status === 'pending' && onDelete && (
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(request.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  Cancel Request
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
