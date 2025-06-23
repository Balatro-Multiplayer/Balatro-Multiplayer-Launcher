class ModInstallationService {
  getInstalledModVersions() {
    return window.api.getInstalledModVersions()
  }
  getAvailableModVersions() {
    return window.api.getAvailableModVersions()
  }
  loadModVersion(id: number, forceDownload: boolean = false) {
    return window.api.loadModVersion(id, forceDownload)
  }
  getSmodsVersion() {
    return window.api.getSmodsVersion()
  }
  isLovelyInstalled() {
    return window.api.isLovelyInstalled()
  }
  checkCompatibility() {
    return window.api.checkCompatibility()
  }
  launchGame() {
    return window.api.launchGame()
  }
}

export const modInstallationService = new ModInstallationService()
