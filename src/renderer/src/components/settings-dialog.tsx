import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gameDirectoryQueryOptions, defaultGameDirectoryQueryOptions } from '@renderer/queries'
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

  const [customDirectory, setCustomDirectory] = useState<string>('')

  // Initialize the custom directory input when the dialog opens and data is loaded
  useEffect(() => {
    if (gameDirectory && open) {
      setCustomDirectory(gameDirectory)
    }
  }, [gameDirectory, open])

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

  const handleSave = () => {
    if (customDirectory) {
      updateGameDirectoryMutation.mutate(customDirectory)
    }
  }

  const handleUseDefault = () => {
    if (defaultGameDirectory) {
      setCustomDirectory(defaultGameDirectory)
    } else {
      toast.error('Default game directory not found')
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
              <Input
                id="gameDirectory"
                value={customDirectory}
                onChange={(e) => setCustomDirectory(e.target.value)}
                placeholder={isLoadingGameDirectory ? 'Loading...' : 'Enter game directory path'}
                className="w-full"
              />
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
