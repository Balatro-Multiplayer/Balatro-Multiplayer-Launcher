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
}

export const modInstallationService = new ModInstallationService()
