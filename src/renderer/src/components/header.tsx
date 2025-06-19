import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { appVersionQueryOptions } from '@renderer/queries'
import { useUpdateStatus } from '@renderer/hooks/use-update-status'
import { Button } from './ui/button'
import { RotateCw, Settings } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { ThemeToggle } from '@renderer/components/ui/theme-toggle'
import { SettingsDialog } from './settings-dialog'

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { data: appVersion } = useQuery(appVersionQueryOptions)
  const { data: updateStatus, installUpdate } = useUpdateStatus()

  // Function to format changelog if available
  const formatChangelog = () => {
    if (!updateStatus?.releaseNotes) return null

    // If it's HTML, extract text content
    if (typeof updateStatus.releaseNotes === 'string' && updateStatus.releaseNotes.includes('<')) {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = updateStatus.releaseNotes
      return tempDiv.textContent || 'Update is ready to install'
    }

    return updateStatus.releaseNotes
  }

  const changelog = formatChangelog()

  return (
    <header className="bg-card border-b border-border p-4 mb-6">
      <div className="container mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Balatro Multiplayer Launcher</h1>
          <p className="text-muted-foreground mt-1">
            Manage your multiplayer mod versions with ease
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Button>
          <ThemeToggle />
          {updateStatus?.status === 'update-downloaded' ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={installUpdate}
                    variant="default"
                    className="flex items-center gap-2"
                  >
                    <RotateCw className="h-4 w-4" />
                    <span>Update to v{updateStatus.version}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <div className="space-y-2">
                    <p className="font-medium">Update is ready to install</p>
                    {changelog ? (
                      <div className="text-sm">
                        <p className="font-medium mb-1">Changes in v{updateStatus.version}:</p>
                        <div className="max-h-60 overflow-y-auto">
                          <p className="whitespace-pre-line">{changelog}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm">Click to restart and install</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  )
}
