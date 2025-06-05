import { ElectronAPI } from '@electron-toolkit/preload'
interface ModVersion{
  version: string
  description: string
  name: string
  id: number
  url: string
  createdAt: string
  updatedAt: string
}
interface API{
  getInstalledModVersions: () => Promise<Array<string>>
  getAvailableModVersions: () => Promise<Array<ModVersion>>
  loadModVersion: (id:number) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
