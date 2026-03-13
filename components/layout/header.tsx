'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NotificationBell } from '@/components/layout/notification-bell'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface HeaderProps {
  user?: {
    username: string
    role: string
  }
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/discover?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
      setMobileSearchOpen(false)
    }
  }

  const showSearchBar = pathname !== '/discover'

  return (
    <header className="border-b border-border bg-background-card backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/discover" className="text-xl font-bold text-primary flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Mimirr"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            Mimirr
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link
              href="/discover"
              className="text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
            >
              Discover
            </Link>
            <Link
              href="/requests"
              className="text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
            >
              My Requests
            </Link>
            {user?.role === 'admin' && (
              <Link
                href="/requests/all"
                className="text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
              >
                All Requests
              </Link>
            )}
            <Link
              href="/settings"
              className="text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
            >
              Settings
            </Link>
          </nav>
        </div>
        {user && (
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </Button>

            {/* Desktop search bar - hidden on Discover page */}
            {showSearchBar && (
              <form onSubmit={handleSearch} className="hidden lg:flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Search books..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-40 xl:w-64"
                />
                <Button type="submit" size="sm" disabled={!searchQuery.trim()}>
                  Search
                </Button>
              </form>
            )}

            {/* Mobile search icon button */}
            {showSearchBar && !mobileSearchOpen && (
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setMobileSearchOpen(true)}
                aria-label="Open search"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </Button>
            )}

            <NotificationBell />
            <span className="text-sm text-foreground-muted hidden sm:inline">
              {user.username}
              {user.role === 'admin' && (
                <span className="ml-2 text-xs bg-primary text-white px-2 py-1 rounded-full font-medium">
                  Admin
                </span>
              )}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:inline-flex">
              Logout
            </Button>
          </div>
        )}
      </div>

      {/* Mobile search bar - expands below header */}
      {showSearchBar && mobileSearchOpen && (
        <div className="lg:hidden border-t border-border bg-background-card">
          <div className="container mx-auto px-4 py-3">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Search books..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
                autoFocus
              />
              <Button type="submit" size="sm" disabled={!searchQuery.trim()}>
                Search
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMobileSearchOpen(false)}
                aria-label="Close search"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Navigation Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-4 mt-6">
            <Link
              href="/discover"
              className="text-base font-medium text-foreground-muted hover:text-foreground transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Discover
            </Link>
            <Link
              href="/requests"
              className="text-base font-medium text-foreground-muted hover:text-foreground transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              My Requests
            </Link>
            {user?.role === 'admin' && (
              <Link
                href="/requests/all"
                className="text-base font-medium text-foreground-muted hover:text-foreground transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                All Requests
              </Link>
            )}
            <Link
              href="/settings"
              className="text-base font-medium text-foreground-muted hover:text-foreground transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Settings
            </Link>
            <div className="border-t border-border my-4"></div>
            <button
              onClick={() => {
                setMobileMenuOpen(false)
                handleLogout()
              }}
              className="text-base font-medium text-accent-red hover:text-red-600 transition-colors py-2 text-left"
            >
              Log Out
            </button>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  )
}
