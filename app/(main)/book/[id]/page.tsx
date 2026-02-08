'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BookDetails } from '@/components/book/book-details'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Book } from '@/types/bookinfo'

interface QualityProfile {
  id: number
  name: string
}

export default function BookPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const resolvedParams = use(params)
  const [book, setBook] = useState<Book | null>(null)
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [requestSuccess, setRequestSuccess] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch book details and quality profiles in parallel
        const [bookResponse, profilesResponse] = await Promise.all([
          fetch(`/api/books/${resolvedParams.id}`),
          fetch('/api/settings/quality-profiles'),
        ])

        if (!bookResponse.ok) {
          throw new Error('Book not found')
        }

        const bookData = await bookResponse.json()
        setBook(bookData.book)

        // Quality profiles are optional (only if Bookshelf is configured)
        if (profilesResponse.ok) {
          const profilesData = await profilesResponse.json()
          setQualityProfiles(profilesData.profiles || [])
          // Set default to first profile
          if (profilesData.profiles && profilesData.profiles.length > 0) {
            setSelectedProfileId(profilesData.profiles[0].id)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load book')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [resolvedParams.id])

  const handleRequest = async () => {
    if (!book || selectedProfileId === null) return

    setRequesting(true)
    setError('')

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: book.id,
          qualityProfileId: selectedProfileId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create request')
      }

      setRequestSuccess(true)

      // Refetch book data to show updated status
      try {
        const bookResponse = await fetch(`/api/books/${resolvedParams.id}`)
        if (bookResponse.ok) {
          const bookData = await bookResponse.json()
          setBook(bookData.book)
        }
      } catch (refreshError) {
        // Silently fail - the main request was successful
        console.error('Failed to refresh book data:', refreshError)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request')
    } finally {
      setRequesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-foreground-muted">Loading...</p>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-foreground-muted">
          {error || 'Book not found'}
        </p>
        <Button onClick={() => window.history.back()}>Go Back</Button>
      </div>
    )
  }

  const getStatusInfo = () => {
    if (!book.requestStatus) return null

    const statusConfig = {
      pending: {
        label: 'Pending Request',
        color: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-400',
        message: 'You already have a pending request for this book. An admin will review it soon.',
      },
      approved: {
        label: 'Request Approved',
        color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400',
        message: 'Your request for this book has been approved and is being processed.',
      },
      declined: {
        label: 'Request Declined',
        color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400',
        message: 'Your previous request for this book was declined.',
      },
      available: {
        label: book.availableFormat ? `Book Available (${book.availableFormat})` : 'Book Available',
        color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
        message: book.availableFormat
          ? `This book is available in your library as ${book.availableFormat}. Note: Bookshelf only supports one format per book. Requesting a different format would replace this file.`
          : 'This book is available in the library!',
      },
      processing: {
        label: 'Being Processed',
        color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
        message: 'This book is currently being downloaded and processed.',
      },
    }

    return statusConfig[book.requestStatus]
  }

  const statusInfo = getStatusInfo()
  const canRequest = !book.requestStatus || book.requestStatus === 'declined'

  return (
    <div className="space-y-8">
      <BookDetails book={book} />

      {/* Existing Request Status */}
      {statusInfo && (
        <div className={`px-4 py-3 rounded-md border ${statusInfo.color}`}>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="font-medium mb-1">{statusInfo.label}</h4>
              <p className="text-sm">{statusInfo.message}</p>
            </div>
          </div>
        </div>
      )}

      {error && !requestSuccess && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {requestSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-md">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="font-medium mb-1">Request Created Successfully!</h4>
              <p className="text-sm">Your request has been submitted and is pending admin approval. You can view all your requests on the My Requests page.</p>
            </div>
          </div>
        </div>
      )}

      {qualityProfiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Request Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Quality Profile
              </label>
              <select
                value={selectedProfileId || ''}
                onChange={(e) => setSelectedProfileId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={requesting || requestSuccess}
              >
                {qualityProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-foreground-muted">
                Select the quality profile to use for this book request
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        <Button
          size="lg"
          className="flex-1"
          onClick={handleRequest}
          disabled={!canRequest || requesting || requestSuccess || selectedProfileId === null}
        >
          {requesting
            ? 'Requesting...'
            : requestSuccess
              ? 'Request Sent!'
              : !canRequest
                ? 'Already Requested'
                : 'Request Book'}
        </Button>
        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    </div>
  )
}
