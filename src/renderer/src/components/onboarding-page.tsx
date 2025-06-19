import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gameDirectoryQueryOptions, defaultGameDirectoryQueryOptions } from '@renderer/queries'
import { settingsService } from '@renderer/servicies/settings.service'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { toast } from 'sonner'

export function OnboardingPage() {
  const queryClient = useQueryClient()
  const { data: gameDirectory, isLoading: isLoadingGameDirectory } =
    useQuery(gameDirectoryQueryOptions)
  const { data: defaultGameDirectory } = useQuery(defaultGameDirectoryQueryOptions)

  const [customDirectory, setCustomDirectory] = useState<string>('')

  // Initialize the custom directory input when data is loaded
  useEffect(() => {
    if (gameDirectory) {
      setCustomDirectory(gameDirectory)
    } else if (defaultGameDirectory) {
      setCustomDirectory(defaultGameDirectory)
    }
  }, [gameDirectory, defaultGameDirectory])

  const updateGameDirectoryMutation = useMutation({
    mutationFn: async (directory: string) => {
      const success = await settingsService.setGameDirectory(directory)
      if (success) {
        // Mark onboarding as completed
        await settingsService.setOnboardingCompleted(true)
      }
      return success
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game-directory'] })
      queryClient.invalidateQueries({ queryKey: ['onboarding-completed'] })
      toast.success('Game directory set successfully')
    },
    onError: (error) => {
      toast.error(`Failed to set game directory: ${error}`)
    }
  })

  const handleSave = () => {
    if (customDirectory) {
      updateGameDirectoryMutation.mutate(customDirectory)
    } else {
      toast.error('Please enter a game directory')
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
    <div className="flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border rounded-lg shadow-sm p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome to Balatro Multiplayer Launcher!
            </h1>
            <p className="text-muted-foreground mt-2">
              To get started, please set your Balatro game directory.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gameDirectory">Game Directory</Label>
              <Input
                id="gameDirectory"
                value={customDirectory}
                onChange={(e) => setCustomDirectory(e.target.value)}
                placeholder={isLoadingGameDirectory ? 'Loading...' : 'Enter game directory path'}
                className="w-full"
              />
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

            <Button
              className="w-full mt-4"
              onClick={handleSave}
              disabled={updateGameDirectoryMutation.isPending}
            >
              {updateGameDirectoryMutation.isPending ? 'Saving...' : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
