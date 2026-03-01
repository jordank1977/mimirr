'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Tab {
  name: string
  path: string
  adminOnly?: boolean
}

const tabs: Tab[] = [
  { name: 'General', path: '/settings/general' },
  { name: 'Notifications', path: '/settings/notifications', adminOnly: true },
  { name: 'Bookshelf', path: '/settings/bookshelf', adminOnly: true },
  { name: 'Users', path: '/settings/users', adminOnly: true },
  { name: 'Logs', path: '/settings/logs', adminOnly: true },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()
        setUserRole(data.user?.role || 'user')
      } catch (error) {
        console.error('Failed to fetch user role:', error)
        setUserRole('user')
      } finally {
        setLoading(false)
      }
    }

    fetchUserRole()
  }, [])

  // Redirect /settings to /settings/general
  useEffect(() => {
    if (pathname === '/settings') {
      router.push('/settings/general')
    }
  }, [pathname, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-foreground-muted">Loading...</p>
      </div>
    )
  }

  // Filter tabs based on user role
  const visibleTabs = tabs.filter(
    (tab) => !tab.adminOnly || userRole === 'admin'
  )

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-foreground-muted">
          Configure Mimirr integrations and preferences
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border overflow-x-auto">
        <nav className="-mb-px flex space-x-4 md:space-x-8">
          {visibleTabs.map((tab) => {
            const isActive = pathname === tab.path
            return (
              <button
                key={tab.path}
                onClick={() => router.push(tab.path)}
                className={`
                  py-3 px-0.5 md:py-4 md:px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap
                  ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-foreground-muted hover:text-foreground hover:border-border-light'
                  }
                `}
              >
                {tab.name}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>{children}</div>
    </div>
  )
}
