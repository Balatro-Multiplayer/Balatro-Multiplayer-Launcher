import fs from 'fs-extra'
import * as os from 'node:os'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { multiplayerService } from './multiplayer.service'
import extract from 'extract-zip'
import { getModsDir } from '../constants'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { loggerService } from './logger.service'
import { settingsService } from './settings.service'

const execAsync = promisify(exec)

// Define VERSION_STORAGE_DIR for all platforms
const VERSION_STORAGE_DIR = {
  win32: path.join(os.homedir(), 'AppData', 'Roaming', 'Balatro', 'ModVersions'),
  darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Balatro', 'ModVersions'),
  linux: path.join(
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
    'ModVersions'
  )
}

// Define common Steam paths for Balatro
const STEAM_GAME_DIR = {
  win32: path.join('C:', 'Program Files (x86)', 'Steam', 'steamapps', 'common', 'Balatro'),
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
}

// Function to determine the game directory
async function getGameDirectory() {
  // First, check if a custom directory is set in settings
  const customDir = settingsService.getGameDirectory()
  if (customDir) {
    return customDir
  }

  // If no custom directory is set, check if the default Steam path exists
  const defaultPath = STEAM_GAME_DIR[platform]
  if (defaultPath && (await fs.pathExists(defaultPath))) {
    return defaultPath
  }

  // If not found, we could implement more sophisticated detection in the future
  // For now, return null to indicate that the game directory couldn't be determined
  return null
}

const platform = os.platform()
const arch = os.arch()
const modsDir = getModsDir(platform)
const versionStorageDir = VERSION_STORAGE_DIR[platform] ?? null

async function checkDirectoryForMultiplayerInstallation(): Promise<Array<string>> {
  const dir = getModsDir(platform)
  if (!dir) {
    throw new Error('Unsupported platform')
  }
  const modsDirExists = fs.existsSync(dir)
  if (!modsDirExists) {
    await fs.ensureDir(dir)
  }

  const versions = await determineMultiplayerInstalledVersion()

  loggerService.info({ dir, modsDirExists, versions })
  loggerService.debug('checkDirectoryForMultiplayerInstallation')
  return versions
}

async function determineMultiplayerInstalledVersion() {
  if (!modsDir) {
    throw new Error('Mods directory not found')
  }

  const dirs = (await fs.readdir(modsDir)).filter((e) =>
    fs.statSync(path.join(modsDir, e)).isDirectory()
  )
  const configs: Array<Record<string, any>> = []
  for (const dir of dirs) {
    const files = await fs.readdir(path.join(modsDir, dir))
    const jsonFile = files.find((e) => e.endsWith('.json'))
    if (jsonFile) {
      const json = await fs.readJSON(path.join(modsDir, dir, jsonFile))
      if (json.id === 'Multiplayer' || json.id === 'NanoMultiplayer') {
        configs.push(json)
      }
    }
  }
  return configs.map((e) => e.version)
}

// Helper function to store installed versions
async function storeInstalledVersions() {
  // Check if a version is already installed
  const installedVersions = await determineMultiplayerInstalledVersion()

  // If a version is already installed, move it to version storage
  if (installedVersions.length > 0) {
    for (const version of installedVersions) {
      // Find the directory containing this version
      const dirs = (await fs.readdir(modsDir)).filter((e) =>
        fs.statSync(path.join(modsDir, e)).isDirectory()
      )

      for (const dir of dirs) {
        const files = await fs.readdir(path.join(modsDir, dir))
        const jsonFile = files.find((e) => e.endsWith('.json'))

        if (jsonFile) {
          const json = await fs.readJSON(path.join(modsDir, dir, jsonFile))

          if (
            (json.id === 'Multiplayer' || json.id === 'NanoMultiplayer') &&
            json.version === version
          ) {
            // Create a version-specific storage directory without timestamp
            const versionDir = path.join(versionStorageDir, `multiplayer-${version}`)

            // Ensure the storage directory exists
            await fs.ensureDir(versionDir)

            // Remove any existing content in the storage directory
            await fs.emptyDir(versionDir)

            // Copy the directory contents to storage
            await fs.copy(path.join(modsDir, dir), versionDir)

            // Remove the original directory
            await fs.remove(path.join(modsDir, dir))

            loggerService.info(`Stored version ${version} in ${versionDir}`)
          }
        }
      }
    }
  }
}

