import { spawn, exec } from 'node:child_process'
import * as path from 'node:path'
import * as fs from 'fs-extra'
import { loggerService } from './logger.service'
import { modInstallationService } from './mod-installation.service'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Checks if Steam is currently running
 */
async function isSteamRunning(): Promise<boolean> {
  try {
    await execAsync('pgrep -x steam')
    return true
  } catch {
    return false
  }
}

/**
 * Checks if we can use Steam protocol (xdg-open available)
 */
async function canUseSteamProtocol(): Promise<boolean> {
  try {
    await execAsync('which xdg-open')
    return true
  } catch {
    return false
  }
}

/**
 * Launches the Balatro game
 * @returns A promise that resolves when the game is launched
 */
async function launchGame(): Promise<void> {
  loggerService.info('Launching Balatro game')

  // Get the game directory
  const gameDir = await modInstallationService.getGameDirectory()
  if (!gameDir) {
    throw new Error('Game directory not found. Please set it in settings.')
  }

  // Check if lovely console is enabled
  const lovelyConsoleEnabled = true // Default to enabled for now

  // Create a path object from the game directory
  const gamePath = path.resolve(gameDir)

  // Platform-specific launch logic
  if (process.platform === 'darwin') {
    // macOS code
    const lovelyInstalled = await modInstallationService.isLovelyInstalled()
    const balatroExecutable = path.join(gamePath, 'Balatro.app/Contents/MacOS/love')

    if (lovelyInstalled) {
      // If lovely is installed, use it
      const lovelyPath = path.join(gamePath, 'liblovely.dylib')

      // If the console is disabled, add the flag
      const disableArg = !lovelyConsoleEnabled ? ' --disable-console' : ''

      // Instead of using double quotes which cause conflicts in AppleScript,
      // wrap the file paths in single quotes.
      const commandLine = `cd '${gamePath}' && DYLD_INSERT_LIBRARIES='${lovelyPath}' '${balatroExecutable}'${disableArg}`

      // Construct the AppleScript command to run the command_line in Terminal.
      const applescript = `tell application "Terminal" to do script "${commandLine}"`

      spawn('osascript', ['-e', applescript]).on('error', (err) => {
        loggerService.error('Failed to launch game:', err)
        throw new Error(`Failed to launch game: ${err.message}`)
      })
    } else {
      // If lovely is not installed, launch directly
      spawn(balatroExecutable, [], { cwd: gamePath }).on('error', (err) => {
        loggerService.error('Failed to launch game:', err)
        throw new Error(`Failed to launch game: ${err.message}`)
      })
    }
  } else if (process.platform === 'win32') {
    // Windows code
    // Find the executable file in the directory
    const exePath = findExecutableInDirectory(gamePath)
    if (!exePath) {
      throw new Error(`No executable found in ${gamePath}`)
    }

    const dllPath = path.join(gamePath, 'version.dll')

    // If version.dll doesn't exist, check if lovely is installed
    if (!fs.existsSync(dllPath)) {
      const lovelyInstalled = await modInstallationService.isLovelyInstalled()
      if (!lovelyInstalled) {
        loggerService.info('Lovely not installed, launching game without it')
      }
    }

    // Launch the game
    if (lovelyConsoleEnabled) {
      spawn(exePath, [], { cwd: gamePath }).on('error', (err) => {
        loggerService.error('Failed to launch game:', err)
        throw new Error(`Failed to launch game: ${err.message}`)
      })
    } else {
      spawn(exePath, ['--disable-console'], { cwd: gamePath }).on('error', (err) => {
        loggerService.error('Failed to launch game:', err)
        throw new Error(`Failed to launch game: ${err.message}`)
      })
    }

    loggerService.info(`Launched game from ${exePath}`)
  } else if (process.platform === 'linux') {
    // Linux code - Launch via Steam with Proton
    const BALATRO_STEAM_APP_ID = '2379780'
    
    try {
      // First, try to detect if Steam is running
      const steamRunning = await isSteamRunning()
      if (!steamRunning) {
        loggerService.info('Steam is not running, attempting to start Steam...')
        // Try to start Steam
        spawn('steam', [], { detached: true, stdio: 'ignore' })
        // Wait a bit for Steam to start
        await new Promise(resolve => setTimeout(resolve, 3000))
      }

      // Check if we can launch via Steam protocol
      const steamProtocolAvailable = await canUseSteamProtocol()
      
      if (!steamProtocolAvailable) {
        throw new Error('Steam protocol not available')
      }
      
      // Use steam:// protocol
      const steamUrl = `steam://rungameid/${BALATRO_STEAM_APP_ID}`
      loggerService.info(`Launching Balatro via Steam protocol: ${steamUrl}`)
      loggerService.info('Note: Using Steam launch options configured in Steam client')
      
      spawn('xdg-open', [steamUrl]).on('error', (err) => {
        loggerService.error('Failed to launch via Steam protocol:', err)
        throw new Error(`Failed to launch via Steam protocol: ${err.message}`)
      })
      
      loggerService.info('Successfully launched Balatro on Linux')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to launch Balatro on Linux: ${errorMessage}`)
    }
  } else {
    throw new Error(`Unsupported platform: ${process.platform}`)
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

  // Create a Vec to hold all executable files
  const executables: string[] = []

  // First, collect all executable files in the directory
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

  // First, look for any executable with "balatro" in the name (case-insensitive)
  for (const exe of executables) {
    const fileName = path.basename(exe).toLowerCase()
    if (fileName.includes('balatro')) {
      return exe
    }
  }

  // If no Balatro-specific executable was found, return the first executable
  return executables[0]
}

export const gameLaunchService = {
  launchGame
}
