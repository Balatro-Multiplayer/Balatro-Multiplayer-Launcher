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

export const smodsVersionQueryOptions = queryOptions({
  queryFn: () => modInstallationService.getSmodsVersion(),
  queryKey: ['smods-version']
})

export const lovelyInstalledQueryOptions = queryOptions({
  queryFn: () => modInstallationService.isLovelyInstalled(),
  queryKey: ['lovely-installed']
})

export const compatibilityQueryOptions = queryOptions({
  queryFn: () => modInstallationService.checkCompatibility(),
  queryKey: ['mod-compatibility']
})
