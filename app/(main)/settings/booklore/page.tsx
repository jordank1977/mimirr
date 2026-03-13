'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface FormData {
  url: string
  username: string
  password: string
  libraryId: string
}

export default function BookLoreSettingsPage() {
  const [formData, setFormData] = useState<FormData>({
    url: '',
    username: '',
    password: '',
    libraryId: '',
  })
  const [initialFormData, setInitialFormData] = useState<FormData>({
    url: '',
    username: '',
    password: '',
    libraryId: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testStatus, setTestStatus] = useState<{
    type: 'testing' | 'success' | 'error'
    message: string
  } | null>(null)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)

  const hasUnsavedChanges = 
    formData.url !== initialFormData.url || 
    formData.username !== initialFormData.username || 
    formData.password !== initialFormData.password || 
    formData.libraryId !== initialFormData.libraryId

  useEffect(() => {
    fetchSettings()
  }, [])

  // Warn user when leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  async function fetchSettings() {
    try {
      const response = await fetch('/api/settings/booklore')
      const data = await response.json()

      if (response.ok) {
        const settings: FormData = {
          url: data.url || '',
          username: data.username || '',
          password: data.password || '',
          libraryId: data.libraryId || '',
        }
        setFormData(settings)
        setInitialFormData(settings)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleTestConnection() {
    setTesting(true)
    setTestStatus({
      type: 'testing',
      message: 'Testing connection to BookLore...',
    })

    try {
      const response = await fetch('/api/settings/booklore/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Connection test failed')
      }

      setTestStatus({
        type: 'success',
        message: `Connected successfully! ${data.message || 'Authentication successful.'}`,
      })
    } catch (error) {
      setTestStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Connection test failed',
      })
    } finally {
      setTesting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/settings/booklore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings')
      }

      setMessage({
        type: 'success',
        text: 'BookLore settings saved successfully!',
      })

      // Update initial form data to reflect saved state
      setInitialFormData(formData)
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save settings',
      })
    } finally {
      setSaving(false)
    }
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
      <Card>
        <CardHeader>
          <CardTitle>BookLore Configuration</CardTitle>
          <CardDescription>
            Configure BookLore to enable on-demand library scanning. This allows users to force BookLore to refresh its library immediately after a book is downloaded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {message && (
              <div
                className={`px-4 py-3 rounded-md ${
                  message.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}

            <Input
              label="BookLore URL"
              type="url"
              placeholder="https://api.booklore.example.com"
              value={formData.url}
              onChange={(e) =>
                setFormData({ ...formData, url: e.target.value })
              }
              required
            />

            <Input
              label="Username"
              type="text"
              placeholder="Your BookLore username"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="Your BookLore password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
            />

            <Input
              label="Library ID"
              type="text"
              placeholder="Your BookLore library ID"
              value={formData.libraryId}
              onChange={(e) =>
                setFormData({ ...formData, libraryId: e.target.value })
              }
              required
            />

            {/* Test Connection Status */}
            {testStatus && (
              <div
                className={`px-4 py-3 rounded-md ${
                  testStatus.type === 'testing'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                    : testStatus.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  {testStatus.type === 'testing' && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
                  )}
                  {testStatus.type === 'success' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  {testStatus.type === 'error' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>{testStatus.message}</span>
                </div>
              </div>
            )}

            {/* Unsaved Changes Warning */}
            {hasUnsavedChanges && (
              <div className="px-4 py-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-400">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>You have unsaved changes</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || saving || !formData.url || !formData.username || !formData.password || !formData.libraryId}
                className="flex-1"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button
                type="submit"
                disabled={saving || testing || !hasUnsavedChanges}
                className="flex-1"
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About BookLore</CardTitle>
          <CardDescription>
            BookLore provides on-demand library scanning to keep your book library synchronized
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground-muted">
          <p>
            BookLore enhances Mimirr by providing immediate library scanning capabilities:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Manual library refresh on demand</li>
            <li>Immediate synchronization after book downloads</li>
            <li>Library status monitoring and health checks</li>
            <li>Integration with your existing BookLore library</li>
          </ul>
          <p className="pt-2">
            When enabled, users can manually trigger BookLore library scans to ensure
            newly downloaded books are immediately available in the system.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}