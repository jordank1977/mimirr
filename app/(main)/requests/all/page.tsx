'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RequestStatusBadge } from '@/components/request/request-status-badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { BookOpen, CheckCircle, XCircle } from 'lucide-react'
import type { RequestWithBook } from '@/lib/services/request.service'

export default function AllRequestsPage() {
  const [requests, setRequests] = useState<RequestWithBook[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('pending')
  const [polling, setPolling] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [declineConfirm, setDeclineConfirm] = useState<{ show: boolean; id: number | null }>({
    show: false,
    id: null,
  })
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: number | null }>({
    show: false,
    id: null,
  })
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error'
  }>({
    show: false,
    message: '',
    type: 'success',
  })

  useEffect(() => {
    fetchRequests()
  }, [])

  // Auto-refresh requests every 10 seconds to show new/updated requests, but pause when tab is hidden
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchRequests()
      }
    }, 10000) // 10 seconds

    // Also fetch when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchRequests()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  async function fetchRequests() {
    try {
      const response = await fetch('/api/requests/all')
      const data = await response.json()
      setRequests(data.requests || [])
    } catch (error) {
      console.error('Failed to fetch requests:', error)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: number) {
    setApprovingId(id)
    try {
      const response = await fetch(`/api/requests/${id}/approve`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to approve request')
      }

      await fetchRequests()
    } catch (error) {
      console.error('Failed to approve request:', error)
    } finally {
      setApprovingId(null)
    }
  }

  function handleDecline(id: number) {
    setDeclineConfirm({ show: true, id })
  }

  async function confirmDecline() {
    if (!declineConfirm.id) return

    try {
      const response = await fetch(`/api/requests/${declineConfirm.id}/decline`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to decline request')
      }

      await fetchRequests()
      setDeclineConfirm({ show: false, id: null })
    } catch (error) {
      console.error('Failed to decline request:', error)
    }
  }

  function handleDelete(id: number) {
    setDeleteConfirm({ show: true, id })
  }

  async function confirmDelete() {
    if (!deleteConfirm.id) return

    try {
      const response = await fetch(`/api/requests/${deleteConfirm.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete request')
      }

      await fetchRequests()
      setDeleteConfirm({ show: false, id: null })
    } catch (error) {
      console.error('Failed to delete request:', error)
    }
  }

  async function handlePollStatus() {
    setPolling(true)
    try {
      const response = await fetch('/api/requests/poll', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to poll status')
      }

      // Refresh requests to show updated statuses
      await fetchRequests()
    } catch (error) {
      console.error('Failed to poll status:', error)
    } finally {
      setPolling(false)
    }
  }

  async function handleScanBookLore() {
    setIsScanning(true)
    try {
      const response = await fetch('/api/booklore/scan', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to scan BookLore')
      }

      // Show success toast
      setToast({
        show: true,
        message: 'BookLore scan initiated successfully',
        type: 'success',
      })
      
      // Auto-hide toast after 5 seconds
      setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }))
      }, 5000)
    } catch (error) {
      // Show error toast
      setToast({
        show: true,
        message: error instanceof Error ? error.message : 'Failed to scan BookLore',
        type: 'error',
      })
      
      // Auto-hide toast after 5 seconds
      setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }))
      }, 5000)
    } finally {
      setIsScanning(false)
    }
  }

  const isUnreleased = (r: RequestWithBook) =>
    r.bookPublishedDate && new Date(r.bookPublishedDate) > new Date()

  const filteredRequests =
    filter === 'all'
      ? requests
      : filter === 'unreleased'
        ? requests.filter(
            (r) =>
              (r.status === 'processing' || r.status === 'approved') &&
              isUnreleased(r)
          )
        : filter === 'processing'
          ? requests.filter(
              (r) => r.status === 'processing' && !isUnreleased(r)
            )
          : requests.filter((r) => r.status === filter)

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    unreleased: requests.filter(
      (r) =>
        (r.status === 'processing' || r.status === 'approved') &&
        isUnreleased(r)
    ).length,
    processing: requests.filter(
      (r) => r.status === 'processing' && !isUnreleased(r)
    ).length,
    available: requests.filter((r) => r.status === 'available').length,
    declined: requests.filter((r) => r.status === 'declined').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-foreground-muted">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          All Requests (Admin)
        </h1>
        <p className="text-foreground-muted">
          Manage all user book requests
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-background-card border border-border rounded-lg p-4">
          <p className="text-sm text-foreground-muted">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-background-card border border-border rounded-lg p-4">
          <p className="text-sm text-foreground-muted">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-background-card border border-border rounded-lg p-4">
          <p className="text-sm text-foreground-muted">Unreleased</p>
          <p className="text-2xl font-bold text-primary">{stats.unreleased}</p>
        </div>
        <div className="bg-background-card border border-border rounded-lg p-4">
          <p className="text-sm text-foreground-muted">Processing</p>
          <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
        </div>
        <div className="bg-background-card border border-border rounded-lg p-4">
          <p className="text-sm text-foreground-muted">Available</p>
          <p className="text-2xl font-bold text-green-600">{stats.available}</p>
        </div>
        <div className="bg-background-card border border-border rounded-lg p-4">
          <p className="text-sm text-foreground-muted">Declined</p>
          <p className="text-2xl font-bold text-red-600">{stats.declined}</p>
        </div>
      </div>

      {/* Filter Buttons and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            Pending ({stats.pending})
          </Button>
          <Button
            variant={filter === 'unreleased' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unreleased')}
          >
            Unreleased ({stats.unreleased})
          </Button>
          <Button
            variant={filter === 'processing' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('processing')}
          >
            Processing ({stats.processing})
          </Button>
          <Button
            variant={filter === 'available' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('available')}
          >
            Available ({stats.available})
          </Button>
          <Button
            variant={filter === 'declined' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('declined')}
          >
            Declined ({stats.declined})
          </Button>
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({stats.total})
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScanBookLore}
            disabled={isScanning}
          >
            <BookOpen className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : 'Scan BookLore'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePollStatus}
            disabled={polling || (stats.processing === 0 && stats.unreleased === 0)}
          >
            {polling ? 'Checking...' : 'Check Status Now'}
          </Button>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-foreground-muted">
              {filter === 'all'
                ? 'No requests found'
                : `No ${filter} requests found`}
            </p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <Card key={request.id} className="overflow-hidden">
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
                      {request.requestedBy && (
                        <p className="font-medium text-foreground">
                          Requested by: {request.requestedBy}
                        </p>
                      )}
                      <p>
                        Requested:{' '}
                        {new Date(request.requestedAt).toLocaleDateString()}
                      </p>
                      {request.bookPublishedDate &&
                        new Date(request.bookPublishedDate) > new Date() && (
                          <p className="text-primary font-medium">
                            Releases:{' '}
                            {new Date(
                              request.bookPublishedDate
                            ).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        )}
                      {request.notes && (
                        <p className="italic line-clamp-2">
                          Note: {request.notes}
                        </p>
                      )}
                    </div>

                    {/* Admin Actions */}
                    {request.status === 'pending' && (
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApprove(request.id)}
                          disabled={approvingId === request.id}
                        >
                          {approvingId === request.id ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDecline(request.id)}
                          disabled={approvingId === request.id}
                        >
                          Decline
                        </Button>
                      </div>
                    )}

                    {(request.status === 'approved' ||
                      request.status === 'declined' ||
                      request.status === 'processing' ||
                      request.status === 'available') && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(request.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ConfirmDialog
        open={declineConfirm.show}
        onOpenChange={(show) => setDeclineConfirm({ show, id: null })}
        onConfirm={confirmDecline}
        title="Decline Request"
        description="Are you sure you want to decline this request? The user will not be notified."
        confirmText="Decline"
        cancelText="Cancel"
        variant="destructive"
      />

      <ConfirmDialog
        open={deleteConfirm.show}
        onOpenChange={(show) => setDeleteConfirm({ show, id: null })}
        onConfirm={confirmDelete}
        title="Delete Request"
        description="Are you sure you want to delete this request? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-5">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
            toast.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(prev => ({ ...prev, show: false }))}
              className="ml-2 text-foreground-muted hover:text-foreground"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
