import fs from 'fs-extra'
import path from 'node:path'
import { app } from 'electron'
import { loggerService } from './logger.service'

// Define the settings file path in the app's user data directory
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')

// Define the settings interface
interface Settings {
  gameDirectory?: string
}

// Default settings
const DEFAULT_SETTINGS: Settings = {}

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
}

export const settingsService = new SettingsService()