// Function to find all smods installations
async function findAllSmodsInstallations() {
  if (!modsDir) {
    throw new Error('Mods directory not found')
  }

  const smodsInstallations = []

  // Read all directories in the mods folder
  const dirs = (await fs.readdir(modsDir)).filter((e) =>
    fs.statSync(path.join(modsDir, e)).isDirectory()
  )

  // Look for SMods in any directory
  for (const dir of dirs) {
    try {
      const dirPath = path.join(modsDir, dir)
      const files = await fs.readdir(dirPath)

      // First, check for manifest.json that identifies as Steamodded
      const manifestFile = files.find((e) => e.toLowerCase() === 'manifest.json')
      if (manifestFile) {
        const manifestPath = path.join(dirPath, manifestFile)
        const manifest = await fs.readJSON(manifestPath)

        // Check if this is Steamodded by looking at the name field
        if (manifest.name === 'Steamodded') {
          smodsInstallations.push(dirPath)
          continue // Found Steamodded in this directory, no need to check further
        }
      }

      // Fallback to the old method of checking JSON files for id/name
      const jsonFile = files.find((e) => e.endsWith('.json'))
      if (jsonFile) {
        const json = await fs.readJSON(path.join(dirPath, jsonFile))
        // Check if this is SMods by looking for the id field
        if (
          json.id === 'SMods' ||
          json.id === 'smods' ||
          json.name === 'SMods' ||
          json.name === 'smods'
        ) {
          smodsInstallations.push(dirPath)
        }
      }
    } catch (error) {
      loggerService.error(`Error checking directory ${dir} for SMods:`, error)
    }
  }

  return smodsInstallations
}

// Function to check if smods is already installed and get its version
async function determineSmodsInstalledVersion() {
  if (!modsDir) {
    throw new Error('Mods directory not found')
  }

  // Read all directories in the mods folder
  const dirs = (await fs.readdir(modsDir)).filter((e) =>
    fs.statSync(path.join(modsDir, e)).isDirectory()
  )

  // Look for SMods in any directory
  for (const dir of dirs) {
    try {
      const files = await fs.readdir(path.join(modsDir, dir))

      // First, check for manifest.json that identifies as Steamodded
      const manifestFile = files.find((e) => e.toLowerCase() === 'manifest.json')
      if (manifestFile) {
        const manifestPath = path.join(modsDir, dir, manifestFile)
        const manifest = await fs.readJSON(manifestPath)

        // Check if this is Steamodded by looking at the name field
        if (manifest.name === 'Steamodded') {
          // Look for version.lua file
          const versionLuaFile = files.find((e) => e.toLowerCase() === 'version.lua')
          if (versionLuaFile) {
            // Read the version from version.lua
            const versionLuaPath = path.join(modsDir, dir, versionLuaFile)
            const versionLuaContent = await fs.readFile(versionLuaPath, 'utf-8')

            // Extract the version string from the Lua file
            // The format is expected to be: return "1.0.0~BETA-0530b-STEAMODDED"
            const versionMatch = versionLuaContent.match(/return\s*"([^"]+)"/)
            if (versionMatch && versionMatch[1]) {
              return versionMatch[1]
            }

            // If we can't parse the version.lua file, fall back to version_number in manifest
            return manifest.version_number || 'unknown'
          }

          // If no version.lua, use version_number from manifest
          return manifest.version_number || 'unknown'
        }
      }

      // Fallback to the old method of checking JSON files for id/name
      const jsonFile = files.find((e) => e.endsWith('.json'))
      if (jsonFile) {
        const json = await fs.readJSON(path.join(modsDir, dir, jsonFile))
        // Check if this is SMods by looking for the id field
        if (
          json.id === 'SMods' ||
          json.id === 'smods' ||
          json.name === 'SMods' ||
          json.name === 'smods'
        ) {
          return json.version || 'unknown'
        }
      }
    } catch (error) {
      loggerService.error(`Error checking directory ${dir} for SMods:`, error)
    }
  }

  // Also check for the traditional 'smods' directory for backward compatibility
  const smodsDir = path.join(modsDir, 'smods')
  if (await fs.pathExists(smodsDir)) {
    try {
      const files = await fs.readdir(smodsDir)

      // Check for version.lua in the smods directory
      const versionLuaFile = files.find((e) => e.toLowerCase() === 'version.lua')
      if (versionLuaFile) {
        const versionLuaPath = path.join(smodsDir, versionLuaFile)
        const versionLuaContent = await fs.readFile(versionLuaPath, 'utf-8')

        // Extract the version string from the Lua file
        const versionMatch = versionLuaContent.match(/return\s*"([^"]+)"/)
        if (versionMatch && versionMatch[1]) {
          return versionMatch[1]
        }
      }

      // Check for a manifest.json file which might contain version info
      const manifestPath = path.join(smodsDir, 'manifest.json')
      if (await fs.pathExists(manifestPath)) {
        const manifest = await fs.readJSON(manifestPath)
        if (manifest.version_number) {
          return manifest.version_number
        }
        if (manifest.version) {
          return manifest.version
        }
      }

      // If no manifest.json or no version in it, check for other JSON files
      const jsonFiles = files.filter((file) => file.endsWith('.json'))
      for (const jsonFile of jsonFiles) {
        try {
          const json = await fs.readJSON(path.join(smodsDir, jsonFile))
          if (json.version_number) {
            return json.version_number
          }
          if (json.version) {
            return json.version
          }
        } catch (error) {
          loggerService.error(`Error reading JSON file ${jsonFile}:`, error)
        }
      }

      return 'unknown'
    } catch (error) {
      loggerService.error('Error determining smods version from smods directory:', error)
    }
  }

  // If we couldn't find SMods in any directory
  return null
}

