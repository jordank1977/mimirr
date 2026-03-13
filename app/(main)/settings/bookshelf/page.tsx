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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface QualityProfile {
  id: number
  profileId: number
  profileName: string
  enabled: boolean
  orderIndex: number
}

interface SortableProfileProps {
  profile: QualityProfile
  onToggle: (profileId: number, enabled: boolean) => void
}

function SortableProfile({ profile, onToggle }: SortableProfileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: profile.profileId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-background-secondary rounded-md border border-border"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-background-tertiary rounded"
        {...attributes}
        {...listeners}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-foreground-muted"
        >
          <line x1="4" x2="20" y1="9" y2="9" />
          <line x1="4" x2="20" y1="15" y2="15" />
        </svg>
      </button>
      <input
        type="checkbox"
        checked={profile.enabled}
        onChange={(e) => onToggle(profile.profileId, e.target.checked)}
        className="w-4 h-4 cursor-pointer"
      />
      <span className={profile.enabled ? 'text-foreground' : 'text-foreground-muted line-through'}>
        {profile.profileName}
      </span>
    </div>
  )
}

export default function BookshelfSettingsPage() {
  const [formData, setFormData] = useState({
    url: '',
    apiKey: '',
  })
  const [initialFormData, setInitialFormData] = useState({
    url: '',
    apiKey: '',
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
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([])
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  const [showApiKeyHelp, setShowApiKeyHelp] = useState(false)

  const hasUnsavedChanges = formData.url !== initialFormData.url || formData.apiKey !== initialFormData.apiKey

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    fetchSettings()
    fetchQualityProfiles()
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
      const response = await fetch('/api/settings/bookshelf')
      const data = await response.json()

      if (response.ok) {
        const settings = {
          url: data.url || '',
          apiKey: data.apiKey || '',
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

  async function fetchQualityProfiles() {
    try {
      setProfilesLoading(true)
      const response = await fetch('/api/settings/bookshelf/quality-profiles')
      const data = await response.json()

      if (response.ok) {
        setQualityProfiles(data.profiles || [])
      }
    } catch (error) {
      console.error('Failed to fetch quality profiles:', error)
    } finally {
      setProfilesLoading(false)
    }
  }

  async function handleToggleProfile(profileId: number, enabled: boolean) {
    try {
      const response = await fetch('/api/settings/bookshelf/quality-profiles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, enabled }),
      })

      if (response.ok) {
        setQualityProfiles(prev =>
          prev.map(p => (p.profileId === profileId ? { ...p, enabled } : p))
        )
      }
    } catch (error) {
      console.error('Failed to toggle profile:', error)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = qualityProfiles.findIndex(p => p.profileId === active.id)
    const newIndex = qualityProfiles.findIndex(p => p.profileId === over.id)

    const newProfiles = arrayMove(qualityProfiles, oldIndex, newIndex)
    setQualityProfiles(newProfiles)

    // Save new order to backend
    try {
      await fetch('/api/settings/bookshelf/quality-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderedProfileIds: newProfiles.map(p => p.profileId),
        }),
      })
    } catch (error) {
      console.error('Failed to save profile order:', error)
      // Revert on error
      setQualityProfiles(qualityProfiles)
    }
  }

  async function handleTestConnection() {
    setTesting(true)
    setTestStatus({
      type: 'testing',
      message: 'Testing connection...',
    })

    try {
      const response = await fetch('/api/settings/bookshelf/test', {
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
        message: `Connected successfully! Found ${data.profileCount || 0} quality profiles.`,
      })

      // Update quality profiles preview (but don't save to settings yet)
      if (data.profiles) {
        setQualityProfiles(data.profiles)
      }
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
      const response = await fetch('/api/settings/bookshelf', {
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
        text: 'Bookshelf settings saved successfully!',
      })

      // Update initial form data to reflect saved state
      setInitialFormData(formData)

      // Fetch quality profiles after successful save
      await fetchQualityProfiles()
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
          <CardTitle>Bookshelf Configuration</CardTitle>
          <CardDescription>
            Configure the connection to your Bookshelf instance for automated
            book downloads
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
              label="Bookshelf URL"
              type="url"
              placeholder="http://localhost:8787"
              value={formData.url}
              onChange={(e) =>
                setFormData({ ...formData, url: e.target.value })
              }
              required
            />

            <Input
              label="API Key"
              type="password"
              placeholder="Your Bookshelf API key"
              value={formData.apiKey}
              onChange={(e) =>
                setFormData({ ...formData, apiKey: e.target.value })
              }
              required
            />

            <div className="bg-background-secondary border border-border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setShowApiKeyHelp(!showApiKeyHelp)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-background-tertiary transition-colors"
              >
                <span className="font-medium text-foreground text-sm">
                  How to find your Bookshelf API key
                </span>
                <svg
                  className={`w-5 h-5 text-foreground-muted transition-transform ${
                    showApiKeyHelp ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showApiKeyHelp && (
                <div className="px-4 pb-4 pt-1">
                  <ol className="list-decimal list-inside space-y-1 text-sm text-foreground-muted">
                    <li>Open your Bookshelf web interface</li>
                    <li>Go to Settings → General</li>
                    <li>Find the API Key section</li>
                    <li>Copy the API key and paste it above</li>
                  </ol>
                </div>
              )}
            </div>

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
                disabled={testing || saving || !formData.url || !formData.apiKey}
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

      {qualityProfiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quality Profiles</CardTitle>
            <CardDescription>
              Enable/disable profiles and reorder them. The first enabled profile will be the default selection when making requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profilesLoading ? (
              <div className="text-center py-4 text-foreground-muted">
                Loading profiles...
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={qualityProfiles.map(p => p.profileId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {qualityProfiles.map(profile => (
                      <SortableProfile
                        key={profile.profileId}
                        profile={profile}
                        onToggle={handleToggleProfile}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>About Bookshelf</CardTitle>
          <CardDescription>
            Bookshelf is a fork of Readarr for managing your ebook and audiobook
            collection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground-muted">
          <p>
            When you approve a book request, Mimirr will automatically send it to
            Bookshelf for download. Bookshelf will then:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Search for the book using configured indexers</li>
            <li>Download the book in your preferred format</li>
            <li>Organize and rename the file</li>
            <li>Add it to your library</li>
          </ul>
          <p className="pt-2">
            Learn more:{' '}
            <a
              href="https://github.com/pennydreadful/bookshelf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Bookshelf on GitHub
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
