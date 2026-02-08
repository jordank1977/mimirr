import { BookCard } from './book-card'
import type { Book } from '@/types/bookinfo'

interface BookGridProps {
  books: Book[]
  emptyMessage?: string
}

export function BookGrid({
  books,
  emptyMessage = 'No books found',
}: BookGridProps) {
  if (!books || books.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-foreground-muted">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  )
}