async function installSmods(version: string = 'latest') {
  loggerService.info(`Installing smods (requested version: ${version})`)

  if (!modsDir) {
    throw new Error('Mods directory not found')
  }

  if (!versionStorageDir) {
    throw new Error('Version storage directory not found')
  }

  // Ensure mods directory exists
  await fs.ensureDir(modsDir)

  // Ensure version storage directory exists
  await fs.ensureDir(versionStorageDir)

  // Get the specified smods release info (or latest if not specified)
  const smodsRelease = await multiplayerService.getSpecificSmodsRelease(version)
  loggerService.info(`Smods release to install: ${smodsRelease.version}`)

  // Check if smods is already installed with the correct version
  const installedVersion = await determineSmodsInstalledVersion()
  if (installedVersion === smodsRelease.version) {
    loggerService.info(`Smods ${smodsRelease.version} is already installed. Skipping installation.`)
    return smodsRelease.version
  }

  console.log(
    `Installing smods ${smodsRelease.version} (current: ${installedVersion || 'not installed'})`
  )

  // Find all existing smods installations
  const existingSmodsInstallations = await findAllSmodsInstallations()
  loggerService.info(`Found ${existingSmodsInstallations.length} existing smods installations`)

  // If any installations exist, back up the first one (which should be the active one)
  // and remove all of them
  if (existingSmodsInstallations.length > 0 && installedVersion) {
    // Create a backup directory for the current version
    const backupDir = path.join(versionStorageDir, `smods-${installedVersion}`)
    loggerService.info(`Backing up smods ${installedVersion} to ${backupDir}`)

    // Ensure the backup directory exists and is empty
    await fs.ensureDir(backupDir)
    await fs.emptyDir(backupDir)

    // Copy the first smods installation to the backup directory
    await fs.copy(existingSmodsInstallations[0], backupDir)
    loggerService.info(`Successfully backed up smods ${installedVersion}`)

    // Remove all existing smods installations
    for (const installPath of existingSmodsInstallations) {
      loggerService.info(`Removing existing smods installation at ${installPath}`)
      await fs.remove(installPath)
    }
  }

  // Define the target directory for the new installation (traditional 'smods' directory)
  const smodsDir = path.join(modsDir, 'smods')

  // Create a temporary directory for downloading
  const tempDir = path.join(os.tmpdir(), 'balatro-smods-temp')
  await fs.ensureDir(tempDir)

  try {
    // Download the zip file
    const zipFilePath = path.join(tempDir, `smods-${smodsRelease.version}.zip`)
    const zipFileStream = createWriteStream(zipFilePath)

    const response = await fetch(smodsRelease.url)
    if (!response.ok) {
      throw new Error(`Failed to download smods: ${response.statusText}`)
    }

    // Save the response to the file
    await pipeline(response.body, zipFileStream)

    // Create a temporary extraction directory
    const extractDir = path.join(tempDir, 'extract')
    await fs.ensureDir(extractDir)

    // Extract the zip file to the temporary directory
    await extract(zipFilePath, { dir: extractDir })

    // Find the extracted directory containing the mod
    const extractedDirs = (await fs.readdir(extractDir)).filter((e) =>
      fs.statSync(path.join(extractDir, e)).isDirectory()
    )

    if (extractedDirs.length === 0) {
      throw new Error('No directories found in the extracted smods zip file')
    }

    // Ensure the target directory exists and is empty
    await fs.ensureDir(smodsDir)
    await fs.emptyDir(smodsDir)

    // Copy the extracted mod to the target directory
    await fs.copy(path.join(extractDir, extractedDirs[0]), smodsDir)

    // Clean up the temporary directory
    await fs.remove(tempDir)

    loggerService.info(`Successfully installed smods ${smodsRelease.version}`)
    return smodsRelease.version
  } catch (error) {
    // Clean up on error
    await fs.remove(tempDir)
    throw error
  }
}

