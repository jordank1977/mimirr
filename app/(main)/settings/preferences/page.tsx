'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PreferencesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Preferences</h1>
        <p className="text-foreground-muted mt-2">
          Manage your personal preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Preferences</CardTitle>
          <CardDescription>
            Additional preference options coming soon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground-muted">
            No preferences available at this time.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
