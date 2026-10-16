'use client'
import { logToClient } from "@/lib/utils/client-logger"

import { useState, useEffect, useRef, useCallback } from 'react'
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
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [tailLines, setTailLines] = useState<number>(500)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)
  const logContainerRef = useRef<HTMLPreElement>(null)

  // 250ms debounce for search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchLogContent = useCallback(async (isAutoRefresh = false) => {
    if (!selectedLog) {
      setLogContent('')
      return
    }

    if (!isAutoRefresh) setLoadingContent(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        file: selectedLog,
        tail: String(tailLines),
      })
      if (levelFilter) {
        params.set('level', levelFilter)
      }
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim())
      }

      const response = await fetch(`/api/logs/view?${params.toString()}`)
      if (response.ok) {
        const text = await response.text()

        // Check scroll position before updating content
        const container = logContainerRef.current
        let isAtBottom = true
        if (container) {
          const threshold = 10 // pixels
          isAtBottom = Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) <= threshold
        }

        setLogContent(text)

        // Only auto-scroll if user was already at the bottom
        if (isAtBottom && container) {
          setTimeout(() => {
            if (logContainerRef.current) {
              logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
            }
          }, 0)
        }
      } else {
        if (!isAutoRefresh) setLogContent(`Error loading log file: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      logToClient('error', 'Failed to fetch log content:', { error: error instanceof Error ? error.message : error })
      if (!isAutoRefresh) setLogContent('Error loading log content')
    } finally {
      if (!isAutoRefresh) setLoadingContent(false)
      else setIsRefreshing(false)
    }
  }, [selectedLog, tailLines, levelFilter, debouncedSearch])

  const refreshLogFilesList = useCallback(async () => {
    try {
      const response = await fetch('/api/logs')
      if (response.ok) {
        const data: LogFile[] = await response.json()
        setLogFiles(data)
      }
    } catch {
      // Fail silently on background metadata refresh
    }
  }, [])

  // Deduplicated initial mount fetch
  useEffect(() => {
    async function initSettingsAndLogs() {
      try {
        const [settingsRes, logsRes] = await Promise.all([
          fetch('/api/settings/logs'),
          fetch('/api/logs'),
        ])

        let currentLevel = 'info'
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json()
          currentLevel = settingsData.level || 'info'
          setLogLevel(currentLevel)
        }

        if (logsRes.ok) {
          const filesData: LogFile[] = await logsRes.json()
          setLogFiles(filesData)

          // Auto-select appropriate stream on initial load if no log is selected
          if (filesData.length > 0 && !selectedLog) {
            if (currentLevel === 'debug') {
              const debugFiles = filesData.filter((f) => f.name.includes('debug'))
              if (debugFiles.length > 0) {
                setSelectedLog(debugFiles[0].name)
                return
              }
            }
            const stdFiles = filesData.filter((f) => !f.name.includes('debug'))
            if (stdFiles.length > 0) {
              setSelectedLog(stdFiles[0].name)
            } else {
              setSelectedLog(filesData[0].name)
            }
          }
        }
      } catch (error) {
        logToClient('error', 'Failed to initialize log settings and files:', {
          error: error instanceof Error ? error.message : error,
        })
      } finally {
        setLoading(false)
        setLoadingLogs(false)
      }
    }

    initSettingsAndLogs()
  }, [])

  // Refetch content when selectedLog or viewer controls change
  useEffect(() => {
    fetchLogContent()
  }, [fetchLogContent])

  // Setup auto-polling with silent metadata refresh
  useEffect(() => {
    if (!autoRefresh || !selectedLog) return

    const intervalId = setInterval(() => {
      // Only auto-refresh if the page is visible
      if (document.visibilityState === 'visible') {
        fetchLogContent(true)
        refreshLogFilesList()
      }
    }, 5000)

    return () => clearInterval(intervalId)
  }, [autoRefresh, selectedLog, fetchLogContent, refreshLogFilesList])

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

        // Auto-switch to the appropriate log stream based on the new level
        if (logFiles.length > 0) {
          if (logLevel === 'debug') {
            const debugFiles = logFiles.filter(f => f.name.includes('debug'))
            if (debugFiles.length > 0) {
              setSelectedLog(debugFiles[0].name)
            }
          } else {
            const stdFiles = logFiles.filter(f => !f.name.includes('debug'))
            if (stdFiles.length > 0) {
              setSelectedLog(stdFiles[0].name)
            }
          }
        }
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
    window.open(`/api/logs/view?file=${encodeURIComponent(filename)}&tail=0`, '_blank')
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
                className="w-full h-10 px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
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
          <div className="mt-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-lg font-medium text-foreground flex items-center">
                Log Content: {selectedLog}
                {isRefreshing && <span className="ml-3 text-xs text-foreground-muted animate-pulse">Refreshing...</span>}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoRefresh(prev => !prev)}
                  className={`text-xs ${!autoRefresh ? 'text-amber-500 border-amber-500/50' : ''}`}
                >
                  {autoRefresh ? 'Auto-Refresh: On (5s)' : 'Auto-Refresh: Paused'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchLogContent(false)}
                  className="text-xs"
                  disabled={loadingContent || isRefreshing}
                >
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewLog(selectedLog)}
                  className="text-xs"
                >
                  Open in New Tab
                </Button>
              </div>
            </div>

            {/* Filter & Viewer Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 bg-muted/20 border border-border rounded-md items-center">
              <div className="sm:col-span-6">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by text or [reqId]..."
                  className="w-full h-9 px-3 py-1.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="sm:col-span-3">
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="w-full h-9 px-3 py-1.5 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Levels</option>
                  <option value="debug">Debug+</option>
                  <option value="info">Info+</option>
                  <option value="warn">Warning+</option>
                  <option value="error">Error Only</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <select
                  value={tailLines}
                  onChange={(e) => setTailLines(Number(e.target.value))}
                  className="w-full h-9 px-3 py-1.5 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value={200}>Last 200 lines</option>
                  <option value={500}>Last 500 lines</option>
                  <option value={1000}>Last 1,000 lines</option>
                  <option value={0}>All lines</option>
                </select>
              </div>
            </div>

            <div className="border border-border rounded-md bg-background relative">
              {loadingContent ? (
                <div className="p-4 text-center text-foreground-muted">Loading log content...</div>
              ) : (
                <pre
                  ref={logContainerRef}
                  className="p-4 overflow-auto max-h-[500px] text-sm text-foreground whitespace-pre-wrap font-mono"
                >
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
