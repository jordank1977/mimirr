'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function PreferencesPage() {
  const [hideTutorials, setHideTutorials] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()
        setHideTutorials(data.user?.hideTutorials || false)
      } catch (error) {
        console.error('Failed to fetch preferences:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPreferences()
  }, [])

  async function handleToggleTutorials() {
    setSaving(true)
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hideTutorials: !hideTutorials }),
      })

      if (!response.ok) {
        throw new Error('Failed to update preferences')
      }

      setHideTutorials(!hideTutorials)
    } catch (error) {
      console.error('Failed to update preferences:', error)
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Preferences</h1>
        <p className="text-foreground-muted mt-2">
          Manage your personal preferences and tutorial settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tutorial Messages</CardTitle>
          <CardDescription>
            Control visibility of tutorial and getting started messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Tutorial Messages</p>
              <p className="text-sm text-foreground-muted">
                {hideTutorials
                  ? 'Tutorial messages are currently hidden throughout the app'
                  : 'Tutorial messages are currently shown throughout the app'}
              </p>
            </div>
            <Button
              variant={hideTutorials ? 'default' : 'outline'}
              onClick={handleToggleTutorials}
              disabled={saving}
            >
              {saving ? 'Updating...' : hideTutorials ? 'Show Tutorials' : 'Hide Tutorials'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
