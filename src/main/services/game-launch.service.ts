import { spawn, exec } from 'node:child_process'
import * as path from 'node:path'
import * as fs from 'fs-extra'
import { loggerService } from './logger.service'
import { modInstallationService } from './mod-installation.service'
import { promisify } from 'node:util'
import { shell } from 'electron'

const execAsync = promisify(exec)

/**
 * Checks if Steam is currently running
 */
async function isSteamRunning(): Promise<boolean> {
  try {
    switch (process.platform) {
      case 'win32':
        const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq steam.exe" /FO CSV /NH')
        return stdout.toLowerCase().includes('steam.exe')
      
      case 'darwin':
        const { stdout: macStdout } = await execAsync('pgrep -x Steam')
        return macStdout.trim().length > 0
      
      case 'linux':
        const { stdout: linuxStdout } = await execAsync('pgrep -x steam')
        return linuxStdout.trim().length > 0
      
      default:
        return false
    }
  } catch {
    return false
  }
}

/**
 * Checks if we can use Steam protocol
 */
async function canUseSteamProtocol(): Promise<boolean> {
  try {
    switch (process.platform) {
      case 'win32':
        return true
      
      case 'darwin':
        return true
      
      case 'linux':
        await execAsync('which xdg-open')
        return true
      
      default:
        return false
    }
  } catch {
    return false
  }
}

/**
 * Launches Steam if it's not running
 */
async function launchSteam(): Promise<void> {
  loggerService.info('Steam is not running, attempting to start Steam...')
  
  try {
    switch (process.platform) {
      case 'win32':
        spawn('steam.exe', [], { detached: true, stdio: 'ignore' })
        break
      
      case 'darwin':
        spawn('open', ['-a', 'Steam'], { detached: true, stdio: 'ignore' })
        break
      
      case 'linux':
        spawn('steam', [], { detached: true, stdio: 'ignore' })
        break
      
      default:
        throw new Error(`Unsupported platform: ${process.platform}`)
    }
    
    await new Promise((resolve) => setTimeout(resolve, 3000))
  } catch (error) {
    loggerService.error('Failed to start Steam:', error)
    throw error
  }
}

/**
 * Opens a URL using the appropriate method for the platform
 */
async function openUrl(url: string): Promise<void> {
  try {
    switch (process.platform) {
      case 'win32':
        await shell.openExternal(url)
        break
      
      case 'darwin':
        await shell.openExternal(url)
        break
      
      case 'linux':
        spawn('xdg-open', [url]).on('error', (err) => {
          loggerService.error('Failed to launch via Steam protocol:', err)
          throw new Error(`Failed to launch via Steam protocol: ${err.message}`)
        })
        break
      
      default:
        throw new Error(`Unsupported platform: ${process.platform}`)
    }
  } catch (error) {
    loggerService.error('Failed to open URL:', error)
    throw error
  }
}

/**
 * Finds an executable file in the given directory
 * @param dir The directory to search in
 * @returns The path to the executable file, or null if none is found
 */
function findExecutableInDirectory(dir: string): string | null {
  if (!fs.existsSync(dir)) {
    return null
  }

  const executables: string[] = []

  const entries = fs.readdirSync(dir)
  for (const entry of entries) {
    const entryPath = path.join(dir, entry)
    if (fs.statSync(entryPath).isFile() && path.extname(entryPath).toLowerCase() === '.exe') {
      executables.push(entryPath)
    }
  }

  if (executables.length === 0) {
    return null
  }

  for (const exe of executables) {
    const fileName = path.basename(exe).toLowerCase()
    if (fileName.includes('balatro')) {
      return exe
    }
  }

  return executables[0]
}

/**
 * Launches the game directly (backup method for Windows, primary method for macOS)
 */
