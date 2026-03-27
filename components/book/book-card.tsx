import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import type { Book } from '@/types/bookinfo'

interface BookCardProps {
  book: Book
}

// Exclude overly broad genre categories from display
const broadGenres = new Set([
  'Nonfiction',
  'Fiction',
  'Audiobook',
  'Contemporary',
  'Classics',
  'Writing',
  'Adult',
  'Literature',
  'Biography',
  'Cultural',
  'Adult Fiction',
  'Novels',
  'Biography Memoir'
])

export function BookCard({ book }: BookCardProps) {
  // Filter out broad genres and show only specific ones
  const specificGenres = book.genres?.filter(g => !broadGenres.has(g)) || []

  // Get status badge info using existing standard badge colors
  const getStatusBadge = () => {
    if (!book.mimirrState || book.mimirrState === 'Unowned') return null

    // We only support 'Requested', 'Processing', 'Available', 'Unreleased' on the card
    const statusConfig: Record<string, { label: string, className: string }> = {
      Requested: { label: 'Requested', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      Processing: { label: 'Processing', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
      Available: { label: 'Available', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      Unreleased: { label: 'Unreleased', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
    }

    const config = statusConfig[book.mimirrState as string]
    if (!config) return null

    return (
      <div className={`absolute top-2 right-2 ${config.className} text-xs px-2 py-1 rounded-full font-medium shadow-sm`}>
        {config.label}
      </div>
    )
  }

  return (
    <Link href={`/book/${book.id}`}>
      <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer overflow-hidden">
        <div className="aspect-[2/3] relative bg-background-hover">
          {book.coverImage && book.coverImage !== 'null' && !book.coverImage.startsWith('/') ? (
            <Image
              src={book.coverImage}
              alt={book.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-foreground-muted">
              <span className="text-4xl">📚</span>
            </div>
          )}
          {getStatusBadge()}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm line-clamp-2 mb-1">
            {book.title}
          </h3>
          <p className="text-xs text-foreground-muted line-clamp-1">
            {book.author}
          </p>
          {book.rating !== undefined && book.rating !== null && (
            <div className="flex items-center gap-1 mt-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={
                      star <= Math.round(book.rating!)
                        ? 'text-yellow-500'
                        : 'text-border'
                    }
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="text-xs text-foreground-muted ml-0.5">
                {book.rating.toFixed(1)}
              </span>
            </div>
          )}
          {specificGenres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {specificGenres.slice(0, 2).map((genre) => (
                <span
                  key={genre}
                  className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
