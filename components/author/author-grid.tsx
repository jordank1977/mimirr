import { AuthorCard } from './author-card'
import type { Author } from '@/types/bookinfo'

interface AuthorGridProps {
  authors: Author[]
  emptyMessage?: string
}

export function AuthorGrid({
  authors,
  emptyMessage = 'No authors found',
}: AuthorGridProps) {
  if (!authors || authors.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-foreground-muted">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
      {authors.map((author) => (
        <AuthorCard key={author.id} author={author} />
      ))}
    </div>
  )
}
