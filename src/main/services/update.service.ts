import { BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { loggerService } from './logger.service'

// Configure auto-updater
autoUpdater.logger = loggerService
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

class UpdateService {
  private mainWindow: BrowserWindow | null = null

  /**
   * Initialize the update service
   * @param mainWindow The main browser window
   */
  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow

    // Check for updates immediately when the app starts
    this.checkForUpdates()

    // Set up event listeners for auto-updater
    this.setupAutoUpdaterEvents()
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      loggerService.info('Skipping update check in development mode')
      return
    }

    try {
      loggerService.info('Checking for updates...')
      await autoUpdater.checkForUpdates()
    } catch (error) {
      loggerService.error('Error checking for updates:', error)
      this.sendStatusToWindow('error', { error: (error as Error).message })
    }
  }

  /**
   * Download the update
   */
  async downloadUpdate(): Promise<void> {
    try {
      loggerService.info('Downloading update...')
      this.sendStatusToWindow('downloading')
      await autoUpdater.downloadUpdate()
    } catch (error) {
      loggerService.error('Error downloading update:', error)
      this.sendStatusToWindow('error', { error: (error as Error).message })
    }
  }

  /**
   * Install the update
   */
  installUpdate(): void {
    loggerService.info('Installing update...')
    autoUpdater.quitAndInstall(false, true)
  }

  /**
   * Set up event listeners for auto-updater
   */
  private setupAutoUpdaterEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      loggerService.info('Checking for update...')
      this.sendStatusToWindow('checking')
    })

    autoUpdater.on('update-available', (info) => {
      loggerService.info('Update available:', info)
      this.sendStatusToWindow('update-available', { version: info.version })
    })

    autoUpdater.on('update-not-available', (info) => {
      loggerService.info('Update not available:', info)
      this.sendStatusToWindow('update-not-available')
    })

    autoUpdater.on('download-progress', (progressObj) => {
      const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`
      loggerService.info(message)
      this.sendStatusToWindow('download-progress', { progress: progressObj })
    })

    autoUpdater.on('update-downloaded', (info) => {
      loggerService.info('Update downloaded:', info)
      this.sendStatusToWindow('update-downloaded', { version: info.version })
    })

    autoUpdater.on('error', (error) => {
      loggerService.error('Error in auto-updater:', error)
      this.sendStatusToWindow('error', { error: error.message })
    })
  }

  /**
   * Send status to the renderer window
   * @param status The status to send
   * @param data Additional data to send
   */
  private sendStatusToWindow(status: string, data: Record<string, any> = {}): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('update-service:status', { status, ...data })
    }
  }
}

export const updateService = new UpdateService()
