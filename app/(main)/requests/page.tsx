'use client'

import { useEffect, useState } from 'react'
import { RequestList } from '@/components/request/request-list'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { RequestWithBook } from '@/lib/services/request.service'

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestWithBook[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [polling, setPolling] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: number | null }>({
    show: false,
    id: null,
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
      const response = await fetch('/api/requests')
      const data = await response.json()
      setRequests(data.requests || [])
    } catch (error) {
      console.error('Failed to fetch requests:', error)
      setRequests([])
    } finally {
      setLoading(false)
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

      // Refresh requests
      await fetchRequests()
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

      await fetchRequests()
    } catch (error) {
      console.error('Failed to poll status:', error)
    } finally {
      setPolling(false)
    }
  }

  const filteredRequests =
    filter === 'all'
      ? requests
      : requests.filter((r) => r.status === filter)

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    processing: requests.filter((r) => r.status === 'processing').length,
    available: requests.filter((r) => r.status === 'available').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-foreground-muted">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          My Requests
        </h1>
        <p className="text-foreground-muted">
          View and manage your book requests
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-background-card border border-border rounded-lg p-4">
          <p className="text-sm text-foreground-muted">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-background-card border border-border rounded-lg p-4">
          <p className="text-sm text-foreground-muted">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-background-card border border-border rounded-lg p-4">
          <p className="text-sm text-foreground-muted">Processing</p>
          <p className="text-2xl font-bold text-green-600">{stats.processing}</p>
        </div>
        <div className="bg-background-card border border-border rounded-lg p-4">
          <p className="text-sm text-foreground-muted">Available</p>
          <p className="text-2xl font-bold text-blue-600">{stats.available}</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({stats.total})
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            Pending ({stats.pending})
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
        </div>
        <div className="sm:flex sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePollStatus}
            disabled={polling || stats.processing === 0}
            className="w-full sm:w-auto"
          >
            {polling ? 'Checking...' : 'Check Status Now'}
          </Button>
        </div>
      </div>

      {/* Requests List */}
      <RequestList
        requests={filteredRequests}
        onDelete={handleDelete}
        emptyMessage={
          filter === 'all'
            ? "You haven't made any requests yet. Start by searching for books!"
            : `No ${filter} requests found.`
        }
      />

      <ConfirmDialog
        open={deleteConfirm.show}
        onOpenChange={(show) => setDeleteConfirm({ show, id: null })}
        onConfirm={confirmDelete}
        title="Cancel Request"
        description="Are you sure you want to cancel this request? This action cannot be undone."
        confirmText="Cancel Request"
        cancelText="Keep Request"
        variant="destructive"
      />
    </div>
  )
}
