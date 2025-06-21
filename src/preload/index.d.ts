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
  lovely_version?: string
  branchId: number
  branchName: string
}
interface CompatibilityResult {
  compatible: boolean
  message: string | null
  requiredVersionId: number | null
}

interface Logger {
  info: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
  error: (message: string | Error, ...args: any[]) => void
  debug: (message: string, ...args: any[]) => void
  getLogFilePath: () => Promise<string>
  getAllLogs: () => Promise<string>
}

interface UpdateStatus {
  status: string
  version?: string
  progress?: {
    bytesPerSecond: number
    percent: number
    transferred: number
    total: number
  }
  error?: string
  [key: string]: any
}

interface API {
  getInstalledModVersions: () => Promise<Array<string>>
  getAvailableModVersions: () => Promise<Array<ModVersion>>
  loadModVersion: (id:number) => Promise<void>
  getSmodsVersion: () => Promise<string | null>
  isLovelyInstalled: () => Promise<boolean>
  checkCompatibility: () => Promise<CompatibilityResult>
  keepSelectedVersion: (version: string) => Promise<string | undefined>
  onInstallProgress: (callback: (progress: { status: string, progress?: number }) => void) => () => void
  // Update service APIs
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => void
  getAppVersion: () => Promise<string>
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
  logger: Logger
  getGameDirectory: () => Promise<string | null>
  setGameDirectory: (directory: string) => Promise<boolean>
  openDirectoryDialog: () => Promise<string | null>
  getDefaultGameDirectory: () => Promise<string | null>
  isOnboardingCompleted: () => Promise<boolean>
  setOnboardingCompleted: (completed?: boolean) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
