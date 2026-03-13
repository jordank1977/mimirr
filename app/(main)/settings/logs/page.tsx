'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface LogFile {
  name: string
  size: number
  lastModified: string
}

export default function LogsSettingsPage() {
  const [logLevel, setLogLevel] = useState('info')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [logFiles, setLogFiles] = useState<LogFile[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [selectedLog, setSelectedLog] = useState<string | null>(null)
  const [logContent, setLogContent] = useState<string>('')
  const [loadingContent, setLoadingContent] = useState(false)

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

    async function fetchLogFiles() {
      try {
        const response = await fetch('/api/logs')
        if (response.ok) {
          const data = await response.json()
          setLogFiles(data)
          // Auto-select the first log file if available
          if (data.length > 0 && !selectedLog) {
            setSelectedLog(data[0].name)
          }
        }
      } catch (error) {
        console.error('Failed to fetch log files:', error)
      } finally {
        setLoadingLogs(false)
      }
    }

    fetchSettings()
    fetchLogFiles()
  }, [])

  useEffect(() => {
    async function fetchLogContent() {
      if (!selectedLog) {
        setLogContent('')
        return
      }

      setLoadingContent(true)
      try {
        const response = await fetch(`/api/logs/view?file=${encodeURIComponent(selectedLog)}`)
        if (response.ok) {
          const text = await response.text()
          setLogContent(text)
        } else {
          setLogContent(`Error loading log file: ${response.status} ${response.statusText}`)
        }
      } catch (error) {
        console.error('Failed to fetch log content:', error)
        setLogContent('Error loading log content')
      } finally {
        setLoadingContent(false)
      }
    }

    fetchLogContent()
  }, [selectedLog])

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

  const handleViewLog = (filename: string) => {
    window.open(`/api/logs/view?file=${encodeURIComponent(filename)}`, '_blank')
  }

  const handleSelectLog = (filename: string) => {
    setSelectedLog(filename)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
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
        <h2 className="text-xl font-semibold mb-4 text-foreground">Log Files</h2>
        <p className="text-sm text-foreground-muted mb-4">
          Available log files. Click on a row to view its contents below, or use the View button to open in a new tab.
        </p>
        
        {loadingLogs ? (
          <div className="py-4 text-center text-foreground-muted">Loading log files...</div>
        ) : logFiles.length === 0 ? (
          <div className="py-4 text-center text-foreground-muted">No log files found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Filename</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Size</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Last Write Time</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logFiles.map((file) => (
                  <tr 
                    key={file.name} 
                    className={`border-b border-border hover:bg-muted/50 cursor-pointer ${selectedLog === file.name ? 'bg-muted/30' : ''}`}
                    onClick={() => handleSelectLog(file.name)}
                  >
                    <td className="py-3 px-4 text-sm text-foreground">{file.name}</td>
                    <td className="py-3 px-4 text-sm text-foreground-muted">{formatFileSize(file.size)}</td>
                    <td className="py-3 px-4 text-sm text-foreground-muted">{formatDate(file.lastModified)}</td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewLog(file.name)}
                        className="text-xs"
                      >
                        View in New Tab
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedLog && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium text-foreground">Log Content: {selectedLog}</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewLog(selectedLog)}
                className="text-xs"
              >
                Open in New Tab
              </Button>
            </div>
            <div className="border border-border rounded-md bg-background">
              {loadingContent ? (
                <div className="p-4 text-center text-foreground-muted">Loading log content...</div>
              ) : (
                <pre className="p-4 overflow-auto max-h-[500px] text-sm text-foreground whitespace-pre-wrap">
                  {logContent || 'No content available'}
                </pre>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