async function launchGameDirectly(): Promise<void> {
  loggerService.info('Launching Balatro game directly')

  const gameDir = await modInstallationService.getGameDirectory()
  if (!gameDir) {
    throw new Error('Game directory not found. Please set it in settings.')
  }

  const lovelyConsoleEnabled = false
  const gamePath = path.resolve(gameDir)

  if (process.platform === 'darwin') {
    // macOS direct launch with mod support
    const lovelyInstalled = await modInstallationService.isLovelyInstalled()
    const balatroExecutable = path.join(gamePath, 'Balatro.app/Contents/MacOS/love')

    if (lovelyInstalled) {
      const lovelyPath = path.join(gamePath, 'liblovely.dylib')
      const disableArg = !lovelyConsoleEnabled ? ' --disable-console' : ''
      const commandLine = `cd '${gamePath}' && DYLD_INSERT_LIBRARIES='${lovelyPath}' '${balatroExecutable}'${disableArg}`
      const applescript = `tell application "Terminal" to do script "${commandLine}"`

      spawn('osascript', ['-e', applescript]).on('error', (err) => {
        loggerService.error('Failed to launch game:', err)
        throw new Error(`Failed to launch game: ${err.message}`)
      })
    } else {
      spawn(balatroExecutable, [], { cwd: gamePath }).on('error', (err) => {
        loggerService.error('Failed to launch game:', err)
        throw new Error(`Failed to launch game: ${err.message}`)
      })
    }
  } else if (process.platform === 'win32') {
    // Windows direct launch (backup method)
    const exePath = findExecutableInDirectory(gamePath)
    if (!exePath) {
      throw new Error(`No executable found in ${gamePath}`)
    }

    const dllPath = path.join(gamePath, 'version.dll')

    if (!fs.existsSync(dllPath)) {
      const lovelyInstalled = await modInstallationService.isLovelyInstalled()
      if (!lovelyInstalled) {
        loggerService.info('Lovely not installed, launching game without it')
      }
    }

    try {
      if (!lovelyConsoleEnabled) {
        const batchPath = path.join(gamePath, 'launch_balatro.bat')
        const batchContent = `@echo off
cd /d "${gamePath}"
start "" "${exePath}" --disable-console
`
        fs.writeFileSync(batchPath, batchContent)
        await shell.openPath(batchPath)
        loggerService.info('Launched game with --disable-console using batch file')
      } else {
        await shell.openPath(exePath)
        loggerService.info('Launched game directly using shell.openPath')
      }
    } catch (err) {
      loggerService.error('Failed to launch game:', err)
      throw new Error(`Failed to launch game: ${err instanceof Error ? err.message : String(err)}`)
    }

    loggerService.info(`Launched game from ${exePath}`)
  } else {
    throw new Error(`Direct launch not supported on platform: ${process.platform}`)
  }
}

/**
 * Launches the Balatro game
 * @returns A promise that resolves when the game is launched
 */
async function launchGame(): Promise<void> {
  loggerService.info('Launching Balatro game')

  const BALATRO_STEAM_APP_ID = '2379780'

  // macOS always uses direct launch (doesn't support modded version through Steam)
  if (process.platform === 'darwin') {
    await launchGameDirectly()
    return
  }

  // For Windows and Linux, try Steam protocol first, then fallback to direct launch
  try {
    const steamRunning = await isSteamRunning()
    if (!steamRunning) {
      await launchSteam()
    }

    const steamProtocolAvailable = await canUseSteamProtocol()

    if (!steamProtocolAvailable) {
      if (process.platform === 'win32') {
        loggerService.info('Steam protocol not available, falling back to direct launch')
        await launchGameDirectly()
        return
      } else {
        throw new Error('Steam protocol not available')
      }
    }

    const steamUrl = `steam://rungameid/${BALATRO_STEAM_APP_ID}`
    loggerService.info(`Launching Balatro via Steam protocol: ${steamUrl}`)

    await openUrl(steamUrl)

    loggerService.info(`Successfully launched Balatro on ${process.platform}`)
  } catch (error) {
    if (process.platform === 'win32') {
      loggerService.info('Steam protocol failed, falling back to direct launch')
      await launchGameDirectly()
    } else {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to launch Balatro on ${process.platform}: ${errorMessage}`)
    }
  }
}

export const gameLaunchService = {
  launchGame
}