// Function to check if lovely is already installed
async function isLovelyInstalled() {
  // Get the game directory
  const gameDir = await getGameDirectory()
  if (!gameDir) {
    loggerService.info('Game directory not found. Cannot check if lovely is installed.')
    return false
  }

  // Check for lovely files based on platform
  if (platform === 'win32' || platform === 'linux') {
    // Check for version.dll
    const versionDllPath = path.join(gameDir, 'version.dll')
    return await fs.pathExists(versionDllPath)
  } else if (platform === 'darwin') {
    // Check for liblovely.dylib and run_lovely_macos.sh
    const libLovelyDylibPath = path.join(gameDir, 'liblovely.dylib')
    const runLovelyMacosShPath = path.join(gameDir, 'run_lovely_macos.sh')
    return (await fs.pathExists(libLovelyDylibPath)) && (await fs.pathExists(runLovelyMacosShPath))
  }

  return false
}

async function installLovely(version: string = 'latest') {
  loggerService.info(`Installing lovely (requested version: ${version})`)

  if (!modsDir) {
    throw new Error('Mods directory not found')
  }

  // Get the game directory
  const gameDir = await getGameDirectory()
  if (!gameDir) {
    // For now, we'll ask the user to manually install lovely
    loggerService.info('Game directory not found. Please install lovely manually.')
    return
  }

  // Check if lovely is already installed
  const lovelyInstalled = await isLovelyInstalled()
  if (lovelyInstalled) {
    loggerService.info('Lovely is already installed. Skipping installation.')
    return true
  }

  loggerService.info('Lovely is not installed. Installing...')

  // Create a temporary directory for downloading
  const tempDir = path.join(os.tmpdir(), 'balatro-lovely-temp')
  await fs.ensureDir(tempDir)

  try {
    // Get the download URL for the current platform and architecture with the specified version
    const downloadUrl = multiplayerService.getLovelyDownloadUrl(platform, arch, version)
    loggerService.info(`Downloading lovely from ${downloadUrl}`)

    // Download the file
    const fileName = path.basename(downloadUrl)
    const filePath = path.join(tempDir, fileName)
    const fileStream = createWriteStream(filePath)

    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`Failed to download lovely: ${response.statusText}`)
    }

    // Save the response to the file
    await pipeline(response.body, fileStream)

    // Create a temporary extraction directory
    const extractDir = path.join(tempDir, 'extract')
    await fs.ensureDir(extractDir)

    // Extract the file to the temporary directory
    if (fileName.endsWith('.zip')) {
      await extract(filePath, { dir: extractDir })
    } else if (fileName.endsWith('.tar.gz')) {
      // For macOS, we need to extract the tar.gz file
      await execAsync(`tar -xzf "${filePath}" -C "${extractDir}"`)
    }

    // Install lovely based on the platform
    if (platform === 'win32' || platform === 'linux') {
      // Copy version.dll to the game directory
      const versionDll = path.join(extractDir, 'version.dll')
      if (await fs.pathExists(versionDll)) {
        await fs.copy(versionDll, path.join(gameDir, 'version.dll'))
      } else {
        // Look for version.dll in subdirectories
        const files = await fs.readdir(extractDir)
        for (const file of files) {
          const filePath = path.join(extractDir, file)
          if (fs.statSync(filePath).isDirectory()) {
            const versionDllPath = path.join(filePath, 'version.dll')
            if (await fs.pathExists(versionDllPath)) {
              await fs.copy(versionDllPath, path.join(gameDir, 'version.dll'))
              break
            }
          }
        }
      }
    } else if (platform === 'darwin') {
      // Copy liblovely.dylib and run_lovely_macos.sh to the game directory
      const libLovelyDylib = path.join(extractDir, 'liblovely.dylib')
      const runLovelyMacosSh = path.join(extractDir, 'run_lovely_macos.sh')

      if ((await fs.pathExists(libLovelyDylib)) && (await fs.pathExists(runLovelyMacosSh))) {
        await fs.copy(libLovelyDylib, path.join(gameDir, 'liblovely.dylib'))
        await fs.copy(runLovelyMacosSh, path.join(gameDir, 'run_lovely_macos.sh'))
        // Make the script executable
        await execAsync(`chmod +x "${path.join(gameDir, 'run_lovely_macos.sh')}"`)
      } else {
        // Look for the files in subdirectories
        const files = await fs.readdir(extractDir)
        for (const file of files) {
          const filePath = path.join(extractDir, file)
          if (fs.statSync(filePath).isDirectory()) {
            const libPath = path.join(filePath, 'liblovely.dylib')
            const scriptPath = path.join(filePath, 'run_lovely_macos.sh')
            if ((await fs.pathExists(libPath)) && (await fs.pathExists(scriptPath))) {
              await fs.copy(libPath, path.join(gameDir, 'liblovely.dylib'))
              await fs.copy(scriptPath, path.join(gameDir, 'run_lovely_macos.sh'))
              // Make the script executable
              await execAsync(`chmod +x "${path.join(gameDir, 'run_lovely_macos.sh')}"`)
              break
            }
          }
        }
      }
    }

    // Clean up the temporary directory
    await fs.remove(tempDir)

    loggerService.info('Successfully installed lovely')
    return true
  } catch (error) {
    // Clean up on error
    await fs.remove(tempDir)
    throw error
  }
}

