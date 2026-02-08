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

  // Get status badge info
  const getStatusBadge = () => {
    if (!book.requestStatus) return null

    const statusConfig = {
      pending: { label: 'Pending', color: 'bg-yellow-500' },
      approved: { label: 'Approved', color: 'bg-green-500' },
      declined: { label: 'Declined', color: 'bg-red-500' },
      available: {
        label: book.availableFormat ? `Available (${book.availableFormat})` : 'Available',
        color: 'bg-blue-500'
      },
      processing: { label: 'Processing', color: 'bg-purple-500' },
    }

    const config = statusConfig[book.requestStatus]
    if (!config) return null

    return (
      <div className={`absolute top-2 right-2 ${config.color} text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg`}>
        {config.label}
      </div>
    )
  }

  return (
    <Link href={`/book/${book.id}`}>
      <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer overflow-hidden">
        <div className="aspect-[2/3] relative bg-background-hover">
          {book.coverImage ? (
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
          {book.rating && (
            <div className="flex items-center gap-1 mt-2">
              <span className="text-yellow-500">★</span>
              <span className="text-xs text-foreground-muted">
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
