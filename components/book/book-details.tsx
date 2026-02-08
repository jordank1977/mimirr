import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Book } from '@/types/bookinfo'

interface BookDetailsProps {
  book: Book
}

export function BookDetails({ book }: BookDetailsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
      {/* Cover Image */}
      <div className="md:col-span-1">
        <div className="aspect-[2/3] relative bg-background-hover rounded-lg overflow-hidden">
          {book.coverImage ? (
            <Image
              src={book.coverImage}
              alt={book.title}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex items-center justify-center h-full text-foreground-muted">
              <span className="text-8xl">📚</span>
            </div>
          )}
        </div>
      </div>

      {/* Book Information */}
      <div className="md:col-span-2 space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-2">
            {book.title}
          </h1>
          {book.subtitle && (
            <p className="text-lg md:text-xl text-foreground-muted mb-4">
              {book.subtitle}
            </p>
          )}
          <p className="text-lg text-foreground">
            by {book.authors.join(', ')}
          </p>
          {book.series && (
            <p className="text-sm text-foreground-muted mt-2">
              {book.series}
              {book.seriesPosition && ` #${book.seriesPosition}`}
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4">
          {book.rating && (
            <div>
              <p className="text-sm text-foreground-muted">Rating</p>
              <div className="flex items-center gap-1">
                <span className="text-yellow-500">★</span>
                <span className="font-semibold">
                  {book.rating.toFixed(1)} / 5
                </span>
              </div>
            </div>
          )}
          {book.pageCount && (
            <div>
              <p className="text-sm text-foreground-muted">Pages</p>
              <p className="font-semibold">{book.pageCount}</p>
            </div>
          )}
          {book.publishedDate && (
            <div>
              <p className="text-sm text-foreground-muted">
                Published
              </p>
              <p className="font-semibold">
                {new Date(book.publishedDate).getFullYear()}
              </p>
            </div>
          )}
          {book.publisher && (
            <div>
              <p className="text-sm text-foreground-muted">
                Publisher
              </p>
              <p className="font-semibold">{book.publisher}</p>
            </div>
          )}
          {book.isbn13 && (
            <div>
              <p className="text-sm text-foreground-muted">
                ISBN-13
              </p>
              <p className="font-mono text-sm">{book.isbn13}</p>
            </div>
          )}
        </div>

        {/* Description */}
        {book.description && (
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground whitespace-pre-line">
                {book.description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Genres */}
        {book.genres.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-foreground-muted mb-2">
              Genres
            </h3>
            <div className="flex flex-wrap gap-2">
              {book.genres.map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1 bg-background-hover border border-border rounded-full text-sm"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
