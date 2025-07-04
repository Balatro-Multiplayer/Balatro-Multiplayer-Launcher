import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { join } from 'path'
import * as path from 'path'
import * as os from 'os'
import fs from 'fs-extra'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { modInstallationService } from './services/mod-installation.service'
import { multiplayerService } from './services/multiplayer.service'
import { loggerService } from './services/logger.service'
import { updateService } from './services/update.service'
import { settingsService } from './services/settings.service'
import { gameLaunchService } from './services/game-launch.service'
import { analyticsService } from './services/analytics.service'
// Initialize logger
loggerService.info('Application starting...')
function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Initialize the update service with the main window
  updateService.initialize(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.balatromp.launcher')

  // Track app installation with Plausible Analytics
  analyticsService.trackInstallation().catch(error => {
    loggerService.error('Failed to track installation:', error)
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('mod-installation:get-installed-versions', () =>
    modInstallationService.checkDirectoryForMultiplayerInstallation()
  )
  ipcMain.handle('multiplayer-service:get-available-versions', () =>
    multiplayerService.getAvailableModVersions()
  )
  ipcMain.handle('mod-installation:load-version', (event, id) => {
    // Create a callback function that sends progress events to the renderer
    const progressCallback = (progress: { status: string; progress?: number }) => {
      event.sender.send('mod-installation:progress', progress)
    }
    return modInstallationService.loadModVersion(id, progressCallback)
  })
  ipcMain.handle('mod-installation:get-smods-version', () =>
    modInstallationService.determineSmodsInstalledVersion()
  )
  ipcMain.handle('mod-installation:is-lovely-installed', () =>
    modInstallationService.isLovelyInstalled()
  )
  ipcMain.handle('mod-installation:check-compatibility', () =>
    modInstallationService.checkModCompatibility()
  )

  ipcMain.handle('mod-installation:keep-selected-version', (_, version) =>
    modInstallationService.keepSelectedVersion(version)
  )

  // Logger IPC handlers
  ipcMain.handle('logger:get-log-file-path', () => loggerService.getLogFilePath())
  ipcMain.handle('logger:get-all-logs', () => loggerService.getAllLogs())

  // Update service IPC handlers
  ipcMain.handle('update-service:check-for-updates', () => updateService.checkForUpdates())
  ipcMain.handle('update-service:download-update', () => updateService.downloadUpdate())
  ipcMain.handle('update-service:install-update', () => updateService.installUpdate())

  // App info IPC handlers
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:is-dev', () => is.dev)
  ipcMain.handle('app:get-platform', (): string => process.platform)

  // Settings IPC handlers
  ipcMain.handle('settings:get-game-directory', () => settingsService.getGameDirectory())
  ipcMain.handle('settings:set-game-directory', (_, directory) => {
    settingsService.setGameDirectory(directory)
    return true
  })
  ipcMain.handle('settings:open-directory-dialog', async (event) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender)
    if (!mainWindow) return null

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Balatro Game Directory'
    })

    return canceled ? null : filePaths[0]
  })
  ipcMain.handle('settings:get-default-game-directory', async () => {
    const platform = process.platform
    const defaultPath = {
      win32: path.join(
        os.homedir(),
        'AppData',
        'Roaming',
        'Steam',
        'steamapps',
        'common',
        'Balatro'
      ),
      darwin: path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Steam',
        'steamapps',
        'common',
        'Balatro'
      ),
      linux: path.join(os.homedir(), '.local', 'share', 'Steam', 'steamapps', 'common', 'Balatro')
    }[platform]

    if (defaultPath && (await fs.pathExists(defaultPath))) {
      return defaultPath
    }
    return null
  })

  // Onboarding IPC handlers
  ipcMain.handle('settings:is-onboarding-completed', () => settingsService.isOnboardingCompleted())
  ipcMain.handle('settings:set-onboarding-completed', (_, completed = true) => {
    settingsService.setOnboardingCompleted(completed)
    return true
  })

  // Analytics IPC handlers
  ipcMain.handle('settings:is-analytics-enabled', () => settingsService.isAnalyticsEnabled())
  ipcMain.handle('settings:set-analytics-enabled', (_, enabled = true) => {
    settingsService.setAnalyticsEnabled(enabled)
    return true
  })

  // Dev mode settings IPC handlers
  ipcMain.handle('settings:get-all-settings', () => {
    // Only available in development mode
    if (is.dev) {
      return settingsService.getAllSettings()
    }
    return null
  })
  ipcMain.handle('settings:set-setting', (_, key, value) => {
    // Only available in development mode
    if (is.dev) {
      settingsService.setSetting(key, value)
      return true
    }
    return false
  })

  // Game launch IPC handler
  ipcMain.handle('game:launch', async () => {
    try {
      await gameLaunchService.launchGame()
      return { success: true }
    } catch (error) {
      loggerService.error('Failed to launch game:', error)
      return { success: false, error: error.message }
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
