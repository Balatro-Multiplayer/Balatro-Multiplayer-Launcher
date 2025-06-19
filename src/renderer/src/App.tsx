import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  availableModVersionsQueryOptions,
  installedModVersionsQueryOptions,
  smodsVersionQueryOptions,
  lovelyInstalledQueryOptions,
  compatibilityQueryOptions
} from '@renderer/queries'
import { RefreshCcw, Info, ChevronRight, CheckCircle2, RotateCw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { useState, useMemo, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { modInstallationService } from '@renderer/servicies/mod-installation.service'
import { toast } from 'sonner'
import { useUpdateStatus } from './hooks/use-update-status'
import { Header } from './components/header'
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
  const smodsVersion = useQuery(smodsVersionQueryOptions)
  const lovelyInstalled = useQuery(lovelyInstalledQueryOptions)
  const compatibility = useQuery(compatibilityQueryOptions)
  const { data: updateStatus } = useUpdateStatus()
  const queryClient = useQueryClient()

  const loadModVersion = useMutation({
    mutationFn: ({ id, forceDownload = false }: { id: number; forceDownload?: boolean }) =>
      modInstallationService.loadModVersion(id, forceDownload),
    onMutate: ({ forceDownload }) => {
      // Show loading toast when mutation starts
      return toast.loading(
        forceDownload ? 'Reinstallation in progress...' : 'Installation in progress...'
      )
    },
    onSuccess: (_, { forceDownload }, toastId) => {
      // Show success toast and dismiss loading toast
      toast.dismiss(toastId)
      toast.success(
        forceDownload
          ? 'Reinstallation completed successfully'
          : 'Installation completed successfully'
      )

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: installedModVersionsQueryOptions.queryKey })
      queryClient.invalidateQueries({ queryKey: smodsVersionQueryOptions.queryKey })
      queryClient.invalidateQueries({ queryKey: lovelyInstalledQueryOptions.queryKey })
      queryClient.invalidateQueries({ queryKey: compatibilityQueryOptions.queryKey })
    },
    onError: (error, { forceDownload }, toastId) => {
      // Show error toast and dismiss loading toast
      toast.dismiss(toastId)
      toast.error(forceDownload ? 'Reinstallation failed' : 'Installation failed')
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
  const [showAllMainVersions, setShowAllMainVersions] = useState<boolean>(false) // State to control showing all main branch versions

  // Semver comparison function that handles extra info
  const compareSemver = useCallback((a: string, b: string) => {
    // Extract semver part (ignoring extra info after hyphen)
    const getSemverPart = (version: string) => {
      const match = version.match(/^(\d+\.\d+\.\d+)/)
      return match ? match[1] : version
    }

    const semverA = getSemverPart(a)
    const semverB = getSemverPart(b)

    // Split into components
    const partsA = semverA.split('.').map(Number)
    const partsB = semverB.split('.').map(Number)

    // Compare major version
    if (partsA[0] !== partsB[0]) return partsB[0] - partsA[0]

    // Compare minor version
    if (partsA[1] !== partsB[1]) return partsB[1] - partsA[1]

    // Compare patch version
    if (partsA[2] !== partsB[2]) return partsB[2] - partsA[2]

    // If semver parts are equal, compare the full strings
    // This handles extra info (e.g., -SPEED suffix)
    return b.localeCompare(a)
  }, [])

  // Group versions by branch and sort them in descending order
  const versionsByBranch = useMemo(() => {
    if (!availableVersions.data) return {}

    const result = availableVersions.data.reduce(
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

    // Sort versions in each branch in descending order
    Object.values(result).forEach((branch) => {
      branch.versions.sort((a, b) => compareSemver(a.version, b.version))
    })

    return result
  }, [availableVersions.data, compareSemver])

  if (installedVersions.isLoading) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            <p className="text-lg text-muted-foreground">Loading your mod information...</p>
          </div>
        </div>
      </>
    )
  }

  if (versions && versions.length > 1) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4">
          <div className="space-y-6">
            <div className="bg-destructive/10 border border-destructive rounded-md p-4 text-destructive">
              <h2 className="text-lg font-semibold mb-2">⚠️ Warning: Multiple Versions Detected</h2>
              <p className="mb-4">
                You have multiple versions of the Multiplayer Mod installed. This will most likely
                cause the game to crash upon startup. Please select the version you want to keep:
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
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4">
        {/* Compatibility Warning */}
        {!compatibility.isLoading && compatibility.data && !compatibility.data.compatible && (
          <div className="bg-destructive/10 border border-destructive rounded-md p-4 mb-6">
            <h2 className="text-lg font-semibold mb-2">⚠️ Warning: Compatibility Issue</h2>
            <p className="mb-4">{compatibility.data.message}</p>
            {compatibility.data.requiredVersionId && installedVersionId && (
              <Button
                className="w-full"
                onClick={() => {
                  loadModVersion.mutate({ id: installedVersionId })
                }}
              >
                Install Compatible Version
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Current Installation Card */}
          <Card className="col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Current Installation</CardTitle>
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
                  <span className="sr-only">Refresh</span>
                </Button>
              </div>
              <CardDescription>Your currently installed components</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Multiplayer Mod</h3>
                <div className="flex items-center">
                  {installedVersions.data?.[0] ? (
                    <>
                      <span className="text-base">{installedVersions.data[0]}</span>
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
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
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
                    <span className="text-muted-foreground">Not installed</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">SMods</h3>
                <div>
                  {smodsVersion.isLoading ? (
                    <span className="text-muted-foreground text-sm">Loading...</span>
                  ) : smodsVersion.data ? (
                    <span className="text-base">{smodsVersion.data}</span>
                  ) : (
                    <span className="text-muted-foreground">Not installed</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Lovely</h3>
                <div>
                  {lovelyInstalled.isLoading ? (
                    <span className="text-muted-foreground text-sm">Loading...</span>
                  ) : lovelyInstalled.data ? (
                    <span className="text-base">Installed</span>
                  ) : (
                    <span className="text-muted-foreground">Not installed</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Available Versions Section */}
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Available Versions</CardTitle>
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
                  <span className="sr-only">Refresh</span>
                </Button>
              </div>
              <CardDescription>Select a version of the multiplayer mod to install</CardDescription>
            </CardHeader>
            <CardContent>
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
                      <TabsTrigger
                        key={branch.id}
                        value={branch.id}
                        className="flex items-center gap-1"
                      >
                        {branch.id === '1' && <CheckCircle2 className="h-3 w-3" />}
                        {branch.id === '1' ? 'Main' : branch.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {Object.values(versionsByBranch).map((branch) => (
                    <TabsContent key={branch.id} value={branch.id} className="mt-0">
                      {branch.id === '1' && !showAllMainVersions && branch.versions.length > 0 ? (
                        // For main branch, show only the latest version by default
                        <div>
                          <Card
                            key={branch.versions[0].id}
                            className={`cursor-pointer transition-all mb-4 ${
                              selectedVersion === branch.versions[0].id.toString()
                                ? 'border-primary'
                                : 'hover:border-primary/50'
                            }`}
                            onClick={() => setSelectedVersion(branch.versions[0].id.toString())}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <CardTitle className="text-lg">
                                    {branch.versions[0].name}
                                  </CardTitle>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    <Badge
                                      variant="secondary"
                                      className="bg-primary/10 hover:bg-primary/10"
                                    >
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Latest Version
                                    </Badge>
                                    {versions?.[0] === branch.versions[0].version && (
                                      <Badge
                                        variant="outline"
                                        className="border-green-500 text-green-500"
                                      >
                                        Installed
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <CardDescription className="text-xs text-muted-foreground mt-2">
                                Version: {branch.versions[0].version} • Released:{' '}
                                {new Date(branch.versions[0].createdAt).toLocaleDateString()}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              {branch.versions[0].description ? (
                                <>
                                  <p className="text-sm line-clamp-2">
                                    {branch.versions[0].description}
                                  </p>
                                  {branch.versions[0].description.length > 100 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="mt-2 p-0 h-auto text-xs flex items-center text-primary"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedVersionForModal(branch.versions[0].id)
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
                              {versions?.[0] === branch.versions[0].version ? (
                                <div className="w-full space-y-2">
                                  <Button
                                    className="w-full"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      loadModVersion.mutate({
                                        id: branch.versions[0].id,
                                        forceDownload: true
                                      })
                                    }}
                                  >
                                    Reinstall {branch.versions[0].name}
                                  </Button>
                                  <p className="text-xs text-center text-muted-foreground">
                                    Reinstall from server if the mod is corrupted
                                  </p>
                                </div>
                              ) : (
                                <Button
                                  className="w-full"
                                  variant={
                                    selectedVersion === branch.versions[0].id.toString()
                                      ? 'default'
                                      : 'outline'
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    loadModVersion.mutate({ id: branch.versions[0].id })
                                  }}
                                >
                                  Install {branch.versions[0].name}
                                </Button>
                              )}
                            </CardFooter>
                          </Card>

                          {branch.versions.length > 1 && (
                            <div className="flex justify-center mb-4">
                              <Button
                                variant="outline"
                                onClick={() => setShowAllMainVersions(true)}
                                className="flex items-center gap-2"
                              >
                                <ChevronRight className="h-4 w-4" />
                                Show More Versions ({branch.versions.length - 1} more)
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        // For other branches or when showing all main branch versions
                        <div>
                          {branch.id === '1' && showAllMainVersions && (
                            <div className="flex justify-end mb-4">
                              <Button
                                variant="outline"
                                onClick={() => setShowAllMainVersions(false)}
                                className="flex items-center gap-2"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Show Only Latest Version
                              </Button>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            {branch.versions.map((version, index) => (
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
                                    <div>
                                      <CardTitle className="text-lg">{version.name}</CardTitle>
                                      <div className="flex flex-wrap gap-2 mt-1">
                                        {branch.id === '1' && index === 0 && (
                                          <Badge
                                            variant="secondary"
                                            className="bg-primary/10 hover:bg-primary/10"
                                          >
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            Latest Version
                                          </Badge>
                                        )}
                                        {versions?.[0] === version.version && (
                                          <Badge
                                            variant="outline"
                                            className="border-green-500 text-green-500"
                                          >
                                            Installed
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <CardDescription className="text-xs text-muted-foreground mt-2">
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
                                  {versions?.[0] === version.version ? (
                                    <div className="w-full space-y-2">
                                      <Button
                                        className="w-full"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          loadModVersion.mutate({
                                            id: version.id,
                                            forceDownload: true
                                          })
                                        }}
                                      >
                                        Reinstall {version.name}
                                      </Button>
                                      <p className="text-xs text-center text-muted-foreground">
                                        Reinstall from server if the mod is corrupted
                                      </p>
                                    </div>
                                  ) : (
                                    <Button
                                      className="w-full"
                                      variant={
                                        selectedVersion === version.id.toString()
                                          ? 'default'
                                          : 'outline'
                                      }
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        loadModVersion.mutate({ id: version.id })
                                      }}
                                    >
                                      Install {version.name}
                                    </Button>
                                  )}
                                </CardFooter>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Description Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl">
            {selectedVersionForModal &&
              (() => {
                const version = availableVersions.data?.find(
                  (v) => v.id === selectedVersionForModal
                )
                return version ? (
                  <>
                    <DialogHeader>
                      <div className="flex items-center gap-2">
                        <DialogTitle>{version.name}</DialogTitle>
                        {versions?.[0] === version.version && (
                          <Badge variant="outline" className="border-green-500 text-green-500">
                            Installed
                          </Badge>
                        )}
                      </div>
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
                      {versions?.[0] === version.version ? (
                        <>
                          <Button
                            onClick={() => {
                              setModalOpen(false)
                              loadModVersion.mutate({ id: version.id, forceDownload: true })
                            }}
                          >
                            Reinstall This Version
                          </Button>
                          <DialogClose asChild>
                            <Button variant="outline" className="ml-2">
                              Close
                            </Button>
                          </DialogClose>
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={() => {
                              setModalOpen(false)
                              loadModVersion.mutate({ id: version.id })
                            }}
                          >
                            Install This Version
                          </Button>
                          <DialogClose asChild>
                            <Button variant="outline" className="ml-2">
                              Close
                            </Button>
                          </DialogClose>
                        </>
                      )}
                    </div>
                  </>
                ) : null
              })()}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}

export default App