async function loadModVersion(
  id: number,
  progressCallback?: (progress: { status: string; progress?: number }) => void,
  forceDownload: boolean = false
) {
  progressCallback?.({ status: 'Starting installation', progress: 0 })
  loggerService.info('loadModVersion', id, forceDownload ? '(forced download)' : '')

  if (!modsDir) {
    throw new Error('Mods directory not found')
  }

  if (!versionStorageDir) {
    throw new Error('Version storage directory not found')
  }

  // Ensure version storage directory exists
  await fs.ensureDir(versionStorageDir)

  // Fetch available versions
  const availableVersions = await multiplayerService.getAvailableModVersions()

  // Find the version with the matching ID
  const versionToInstall = availableVersions.find((version) => version.id === id)
  if (!versionToInstall) {
    throw new Error(`Version with ID ${id} not found`)
  }
  loggerService.info({ versionToInstall })

  // Create a temporary directory for downloading
  const tempDir = path.join(os.tmpdir(), 'balatro-multiplayer-temp')
  await fs.ensureDir(tempDir)

  // Check if the version is already in the version storage directory and we're not forcing a download
  let zipFilePath = ''

  // Check if version storage directory exists and has content
  if (!forceDownload && (await fs.pathExists(versionStorageDir))) {
    // Look for the specific version directory without timestamp
    const versionDir = path.join(versionStorageDir, `multiplayer-${versionToInstall.version}`)

    if (await fs.pathExists(versionDir)) {
      loggerService.info(`Found version ${versionToInstall.version} in storage`)

      // Check if the storage contains a valid mod
      const storageFiles = await fs.readdir(versionDir)
      const jsonFile = storageFiles.find((e) => e.endsWith('.json'))

      if (jsonFile) {
        const json = await fs.readJSON(path.join(versionDir, jsonFile))
        if (
          (json.id === 'Multiplayer' || json.id === 'NanoMultiplayer') &&
          json.version === versionToInstall.version
        ) {
          // Store any currently installed versions
          await storeInstalledVersions()

          // Copy the stored mod to the mods directory
          // The mod files are stored directly in the versionDir, so we need to create a new directory in modsDir
          const modDirName = `multiplayer-${versionToInstall.version}`
          const targetModDir = path.join(modsDir, modDirName)

          // Ensure the target directory exists and is empty
          await fs.ensureDir(targetModDir)
          await fs.emptyDir(targetModDir)

          // Copy all contents from the storage directory to the target mod directory
          await fs.copy(versionDir, targetModDir)
          loggerService.info(`Restored version ${versionToInstall.version} from storage`)

          // Install smods and lovely alongside the multiplayer mod
          try {
            // Check if the mod specifies a specific version of smods or lovely
            const smodsVersion = versionToInstall.smods_version || 'latest'
            const lovelyVersion = versionToInstall.lovely_version || 'latest'
            loggerService.info(smodsVersion)
            await installSmods(smodsVersion, progressCallback)
            await installLovely(lovelyVersion, progressCallback)
            progressCallback?.({ status: 'Installation complete!' })
          } catch (error) {
            loggerService.error('Error installing additional mods:', error)
            progressCallback?.({ status: `Error: ${error.message}` })
          }

          // Return early as we've restored from storage
          return
        }
      }
    }
  }

  // If not found in storage, download it
  zipFilePath = path.join(tempDir, `multiplayer-${versionToInstall.version}.zip`)
  const zipFileStream = createWriteStream(zipFilePath)

  try {
    // Download the zip file using ky
    progressCallback?.({ status: `Downloading version ${versionToInstall.version}...` })
    const response = await fetch(versionToInstall.url)
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`)
    }

    // Save the response to the file
    await pipeline(response.body, zipFileStream)
    progressCallback?.({ status: 'Download complete' })

    // Store any currently installed versions
    progressCallback?.({ status: 'Backing up any existing installations...' })
    await storeInstalledVersions()

    // Create a temporary extraction directory
    const extractDir = path.join(tempDir, 'extract')
    await fs.ensureDir(extractDir)

    // Extract the zip file to the temporary directory
    progressCallback?.({ status: 'Extracting files...' })
    await extract(zipFilePath, { dir: extractDir })

    // Find the extracted directory containing the mod
    const extractedDirs = (await fs.readdir(extractDir)).filter((e) =>
      fs.statSync(path.join(extractDir, e)).isDirectory()
    )
    loggerService.info(extractedDirs)

    if (extractedDirs.length === 0) {
      throw new Error('No directories found in the extracted zip file')
    }

    // Create a properly named directory in the mods directory
    const modDirName = `multiplayer-${versionToInstall.version}`
    const targetModDir = path.join(modsDir, modDirName)

    // Ensure the target directory exists and is empty
    progressCallback?.({ status: 'Preparing installation directory...' })
    await fs.ensureDir(targetModDir)
    await fs.emptyDir(targetModDir)

    // Copy the extracted mod to the target directory
    progressCallback?.({ status: 'Installing mod files...' })

    // Check if the extracted content is a single folder
    const extractedContents = await fs.readdir(extractDir)
    const singleFolderPath =
      extractedContents.length === 1 &&
      fs.statSync(path.join(extractDir, extractedContents[0])).isDirectory()
        ? path.join(extractDir, extractedContents[0])
        : null

    if (singleFolderPath) {
      // If it's a single folder, copy its contents directly to avoid nesting
      loggerService.info('Detected single folder in archive, extracting its contents directly')
      const folderContents = await fs.readdir(singleFolderPath)
      for (const item of folderContents) {
        await fs.copy(path.join(singleFolderPath, item), path.join(targetModDir, item))
      }
    } else {
      // Otherwise, copy all contents from the extract directory
      const contents = await fs.readdir(extractDir)
      for (const item of contents) {
        await fs.copy(path.join(extractDir, item), path.join(targetModDir, item))
      }
    }

    // Install smods and lovely alongside the multiplayer mod
    try {
      // First, read the mod's JSON file to check for specific versions

      const smodsVersion = versionToInstall.smods_version || 'latest'
      const lovelyVersion = versionToInstall.lovely_version || 'latest'

      progressCallback?.({ status: 'Installing SMods dependency...' })
      await installSmods(smodsVersion)
      progressCallback?.({ status: 'Installing Lovely dependency...' })
      await installLovely(lovelyVersion)
      progressCallback?.({ status: 'Installation complete!' })
    } catch (error) {
      loggerService.error('Error installing additional mods:', error)
      progressCallback?.({ status: `Error: ${error.message}` })
    }

    // Clean up the temporary directory
    await fs.remove(tempDir)

    loggerService.info(`Successfully installed version ${versionToInstall.version}`)
  } catch (error) {
    // Clean up on error
    await fs.remove(tempDir)
    throw error
  }
}
// Helper function to normalize smods version format for comparison
function normalizeSmodsVersion(version: string): string {
  if (!version) return ''

  // Convert to lowercase
  let normalized = version.toLowerCase()

  // Replace tilde with hyphen
  normalized = normalized.replace('~', '-')

  // Remove "-steamodded" suffix if present
  normalized = normalized.replace('-steamodded', '')

  return normalized
}

// Function to check compatibility between multiplayer mod and smods
async function checkModCompatibility() {
  // Get the installed multiplayer version
  const installedVersions = await determineMultiplayerInstalledVersion()
  loggerService.info(installedVersions)
  if (installedVersions.length === 0) {
    return { compatible: true, message: null, requiredVersionId: null } // No multiplayer mod installed, so no compatibility issues
  }

  // Get the installed smods version
  const smodsVersion = await determineSmodsInstalledVersion()
  loggerService.info({ smodsVersion })
  if (!smodsVersion) {
    return { compatible: true, message: null, requiredVersionId: null } // No smods installed, so no compatibility issues
  }

  // Get available versions from the API endpoint
  const availableVersions = await multiplayerService.getAvailableModVersions()
  // Find the installed version in the available versions
  for (const installedVersion of installedVersions) {
    const matchingVersion = availableVersions.find((v) => v.version === installedVersion)

    if (matchingVersion) {
      // Check if the version specifies a required smods version
      const requiredSmodsVersion = matchingVersion.smods_version

      if (requiredSmodsVersion && requiredSmodsVersion !== 'latest') {
        // Normalize both versions before comparison
        const normalizedRequired = normalizeSmodsVersion(requiredSmodsVersion)
        const normalizedInstalled = normalizeSmodsVersion(smodsVersion)

        // Compare normalized versions
        if (normalizedInstalled !== normalizedRequired) {
          // Find a version that has the correct smods_version
          const correctVersion = availableVersions.find((v) => {
            if (v.smods_version === 'latest') return false

            return normalizeSmodsVersion(v.smods_version) === normalizedRequired
          })

          return {
            compatible: false,
            message: `The installed multiplayer mod (${installedVersion}) requires SMods version ${normalizedRequired}, but you have version ${normalizedInstalled} installed.`,
            requiredVersionId: correctVersion ? correctVersion.id : null
          }
        }
      }
    }
  }

  // If we get here, no compatibility issues were found
  return { compatible: true, message: null, requiredVersionId: null }
}

// Function to keep a selected version and move others to storage
async function keepSelectedVersion(versionToKeep: string) {
  if (!modsDir) {
    throw new Error('Mods directory not found')
  }

  if (!versionStorageDir) {
    throw new Error('Version storage directory not found')
  }

  // Ensure version storage directory exists
  await fs.ensureDir(versionStorageDir)

  // Get all installed versions
  const installedVersions = await determineMultiplayerInstalledVersion()

  // If there's only one version or no versions, no need to do anything
  if (installedVersions.length <= 1) {
    return
  }

  // Find all directories containing multiplayer mods
  const dirs = (await fs.readdir(modsDir)).filter((e) =>
    fs.statSync(path.join(modsDir, e)).isDirectory()
  )

  for (const dir of dirs) {
    const files = await fs.readdir(path.join(modsDir, dir))
    const jsonFile = files.find((e) => e.endsWith('.json'))

    if (jsonFile) {
      const json = await fs.readJSON(path.join(modsDir, dir, jsonFile))

      if (json.id === 'Multiplayer' || json.id === 'NanoMultiplayer') {
        const version = json.version

        // If this is not the version to keep, move it to storage
        if (version !== versionToKeep) {
          // Create a version-specific storage directory
          const versionDir = path.join(versionStorageDir, `multiplayer-${version}`)

          // Ensure the storage directory exists
          await fs.ensureDir(versionDir)

          // Remove any existing content in the storage directory
          await fs.emptyDir(versionDir)

          // Copy the directory contents to storage
          await fs.copy(path.join(modsDir, dir), versionDir)

          // Remove the original directory
          await fs.remove(path.join(modsDir, dir))

          loggerService.info(`Moved version ${version} to storage`)
        } else {
          loggerService.info(`Keeping version ${version}`)
        }
      }
    }
  }

  return versionToKeep
}

export const modInstallationService = {
  determineMultiplayerInstalledVersion,
  checkDirectoryForMultiplayerInstallation,
  loadModVersion,
  installSmods,
  installLovely,
  getGameDirectory,
  determineSmodsInstalledVersion,
  isLovelyInstalled,
  checkModCompatibility,
  keepSelectedVersion
}
