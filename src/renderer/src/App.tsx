import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  availableModVersionsQueryOptions,
  installedModVersionsQueryOptions,
  smodsVersionQueryOptions,
  lovelyInstalledQueryOptions,
  compatibilityQueryOptions
} from '@renderer/queries'
import { RefreshCcw, Info, ChevronRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { useState, useMemo, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { modInstallationService } from '@renderer/servicies/mod-installation.service'
import { toast } from 'sonner'
import { UpdateNotification } from './components/UpdateNotification'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from './components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose
} from './components/ui/dialog'

function App(): React.JSX.Element {
  const installedVersions = useQuery(installedModVersionsQueryOptions)
  const availableVersions = useQuery(availableModVersionsQueryOptions)
  console.log(availableVersions.data)
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
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedVersionForModal, setSelectedVersionForModal] = useState<number | null>(null)
  const [selectedBranchTab, setSelectedBranchTab] = useState<string>('1') // Default to main branch (id: 1)
  const [appVersion, setAppVersion] = useState<string>('')

  // Fetch app version on component mount
  useEffect(() => {
    const fetchAppVersion = async () => {
      try {
        const version = await window.api.getAppVersion()
        setAppVersion(version)
      } catch (error) {
        console.error('Error fetching app version:', error)
      }
    }

    fetchAppVersion()
  }, [])

  // Group versions by branch
  const versionsByBranch = useMemo(() => {
    if (!availableVersions.data) return {}

    return availableVersions.data.reduce(
      (acc, version) => {
        const branchId = version.branchId.toString()
        if (!acc[branchId]) {
          acc[branchId] = {
            id: branchId,
            name: version.branchName,
            versions: []
          }
        }
        acc[branchId].versions.push(version)
        return acc
      },
      {} as Record<string, { id: string; name: string; versions: typeof availableVersions.data }>
    )
  }, [availableVersions.data])

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
      {/* Update Notification */}
      <UpdateNotification />

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
            <p className="text-sm text-muted-foreground mb-1">Launcher Version:</p>
            <p className="text-lg font-medium">{appVersion ? `v${appVersion}` : 'Loading...'}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Multiplayer Mod:</p>
            <p className="text-lg font-medium">
              {installedVersions.data?.[0] ? (
                <>
                  {installedVersions.data[0]}
                  {availableVersions.data &&
                    (() => {
                      const installedVersion = availableVersions.data.find(
                        (v) => v.version === installedVersions.data?.[0]
                      )
                      return installedVersion ? (
                        <Badge
                          variant={installedVersion.branchId === 1 ? 'secondary' : 'outline'}
                          className={`ml-2 ${installedVersion.branchId === 1 ? 'bg-primary/10 hover:bg-primary/10' : 'text-muted-foreground'}`}
                        >
                          {installedVersion.branchId === 1 ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              main
                            </>
                          ) : (
                            installedVersion.branchName
                          )}
                        </Badge>
                      ) : null
                    })()}
                </>
              ) : (
                'Not installed'
              )}
            </p>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Available Versions</h2>
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
        <p className="text-muted-foreground mb-6">
          Select a version of the multiplayer mod to install:
        </p>

        {availableVersions.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : !availableVersions.data?.length ? (
          <div className="text-center py-8 text-muted-foreground">No versions available</div>
        ) : Object.keys(versionsByBranch).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No versions available</div>
        ) : (
          <Tabs
            defaultValue={selectedBranchTab}
            value={selectedBranchTab}
            onValueChange={setSelectedBranchTab}
            className="w-full"
          >
            <TabsList className="mb-4">
              {Object.values(versionsByBranch).map((branch) => (
                <TabsTrigger key={branch.id} value={branch.id} className="flex items-center gap-1">
                  {branch.id === '1' && <CheckCircle2 className="h-3 w-3" />}
                  {branch.id === '1' ? 'Main' : branch.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.values(versionsByBranch).map((branch) => (
              <TabsContent key={branch.id} value={branch.id} className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {branch.versions.map((version) => (
                    <Card
                      key={version.id}
                      className={`cursor-pointer transition-all ${
                        selectedVersion === version.id.toString()
                          ? 'border-primary'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedVersion(version.id.toString())}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">{version.name}</CardTitle>
                        </div>
                        <CardDescription className="text-xs text-muted-foreground">
                          Version: {version.version} • Released:{' '}
                          {new Date(version.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {version.description ? (
                          <>
                            <p className="text-sm line-clamp-2">{version.description}</p>
                            {version.description.length > 100 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 p-0 h-auto text-xs flex items-center text-primary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedVersionForModal(version.id)
                                  setModalOpen(true)
                                }}
                              >
                                <Info className="h-3 w-3 mr-1" />
                                See full description
                                <ChevronRight className="h-3 w-3 ml-1" />
                              </Button>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            No description available
                          </p>
                        )}
                      </CardContent>
                      <CardFooter>
                        <Button
                          className="w-full"
                          variant={
                            selectedVersion === version.id.toString() ? 'default' : 'outline'
                          }
                          onClick={(e) => {
                            e.stopPropagation()
                            loadModVersion.mutate(version.id)
                          }}
                        >
                          Install {version.name}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* Description Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          {selectedVersionForModal &&
            (() => {
              const version = availableVersions.data?.find((v) => v.id === selectedVersionForModal)
              return version ? (
                <>
                  <DialogHeader>
                    <DialogTitle>{version.name}</DialogTitle>
                    <DialogDescription>
                      Version: {version.version} • Released:{' '}
                      {new Date(version.createdAt).toLocaleDateString()}
                      {version.branchId !== 1 && ` • Branch: ${version.branchName}`}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4">
                    <h3 className="text-sm font-medium mb-2">Description:</h3>
                    <div className="text-sm whitespace-pre-wrap">
                      {version.description || 'No description available'}
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button
                      onClick={() => {
                        setModalOpen(false)
                        loadModVersion.mutate(version.id)
                      }}
                    >
                      Install This Version
                    </Button>
                    <DialogClose asChild>
                      <Button variant="outline" className="ml-2">
                        Close
                      </Button>
                    </DialogClose>
                  </div>
                </>
              ) : null
            })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
