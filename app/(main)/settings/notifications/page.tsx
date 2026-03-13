'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface NotificationSettings {
  discordEnabled: boolean
  discordWebhookUrl: string
  discordBotUsername: string
  discordBotAvatarUrl: string
  notificationTypes: {
    requestApproved: boolean
    requestDeclined: boolean
    requestAvailable: boolean
    requestSubmitted: boolean
    bookshelfError: boolean
  }
}

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    discordEnabled: false,
    discordWebhookUrl: '',
    discordBotUsername: 'Mimirr',
    discordBotAvatarUrl: '',
    notificationTypes: {
      requestApproved: true,
      requestDeclined: true,
      requestAvailable: true,
      requestSubmitted: true,
      bookshelfError: true,
    },
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const response = await fetch('/api/settings/notifications')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Failed to fetch notification settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      setMessage({
        type: 'success',
        text: 'Notification settings saved successfully!',
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save settings',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    try {
      const response = await fetch('/api/settings/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: settings.discordWebhookUrl }),
      })

      if (!response.ok) {
        throw new Error('Failed to send test notification')
      }

      setMessage({
        type: 'success',
        text: 'Test notification sent! Check your Discord channel.',
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to send test notification. Please check your webhook URL.',
      })
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
        <p className="text-foreground-muted">
          Configure and enable notification agents.
        </p>
      </div>

      {/* Discord Tab - Only showing Discord for now, can add more agents later */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-[#5865F2] text-white px-4 py-2 rounded-md font-medium">
              Discord
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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

          {/* Enable Agent */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-foreground">
                Enable Agent <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-foreground-muted">
                Enable Discord notifications
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.discordEnabled}
              onChange={(e) =>
                setSettings({ ...settings, discordEnabled: e.target.checked })
              }
              className="w-5 h-5 accent-primary cursor-pointer"
            />
          </div>

          {/* Webhook URL */}
          <div>
            <label className="block mb-2 font-medium text-foreground">
              Webhook URL <span className="text-red-500">*</span>
            </label>
            <p className="text-sm text-foreground-muted mb-2">
              Create a{' '}
              <a
                href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                webhook integration
              </a>{' '}
              in your server
            </p>
            <Input
              type="url"
              placeholder="https://discord.com/api/webhooks/..."
              value={settings.discordWebhookUrl}
              onChange={(e) =>
                setSettings({ ...settings, discordWebhookUrl: e.target.value })
              }
            />
          </div>

          {/* Bot Username */}
          <div>
            <label className="block mb-2 font-medium text-foreground">
              Bot Username
            </label>
            <Input
              type="text"
              placeholder="Mimirr"
              value={settings.discordBotUsername}
              onChange={(e) =>
                setSettings({ ...settings, discordBotUsername: e.target.value })
              }
            />
          </div>

          {/* Bot Avatar URL */}
          <div>
            <label className="block mb-2 font-medium text-foreground">
              Bot Avatar URL
            </label>
            <Input
              type="url"
              placeholder="https://..."
              value={settings.discordBotAvatarUrl}
              onChange={(e) =>
                setSettings({ ...settings, discordBotAvatarUrl: e.target.value })
              }
            />
          </div>

          {/* Notification Types */}
          <div>
            <label className="block mb-4 font-medium text-foreground">
              Notification Types <span className="text-red-500">*</span>
            </label>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={settings.notificationTypes.requestApproved}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notificationTypes: {
                        ...settings.notificationTypes,
                        requestApproved: e.target.checked,
                      },
                    })
                  }
                  className="mt-1 w-5 h-5 accent-primary cursor-pointer"
                />
                <div>
                  <div className="font-medium text-foreground">Request Approved</div>
                  <div className="text-sm text-foreground-muted">
                    Send notifications when book requests are manually approved.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={settings.notificationTypes.requestDeclined}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notificationTypes: {
                        ...settings.notificationTypes,
                        requestDeclined: e.target.checked,
                      },
                    })
                  }
                  className="mt-1 w-5 h-5 accent-primary cursor-pointer"
                />
                <div>
                  <div className="font-medium text-foreground">Request Declined</div>
                  <div className="text-sm text-foreground-muted">
                    Send notifications when book requests are declined.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={settings.notificationTypes.requestAvailable}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notificationTypes: {
                        ...settings.notificationTypes,
                        requestAvailable: e.target.checked,
                      },
                    })
                  }
                  className="mt-1 w-5 h-5 accent-primary cursor-pointer"
                />
                <div>
                  <div className="font-medium text-foreground">Request Available</div>
                  <div className="text-sm text-foreground-muted">
                    Send notifications when book requests become available.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={settings.notificationTypes.requestSubmitted}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notificationTypes: {
                        ...settings.notificationTypes,
                        requestSubmitted: e.target.checked,
                      },
                    })
                  }
                  className="mt-1 w-5 h-5 accent-primary cursor-pointer"
                />
                <div>
                  <div className="font-medium text-foreground">
                    New Request Submitted (Admin)
                  </div>
                  <div className="text-sm text-foreground-muted">
                    Send notifications when users submit new book requests.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={settings.notificationTypes.bookshelfError}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notificationTypes: {
                        ...settings.notificationTypes,
                        bookshelfError: e.target.checked,
                      },
                    })
                  }
                  className="mt-1 w-5 h-5 accent-primary cursor-pointer"
                />
                <div>
                  <div className="font-medium text-foreground">
                    Bookshelf Connection Issues (Admin)
                  </div>
                  <div className="text-sm text-foreground-muted">
                    Send notifications when Bookshelf API is unreachable or returns errors.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button
              onClick={handleTest}
              variant="outline"
              disabled={!settings.discordEnabled || !settings.discordWebhookUrl}
            >
              Test
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
