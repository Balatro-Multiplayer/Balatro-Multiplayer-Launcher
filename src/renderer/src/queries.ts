import { queryOptions } from '@tanstack/react-query'
import { modInstallationService } from '@renderer/servicies/mod-installation.service'
import { settingsService } from '@renderer/servicies/settings.service'

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

export const appVersionQueryOptions = queryOptions({
  queryFn: () => window.api.getAppVersion(),
  queryKey: ['app-version']
})

export const updateStatusQueryOptions = queryOptions({
  queryFn: async () => {
    // This is a placeholder function that will be overridden by the useUpdateStatus hook
    // We need to return a default value here to satisfy TypeScript
    return { status: 'unknown' }
  },
  queryKey: ['update-status']
})

// Settings queries
export const gameDirectoryQueryOptions = queryOptions({
  queryFn: () => settingsService.getGameDirectory(),
  queryKey: ['game-directory']
})

export const defaultGameDirectoryQueryOptions = queryOptions({
  queryFn: () => settingsService.getDefaultGameDirectory(),
  queryKey: ['default-game-directory']
})

export const onboardingCompletedQueryOptions = queryOptions({
  queryFn: () => settingsService.isOnboardingCompleted(),
  queryKey: ['onboarding-completed']
})
