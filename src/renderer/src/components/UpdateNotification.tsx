import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { toast } from 'sonner'
import { RefreshCcw, Download, RotateCw } from 'lucide-react'

interface UpdateStatus {
  status: string
  version?: string
  progress?: {
    bytesPerSecond: number
    percent: number
    transferred: number
    total: number
  }
  error?: string
}

export function UpdateNotification() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  // Check for updates when the component mounts
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        setIsChecking(true)
        await window.api.checkForUpdates()
      } catch (error) {
        console.error('Error checking for updates:', error)
        toast.error('Failed to check for updates')
      } finally {
        setIsChecking(false)
      }
    }

    // Set up the update status listener
    const removeListener = window.api.onUpdateStatus((status) => {
      setUpdateStatus(status)

      // Show toast notifications for different update statuses
      switch (status.status) {
        case 'update-available':
          toast.info(`Update available: v${status.version}`)
          break
        case 'update-not-available':
          toast.info('No updates available')
          break
        case 'update-downloaded':
          toast.success(`Update downloaded: v${status.version}. Restart to install.`)
          break
        case 'error':
          toast.error(`Update error: ${status.error}`)
          break
      }

      // Update downloading state
      if (status.status === 'downloading' || status.status === 'download-progress') {
        setIsDownloading(true)
      } else {
        setIsDownloading(false)
      }
    })

    // Check for updates on component mount
    checkForUpdates()

    // Clean up the listener when the component unmounts
    return () => {
      removeListener()
    }
  }, [])

  // Handle download button click
  const handleDownload = async () => {
    try {
      await window.api.downloadUpdate()
    } catch (error) {
      console.error('Error downloading update:', error)
      toast.error('Failed to download update')
    }
  }

  // Handle install button click
  const handleInstall = () => {
    try {
      window.api.installUpdate()
    } catch (error) {
      console.error('Error installing update:', error)
      toast.error('Failed to install update')
    }
  }

  // Handle check for updates button click
  const handleCheckForUpdates = async () => {
    try {
      setIsChecking(true)
      await window.api.checkForUpdates()
    } catch (error) {
      console.error('Error checking for updates:', error)
      toast.error('Failed to check for updates')
    } finally {
      setIsChecking(false)
    }
  }

  // If there's no update status or the status is not update-related, don't render anything
  if (
    !updateStatus ||
    (updateStatus.status !== 'update-available' &&
      updateStatus.status !== 'download-progress' &&
      updateStatus.status !== 'update-downloaded')
  ) {
    return null
  }

  return (
    <div className="bg-card border border-border rounded-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Application Update</h2>

      {updateStatus.status === 'update-available' && (
        <div className="space-y-4">
          <div className="bg-primary/5 rounded-md p-4">
            <p className="text-sm text-muted-foreground mb-1">New Version Available:</p>
            <p className="text-lg font-medium">v{updateStatus.version}</p>
          </div>
          <Button
            className="w-full flex items-center justify-center gap-2"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            <Download className="h-4 w-4" />
            <span>Download Update</span>
          </Button>
        </div>
      )}

      {updateStatus.status === 'download-progress' && updateStatus.progress && (
        <div className="space-y-4">
          <div className="bg-primary/5 rounded-md p-4">
            <p className="text-sm text-muted-foreground mb-1">Downloading Update:</p>
            <div className="w-full bg-secondary rounded-full h-2.5 mb-2">
              <div
                className="bg-primary h-2.5 rounded-full"
                style={{ width: `${Math.round(updateStatus.progress.percent)}%` }}
              ></div>
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(updateStatus.progress.percent)}% -
              {(updateStatus.progress.transferred / 1048576).toFixed(2)} MB /
              {(updateStatus.progress.total / 1048576).toFixed(2)} MB
            </p>
          </div>
        </div>
      )}

      {updateStatus.status === 'update-downloaded' && (
        <div className="space-y-4">
          <div className="bg-primary/5 rounded-md p-4">
            <p className="text-sm text-muted-foreground mb-1">Update Ready to Install:</p>
            <p className="text-lg font-medium">v{updateStatus.version}</p>
          </div>
          <Button
            className="w-full flex items-center justify-center gap-2"
            onClick={handleInstall}
            variant="default"
          >
            <RotateCw className="h-4 w-4" />
            <span>Restart and Install</span>
          </Button>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCheckForUpdates}
          disabled={isChecking}
          className="flex items-center gap-2"
          title="Check for updates"
        >
          <RefreshCcw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
          <span>Check for Updates</span>
        </Button>
      </div>
    </div>
  )
}
