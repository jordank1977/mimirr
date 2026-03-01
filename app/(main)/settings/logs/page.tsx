'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/utils/logger'

export default function LogsSettingsPage() {
  const [logLevel, setLogLevel] = useState('info')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/settings/logs')
        if (response.ok) {
          const data = await response.json()
          setLogLevel(data.level)
        }
      } catch (error) {
        console.error('Failed to fetch log settings:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/settings/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: logLevel }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Log settings saved successfully' })
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred' })
    } finally {
      setSaving(false)
    }
  }

  const handleViewLogs = () => {
    window.open('/api/logs/view', '_blank')
  }

  if (loading) {
    return <div className="py-8 text-center text-foreground-muted">Loading settings...</div>
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Logging Configuration</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1">
                Log Level
              </label>
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="info">Info (Default)</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
                <option value="debug">Debug (Verbose)</option>
              </select>
              <p className="mt-1 text-xs text-foreground-muted">
                Determines the verbosity of the application logs.
              </p>
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-md text-sm ${
              message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
            }`}>
              {message.text}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-2 text-foreground">Log Viewer</h2>
        <p className="text-sm text-foreground-muted mb-4">
          View the raw application logs. This will open in a new tab.
        </p>
        <Button variant="outline" onClick={handleViewLogs}>
          View Logs
        </Button>
      </Card>
    </div>
  )
}
