import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  availableModVersionsQueryOptions,
  installedModVersionsQueryOptions,
  smodsVersionQueryOptions,
  lovelyInstalledQueryOptions,
  compatibilityQueryOptions
} from '@renderer/queries'
import { RefreshCcw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './components/ui/select'
import { useState } from 'react'
import { modInstallationService } from '@renderer/servicies/mod-installation.service'
import { toast } from 'sonner'

function App(): React.JSX.Element {
  const installedVersions = useQuery(installedModVersionsQueryOptions)
  const availableVersions = useQuery(availableModVersionsQueryOptions)
  const smodsVersion = useQuery(smodsVersionQueryOptions)
  const lovelyInstalled = useQuery(lovelyInstalledQueryOptions)
  const compatibility = useQuery(compatibilityQueryOptions)
  const queryClient = useQueryClient()
  const loadModVersion = useMutation({
    mutationFn: (id: number) => modInstallationService.loadModVersion(id),
    onMutate: () => {
      // Show loading toast when mutation starts
      return toast.loading('Installation in progress...')
    },
    onSuccess: (_, __, toastId) => {
      // Show success toast and dismiss loading toast
      toast.dismiss(toastId)
      toast.success('Installation completed successfully')

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: installedModVersionsQueryOptions.queryKey })
      queryClient.invalidateQueries({ queryKey: smodsVersionQueryOptions.queryKey })
      queryClient.invalidateQueries({ queryKey: lovelyInstalledQueryOptions.queryKey })
      queryClient.invalidateQueries({ queryKey: compatibilityQueryOptions.queryKey })
    },
    onError: (error, _, toastId) => {
      // Show error toast and dismiss loading toast
      toast.dismiss(toastId)
      toast.error('Installation failed')
      window.api.logger.error('Installation error:', error)
    }
  })

  const keepSelectedVersion = useMutation({
    mutationFn: (version: string) => window.api.keepSelectedVersion(version),
    onMutate: () => {
      // Show loading toast when mutation starts
      return toast.loading('Processing version selection...')
    },
    onSuccess: (_, __, toastId) => {
      // Show success toast and dismiss loading toast
      toast.dismiss(toastId)
      toast.success('Version selected successfully')

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: installedModVersionsQueryOptions.queryKey })
    },
    onError: (error, _, toastId) => {
      // Show error toast and dismiss loading toast
      toast.dismiss(toastId)
      toast.error('Failed to select version')
      console.error('Version selection error:', error)
    }
  })
  const versions = installedVersions?.data
  const installedVersionId = availableVersions?.data?.find(
    (version) => version.version === versions?.[0]
  )?.id

  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)

  if (installedVersions.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="text-lg text-muted-foreground">Loading your mod information...</p>
      </div>
    )
  }
  if (versions && versions.length > 1) {
    return (
      <div className="space-y-6">
        <div className="bg-destructive/10 border border-destructive rounded-md p-4 text-destructive">
          <h2 className="text-lg font-semibold mb-2">⚠️ Warning: Multiple Versions Detected</h2>
          <p className="mb-4">
            You have multiple versions of the Multiplayer Mod installed. This will most likely cause
            the game to crash upon startup. Please select the version you want to keep:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {versions.map((version) => (
            <Button
              variant="outline"
              className="p-4 h-auto flex flex-col items-center justify-center hover:bg-primary/5 hover:border-primary transition-colors"
              key={version}
              onClick={() => keepSelectedVersion.mutate(version)}
            >
              <span className="text-lg font-medium">{version}</span>
              <span className="text-sm text-muted-foreground mt-1">
                Click to select this version
              </span>
            </Button>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-8">
      {/* Compatibility Warning */}
      {!compatibility.isLoading && compatibility.data && !compatibility.data.compatible && (
        <div className="bg-destructive/10 border border-destructive rounded-md p-4 text-destructive mb-8">
          <h2 className="text-lg font-semibold mb-2">⚠️ Warning: Compatibility Issue</h2>
          <p className="mb-4">{compatibility.data.message}</p>
          {compatibility.data.requiredVersionId && installedVersionId && (
            <Button
              className="w-full"
              onClick={() => {
                loadModVersion.mutate(installedVersionId)
              }}
            >
              Install Compatible Version
            </Button>
          )}
        </div>
      )}

      {/* Current Version Section */}
      <div className="bg-card border border-border rounded-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Current Installation</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              installedVersions.refetch()
              smodsVersion.refetch()
              lovelyInstalled.refetch()
              compatibility.refetch()
            }}
            className="flex items-center gap-2"
            title="Refresh installation status"
          >
            <RefreshCcw className="h-4 w-4" />
            <span>Refresh</span>
          </Button>
        </div>

        <div className="bg-primary/5 rounded-md p-4 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Multiplayer Mod:</p>
            <p className="text-lg font-medium">{installedVersions.data?.[0] || 'Not installed'}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">SMods:</p>
            <p className="text-lg font-medium">
              {smodsVersion.isLoading ? (
                <span className="text-muted-foreground text-sm">Loading...</span>
              ) : smodsVersion.data ? (
                smodsVersion.data
              ) : (
                'Not installed'
              )}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Lovely:</p>
            <p className="text-lg font-medium">
              {lovelyInstalled.isLoading ? (
                <span className="text-muted-foreground text-sm">Loading...</span>
              ) : lovelyInstalled.data ? (
                'Installed'
              ) : (
                'Not installed'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Version Selection Section */}
      <div className="bg-card border border-border rounded-md p-6">
        <h2 className="text-xl font-semibold mb-4">Change Version</h2>
        <p className="text-muted-foreground mb-6">
          If you want to use a different version of the multiplayer mod, select it from the dropdown
          below.
        </p>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="version-select" className="text-sm font-medium">
                Available Versions:
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  availableVersions.refetch()
                }}
                className="flex items-center gap-2"
                title="Refresh available versions"
              >
                <RefreshCcw className="h-4 w-4" />
                <span>Refresh</span>
              </Button>
            </div>
            <Select
              value={selectedVersion ?? undefined}
              onValueChange={setSelectedVersion}
              disabled={availableVersions.isLoading || !availableVersions.data?.length}
            >
              <SelectTrigger id="version-select" className="w-full">
                <SelectValue
                  placeholder={
                    availableVersions.isLoading
                      ? 'Loading versions...'
                      : !availableVersions.data?.length
                        ? 'No versions available'
                        : 'Select a version'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableVersions.data?.map((version) => (
                  <SelectItem key={version.id} value={version.id.toString()}>
                    {version.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            disabled={selectedVersion === null}
            onClick={() => {
              if (selectedVersion === null) return
              loadModVersion.mutate(Number.parseInt(selectedVersion, 10))
            }}
          >
            Install Selected Version
          </Button>
        </div>
      </div>
    </div>
  )
}

export default App
