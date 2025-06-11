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
  onInstallProgress: (callback: (progress: { status: string, progress?: number }) => void) => {
    // Add the event listener
    ipcRenderer.on('mod-installation:progress', (_event, progress) => callback(progress))

    // Return a function to remove the event listener
    return () => {
      ipcRenderer.removeAllListeners('mod-installation:progress')
    }
  }
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
