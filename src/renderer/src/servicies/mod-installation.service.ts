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
}

export const modInstallationService = new ModInstallationService()
