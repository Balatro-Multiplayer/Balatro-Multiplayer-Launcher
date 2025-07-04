import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gameDirectoryQueryOptions, defaultGameDirectoryQueryOptions, platformQueryOptions, linuxModsDirectoryQueryOptions, defaultLinuxModsDirectoryQueryOptions } from '@renderer/queries'
import { settingsService } from '@renderer/servicies/settings.service'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Alert, AlertDescription } from './ui/alert'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const queryClient = useQueryClient()
  const { data: gameDirectory, isLoading: isLoadingGameDirectory } =
    useQuery(gameDirectoryQueryOptions)
  const { data: defaultGameDirectory } = useQuery(defaultGameDirectoryQueryOptions)
  const { data: platform } = useQuery(platformQueryOptions)
  const { data: linuxModsDirectory } = useQuery(linuxModsDirectoryQueryOptions)
  const { data: defaultLinuxModsDirectory } = useQuery(defaultLinuxModsDirectoryQueryOptions)

  const [customDirectory, setCustomDirectory] = useState<string>('')
  const [linuxModsDirectoryPath, setLinuxModsDirectoryPath] = useState<string>('')

  // Initialize the custom directory input when the dialog opens and data is loaded
  useEffect(() => {
    if (gameDirectory && open) {
      setCustomDirectory(gameDirectory)
    }
  }, [gameDirectory, open])

  // Initialize the Linux mods directory input when the dialog opens and data is loaded
  useEffect(() => {
    if (linuxModsDirectory && open) {
      setLinuxModsDirectoryPath(linuxModsDirectory)
    }
  }, [linuxModsDirectory, open])

  const updateGameDirectoryMutation = useMutation({
    mutationFn: (directory: string) => settingsService.setGameDirectory(directory),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game-directory'] })
      toast.success('Game directory updated successfully')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(`Failed to update game directory: ${error}`)
    }
  })

  const updateLinuxModsDirectoryMutation = useMutation({
    mutationFn: (directory: string) => settingsService.setLinuxModsDirectory(directory),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linux-mods-directory'] })
      if (platform === 'linux') {
        toast.success('Linux mods directory updated successfully')
        onOpenChange(false)
      }
    },
    onError: (error) => {
      if (platform === 'linux') {
        toast.error(`Failed to update Linux mods directory: ${error}`)
      }
    }
  })

  const handleSave = (): void => {
    if (customDirectory) {
      updateGameDirectoryMutation.mutate(customDirectory)
    }
    if (platform === 'linux' && linuxModsDirectoryPath) {
      updateLinuxModsDirectoryMutation.mutate(linuxModsDirectoryPath)
    }
  }

  const handleBrowse = async (): Promise<void> => {
    try {
      const selectedDirectory = await window.api.openDirectoryDialog()
      if (selectedDirectory) {
        setCustomDirectory(selectedDirectory)
      }
    } catch (error) {
      toast.error(`Failed to open directory dialog: ${error}`)
    }
  }

  const handleBrowseLinuxModDirectory = async (): Promise<void> => {
    try {
      const selectedDirectory = await window.api.openDirectoryDialog()
      if (selectedDirectory) {
        setLinuxModsDirectoryPath(selectedDirectory)
      }
    } catch (error) {
      toast.error(`Failed to open directory dialog: ${error}`)
    }
  }

  const handleUseDefault = (): void => {
    if (defaultGameDirectory) {
      setCustomDirectory(defaultGameDirectory)
    } else {
      toast.error('Default game directory not found')
    }
  }

  const handleResetLinuxModsDirectory = (): void => {
    if (defaultLinuxModsDirectory) {
      setLinuxModsDirectoryPath(defaultLinuxModsDirectory)
      toast.success('Reset to default Linux mods directory')
    } else {
      toast.error('Default Linux mods directory not found')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure your game installation directory.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="gameDirectory" className="text-right col-span-1">
              Game Directory
            </Label>
            <div className="col-span-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  id="gameDirectory"
                  value={customDirectory}
                  onChange={(e) => setCustomDirectory(e.target.value)}
                  placeholder={isLoadingGameDirectory ? 'Loading...' : 'Enter game directory path'}
                  className="flex-1"
                  readOnly
                />
                <Button
                  type="button"
                  onClick={handleBrowse}
                  variant="outline"
                  size="sm"
                >
                  Browse
                </Button>
              </div>
              {defaultGameDirectory && (
                <Button variant="outline" size="sm" onClick={handleUseDefault} className="w-full">
                  Use Default Steam Path
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                {defaultGameDirectory
                  ? `Default Steam path: ${defaultGameDirectory}`
                  : 'Default Steam path not detected'}
              </p>
            </div>
          </div>
          {platform && platform.toLowerCase() === 'linux' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="linuxModsDirectory" className="text-right col-span-1">
                Linux Mods Directory
              </Label>
              <div className="col-span-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="linuxModsDirectory"
                    value={linuxModsDirectoryPath}
                    onChange={(e) => setLinuxModsDirectoryPath(e.target.value)}
                    placeholder="Enter Linux mods directory path"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleBrowseLinuxModDirectory}
                    variant="outline"
                    size="sm"
                  >
                    Browse
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleResetLinuxModsDirectory} 
                    className="flex-1"
                  >
                    Reset to Default
                  </Button>
                </div>
                <Alert className="w-full">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> Only modify this if you know what you&apos;re doing. This directory is where mods are installed on Linux systems running Balatro through Proton/Wine. Changing this path incorrectly may cause mod installation issues.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="submit"
            onClick={handleSave}
            disabled={updateGameDirectoryMutation.isPending}
          >
            {updateGameDirectoryMutation.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
