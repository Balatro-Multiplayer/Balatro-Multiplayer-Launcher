import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getInstalledModVersions: () => ipcRenderer.invoke('mod-installation:get-installed-versions'),
  getAvailableModVersions: () => ipcRenderer.invoke('multiplayer-service:get-available-versions'),
  loadModVersion: (id: number) => ipcRenderer.invoke('mod-installation:load-version', id),
  getSmodsVersion: () => ipcRenderer.invoke('mod-installation:get-smods-version'),
  isLovelyInstalled: () => ipcRenderer.invoke('mod-installation:is-lovely-installed'),
  checkCompatibility: () => ipcRenderer.invoke('mod-installation:check-compatibility'),
  keepSelectedVersion: (version: string) => ipcRenderer.invoke('mod-installation:keep-selected-version', version),
  onInstallProgress: (callback: (progress: { status: string; progress?: number }) => void) => {
    // Add the event listener
    ipcRenderer.on('mod-installation:progress', (_event, progress) => callback(progress))

    // Return a function to remove the event listener
    return () => {
      ipcRenderer.removeAllListeners('mod-installation:progress')
    }
  },
  // Update service APIs
  checkForUpdates: () => ipcRenderer.invoke('update-service:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('update-service:download-update'),
  installUpdate: () => ipcRenderer.invoke('update-service:install-update'),
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  onUpdateStatus: (callback: (status: { status: string; [key: string]: any }) => void) => {
    // Add the event listener
    ipcRenderer.on('update-service:status', (_event, status) => callback(status))

    // Return a function to remove the event listener
    return () => {
      ipcRenderer.removeAllListeners('update-service:status')
    }
  },
  // Settings APIs
  getGameDirectory: () => ipcRenderer.invoke('settings:get-game-directory'),
  setGameDirectory: (directory: string) => ipcRenderer.invoke('settings:set-game-directory', directory),
  openDirectoryDialog: () => ipcRenderer.invoke('settings:open-directory-dialog'),
  getDefaultGameDirectory: () => ipcRenderer.invoke('settings:get-default-game-directory'),
  isOnboardingCompleted: () => ipcRenderer.invoke('settings:is-onboarding-completed'),
  setOnboardingCompleted: (completed = true) => ipcRenderer.invoke('settings:set-onboarding-completed', completed),

  // Game launch API
  launchGame: () => ipcRenderer.invoke('game:launch')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
