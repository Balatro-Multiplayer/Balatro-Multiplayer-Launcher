class SettingsService {
  // Get the game directory from settings
  async getGameDirectory(): Promise<string | null> {
    return window.api.getGameDirectory()
  }

  // Set the game directory in settings
  async setGameDirectory(directory: string): Promise<boolean> {
    return window.api.setGameDirectory(directory)
  }

  // Get the default game directory based on platform
  async getDefaultGameDirectory(): Promise<string | null> {
    return window.api.getDefaultGameDirectory()
  }

  // Check if onboarding has been completed
  async isOnboardingCompleted(): Promise<boolean> {
    return window.api.isOnboardingCompleted()
  }

  // Mark onboarding as completed
  async setOnboardingCompleted(completed: boolean = true): Promise<void> {
    return window.api.setOnboardingCompleted(completed)
  }
}

export const settingsService = new SettingsService()
