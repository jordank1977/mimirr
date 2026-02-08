import { Card } from '@/components/ui/card'
import type { Author } from '@/types/bookinfo'
import Image from 'next/image'

interface AuthorCardProps {
  author: Author
}

export function AuthorCard({ author }: AuthorCardProps) {
  return (
    <Card className="overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer group">
      <div className="aspect-[3/4] relative bg-muted">
        {author.imageUrl ? (
          <Image
            src={author.imageUrl}
            alt={author.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <div className="text-6xl font-bold text-muted-foreground/30">
              {author.name.charAt(0)}
            </div>
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-semibold text-sm line-clamp-2 mb-1">
          {author.name}
        </h3>

        {author.description && (
          <p className="text-xs text-foreground-muted line-clamp-2 mb-2">
            {author.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          {author.avgRating > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-yellow-500">★</span>
              <span>{author.avgRating.toFixed(1)}</span>
            </div>
          )}
          {author.bookCount > 0 && (
            <span>
              {author.bookCount} {author.bookCount === 1 ? 'book' : 'books'}
            </span>
          )}
        </div>

        {author.genres && author.genres.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {author.genres.slice(0, 2).map((genre) => (
              <span
                key={genre}
                className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
