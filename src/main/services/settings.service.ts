import fs from 'fs-extra'
import path from 'node:path'
import { app } from 'electron'
import { loggerService } from './logger.service'
import os from 'os'

// Define the settings file path in the app's user data directory
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')

// Define the settings interface
interface Settings {
  gameDirectory?: string
  onboardingCompleted?: boolean
  installationTracked?: boolean
  analyticsEnabled?: boolean
  linuxModsDirectory?: string
}

// Default settings
const DEFAULT_SETTINGS: Settings = {
  onboardingCompleted: false,
  analyticsEnabled: true,
  linuxModsDirectory: path.join(
    os.homedir(),
    '.steam',
    'steam',
    'steamapps',
    'compatdata',
    '2379780',
    'pfx',
    'drive_c',
    'users',
    'steamuser',
    'AppData',
    'Roaming',
    'Balatro',
    'Mods'
  )
}

class SettingsService {
  private settings: Settings = DEFAULT_SETTINGS

  constructor() {
    this.loadSettings()
  }

  // Load settings from file
  private loadSettings(): void {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        this.settings = fs.readJSONSync(SETTINGS_FILE)
        loggerService.info('Settings loaded successfully')
      } else {
        // If the file doesn't exist, create it with default settings
        this.saveSettings()
        loggerService.info('Created default settings file')
      }
    } catch (error) {
      loggerService.error('Failed to load settings:', error)
      // If there's an error loading settings, use defaults
      this.settings = DEFAULT_SETTINGS
      this.saveSettings()
    }
  }

  // Save settings to file
  private saveSettings(): void {
    try {
      fs.writeJSONSync(SETTINGS_FILE, this.settings, { spaces: 2 })
      loggerService.info('Settings saved successfully')
    } catch (error) {
      loggerService.error('Failed to save settings:', error)
    }
  }

  // Get a specific setting
  getSetting<K extends keyof Settings>(key: K): Settings[K] | undefined {
    return this.settings[key]
  }

  // Set a specific setting
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settings[key] = value
    this.saveSettings()
  }

  // Get the game directory, either from settings or from default paths
  getGameDirectory(): string | null {
    // First check if a custom directory is set in settings
    const customDir = this.settings.gameDirectory
    if (customDir && fs.existsSync(customDir)) {
      return customDir
    }

    // If no custom directory is set or it doesn't exist, return null
    return null
  }

  // Set the game directory
  setGameDirectory(directory: string): void {
    this.setSetting('gameDirectory', directory)
  }

  // Check if onboarding has been completed
  isOnboardingCompleted(): boolean {
    return !!this.settings.onboardingCompleted
  }

  // Mark onboarding as completed
  setOnboardingCompleted(completed: boolean = true): void {
    this.setSetting('onboardingCompleted', completed)
  }

  // Check if analytics is enabled
  isAnalyticsEnabled(): boolean {
    return this.settings.analyticsEnabled !== false
  }

  // Set analytics enabled/disabled
  setAnalyticsEnabled(enabled: boolean): void {
    this.setSetting('analyticsEnabled', enabled)
  }

  // Get the Linux mods directory, with fallback to default
  getLinuxModsDirectory(): string {
    const customDir = this.settings.linuxModsDirectory
    if (customDir) {
      return customDir
    }
    
    // Return default Linux mods directory path
    return path.join(
      os.homedir(),
      '.steam',
      'steam',
      'steamapps',
      'compatdata',
      '2379780',
      'pfx',
      'drive_c',
      'users',
      'steamuser',
      'AppData',
      'Roaming',
      'Balatro',
      'Mods'
    )
  }

  // Set the Linux mods directory
  setLinuxModsDirectory(directory: string): void {
    this.setSetting('linuxModsDirectory', directory)
  }

  // Get the default Linux mods directory
  getDefaultLinuxModsDirectory(): string {
    return path.join(
      os.homedir(),
      '.steam',
      'steam',
      'steamapps',
      'compatdata',
      '2379780',
      'pfx',
      'drive_c',
      'users',
      'steamuser',
      'AppData',
      'Roaming',
      'Balatro',
      'Mods'
    )
  }

  // Get all settings (for dev mode)
  getAllSettings(): Settings {
    return { ...this.settings }
  }
}

export const settingsService = new SettingsService()
