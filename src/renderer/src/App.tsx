import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  availableModVersionsQueryOptions,
  installedModVersionsQueryOptions
} from '@renderer/queries'
import { RefreshCcw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Layout } from './components/layout'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './components/ui/select'
import { useState } from 'react'
import { modInstallationService } from '@renderer/servicies/mod-installation.service'

function App(): React.JSX.Element {
  const installedVersions = useQuery(installedModVersionsQueryOptions)
  const availableVersions = useQuery(availableModVersionsQueryOptions)
  const queryClient = useQueryClient()
  const loadModVersion = useMutation({
    mutationFn: (id: number) => modInstallationService.loadModVersion(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: installedModVersionsQueryOptions.queryKey })
  })
  const versions = installedVersions?.data
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  if (installedVersions.isLoading) return <>Loading...</>
  if (versions && versions.length > 1) {
    return (
      <Layout>
        You have multiple versions of the Multiplayer Mod installed. This will most likely cause the
        game to crash upon startup. Chose the version you want to use:
        <div className={'grid grid-cols-2 gap-4'}>
          {versions.map((version) => (
            <Button variant={'ghost'} key={version} onClick={() => installedVersions.refetch()}>
              {version}
            </Button>
          ))}
        </div>
      </Layout>
    )
  }
  return (
    <div>
      <div className={'font-bold text-2xl'}>
        Installed Multiplayer Mod version: {installedVersions.data?.[0]}
        <Button variant={'ghost'} onClick={() => installedVersions.refetch()}>
          <RefreshCcw />
        </Button>
      </div>
      <div className={'flex gap-6 items-end mt-6'}>
        <div>
          Select a different version:
          <Select value={selectedVersion ?? undefined} onValueChange={setSelectedVersion}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Version" />
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
          onClick={() => {
            if (selectedVersion === null) return
            loadModVersion.mutate(Number.parseInt(selectedVersion, 10))
          }}
        >
          Load
        </Button>
      </div>
    </div>
  )
}

export default App
