'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function GeneralSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()
        setUsername(data.user?.username || '')
        setEmail(data.user?.email || '')
      } catch (error) {
        console.error('Failed to fetch preferences:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPreferences()
  }, [])

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMessage('')

    // Validate password confirmation if changing password
    if (newPassword && newPassword !== confirmPassword) {
      setProfileMessage('New passwords do not match')
      setSavingProfile(false)
      return
    }

    try {
      const updateData: {
        username: string
        email: string
        currentPassword?: string
        newPassword?: string
      } = {
        username,
        email,
      }

      // Only include password fields if changing password
      if (newPassword) {
        if (!currentPassword) {
          setProfileMessage('Current password is required to set a new password')
          setSavingProfile(false)
          return
        }
        updateData.currentPassword = currentPassword
        updateData.newPassword = newPassword
      }

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update profile')
      }

      setProfileMessage('Profile updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setSavingProfile(false)
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
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>
            Update your account information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Username
              </label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="border-t border-border pt-4 mt-6">
              <p className="text-sm font-medium mb-4">Change Password (Optional)</p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="currentPassword" className="text-sm font-medium">
                    Current Password
                  </label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="newPassword" className="text-sm font-medium">
                    New Password
                  </label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    placeholder="Leave blank to keep current password"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm New Password
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    placeholder="Confirm your new password"
                  />
                </div>
              </div>
            </div>

            {profileMessage && (
              <p className={`text-sm ${profileMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                {profileMessage}
              </p>
            )}

            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
