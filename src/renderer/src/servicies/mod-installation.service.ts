class ModInstallationService {
  getInstalledModVersions() {
    return window.api.getInstalledModVersions()
  }
  getAvailableModVersions() {
    return window.api.getAvailableModVersions()
  }
  loadModVersion(id: number) {
    return window.api.loadModVersion(id)
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
