'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface User {
  id: number
  username: string
  email: string
  displayName: string | null
  role: 'admin' | 'user'
  createdAt: Date
  lastLoginAt: Date | null
}

interface UserStats {
  total: number
  admins: number
  regularUsers: number
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    admins: 0,
    regularUsers: 0,
  })
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean
    id: number | null
    username: string
  }>({
    show: false,
    id: null,
    username: '',
  })

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    displayName: '',
    role: 'user' as 'admin' | 'user',
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      setUsers(data.users || [])
      setStats(data.stats || { total: 0, admins: 0, regularUsers: 0 })
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to create user:', error.error)
        return
      }

      setShowCreateForm(false)
      setFormData({
        username: '',
        email: '',
        password: '',
        displayName: '',
        role: 'user',
      })
      await fetchUsers()
    } catch (error) {
      console.error('Failed to create user:', error)
    }
  }

  async function handleUpdateUser(userId: number, updates: Partial<User>) {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to update user:', error.error)
        return
      }

      setEditingUser(null)
      await fetchUsers()
    } catch (error) {
      console.error('Failed to update user:', error)
    }
  }

  function handleDeleteUser(userId: number, username: string) {
    setDeleteConfirm({ show: true, id: userId, username })
  }

  async function confirmDeleteUser() {
    if (!deleteConfirm.id) return

    try {
      const response = await fetch(`/api/users/${deleteConfirm.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to delete user:', error.error)
        return
      }

      await fetchUsers()
    } catch (error) {
      console.error('Failed to delete user:', error)
    }
  }

  async function handleToggleRole(userId: number, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    await handleUpdateUser(userId, { role: newRole as 'admin' | 'user' })
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-foreground-muted mt-2">
            Manage user accounts and permissions
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>Create User</Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-background-card border border-border rounded-lg p-4">
          <p className="text-sm text-foreground-muted">Total Users</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-background-card border border-border rounded-lg p-4">
          <p className="text-sm text-foreground-muted">Administrators</p>
          <p className="text-2xl font-bold text-primary">{stats.admins}</p>
        </div>
        <div className="bg-background-card border border-border rounded-lg p-4">
          <p className="text-sm text-foreground-muted">Regular Users</p>
          <p className="text-2xl font-bold text-blue-600">{stats.regularUsers}</p>
        </div>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Create New User</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Username *
                </label>
                <Input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  required
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Password *
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Display Name
                </label>
                <Input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData({ ...formData, displayName: e.target.value })
                  }
                  placeholder="Optional display name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as 'admin' | 'user',
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                >
                  <option value="user">User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit">Create User</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      <div className="space-y-4">
        {users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-foreground-muted">No users found</p>
          </div>
        ) : (
          users.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{user.username}</h3>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          user.role === 'admin'
                            ? 'bg-primary text-white'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}
                      >
                        {user.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </div>
                    <p className="text-sm text-foreground-muted mt-1">
                      {user.email}
                    </p>
                    {user.displayName && (
                      <p className="text-sm text-foreground-muted">
                        Display: {user.displayName}
                      </p>
                    )}
                    <p className="text-xs text-foreground-muted mt-2">
                      Created: {new Date(user.createdAt).toLocaleDateString()}
                      {user.lastLoginAt && (
                        <>
                          {' '}
                          · Last login:{' '}
                          {new Date(user.lastLoginAt).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleRole(user.id, user.role)}
                    >
                      {user.role === 'admin' ? 'Make User' : 'Make Admin'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id, user.username)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirm.show}
        onOpenChange={(show) =>
          setDeleteConfirm({ show, id: null, username: '' })
        }
        onConfirm={confirmDeleteUser}
        title="Delete User"
        description={`Are you sure you want to delete user "${deleteConfirm.username}"? This action cannot be undone.`}
        confirmText="Delete User"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  )
}
