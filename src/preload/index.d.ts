import { ElectronAPI } from '@electron-toolkit/preload'
interface ModVersion{
  version: string
  description: string
  name: string
  id: number
  url: string
  createdAt: string
  updatedAt: string
  smods_version?: string
}
interface CompatibilityResult {
  compatible: boolean
  message: string | null
  requiredVersionId: number | null
}

interface API{
  getInstalledModVersions: () => Promise<Array<string>>
  getAvailableModVersions: () => Promise<Array<ModVersion>>
  loadModVersion: (id:number) => Promise<void>
  getSmodsVersion: () => Promise<string | null>
  isLovelyInstalled: () => Promise<boolean>
  checkCompatibility: () => Promise<CompatibilityResult>
  onInstallProgress: (callback: (progress: { status: string, progress?: number }) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
