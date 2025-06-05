import { queryOptions } from '@tanstack/react-query'
import { modInstallationService } from '@renderer/servicies/mod-installation.service'

export const installedModVersionsQueryOptions = queryOptions({
  queryFn: () => modInstallationService.getInstalledModVersions(),
  queryKey: ['installed-mod-versions']
})

export const availableModVersionsQueryOptions = queryOptions({
  queryFn: () => modInstallationService.getAvailableModVersions(),
  queryKey: ['available-mod-versions']
})
