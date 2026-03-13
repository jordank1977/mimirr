'use client'

import { useEffect, useState } from 'react'
import { RequestList } from '@/components/request/request-list'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { BookOpen, CheckCircle, XCircle } from 'lucide-react'
import type { RequestWithBook } from '@/lib/services/request.service'

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestWithBook[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('pending')
  const [polling, setPolling] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: number | null }>({
    show: false,
    id: null,
  })
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          <p className="text-2xl font-bold text-green-600">{stats.processing}</p>
        </div>
        <div className="bg-background-card border border-border rounded-lg p-4">
          <p className="text-sm text-foreground-muted">Available</p>
          <p className="text-2xl font-bold text-blue-600">{stats.available}</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
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
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({stats.total})
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScanBookLore}
            disabled={isScanning}
            className="w-full sm:w-auto"
          >
            <BookOpen className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : 'Scan BookLore'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePollStatus}
            disabled={
              polling || (stats.processing === 0 && stats.unreleased === 0)
            }
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
