import fs from 'fs-extra'
import * as os from 'node:os'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { multiplayerService } from './multiplayer.service'
import extract from 'extract-zip'
import { MODS_DIR } from '../constants'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)
const isMac = os.platform() === 'darwin'
const isWindows = os.platform() === 'win32'
const isLinux = os.platform() === 'linux'

// Define VERSION_STORAGE_DIR for all platforms
const VERSION_STORAGE_DIR = {
  win32: path.join(os.homedir(), 'AppData', 'Roaming', 'Balatro', 'ModVersions'),
  darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Balatro', 'ModVersions'),
  linux: path.join(
    os.homedir(),
    '.local',
    'share',
    'Steam',
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
  // First, check if the default Steam path exists
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
const modsDir = MODS_DIR[platform] ?? null
const versionStorageDir = VERSION_STORAGE_DIR[platform] ?? null

async function checkDirectoryForMultiplayerInstallation(): Promise<Array<string>> {
  const dir = MODS_DIR[platform] ?? ''
  if (!dir) {
    throw new Error('Unsupported platform')
  }
  const modsDirExists = fs.existsSync(dir)
  if (!modsDirExists) {
    await fs.ensureDir(dir)
  }

  const versions = await determineMultiplayerInstalledVersion()

  console.log({ dir, modsDirExists, versions })
  console.log('checkDirectoryForMultiplayerInstallation')
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
      if (json.id === 'Multiplayer') {
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

          if (json.id === 'Multiplayer' && json.version === version) {
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

            console.log(`Stored version ${version} in ${versionDir}`)
          }
        }
      }
    }
  }
}

// Function to check if smods is already installed and get its version
async function determineSmodsInstalledVersion() {
  if (!modsDir) {
    throw new Error('Mods directory not found')
  }

  // Check if the smods directory exists
  const smodsDir = path.join(modsDir, 'smods')
  if (!(await fs.pathExists(smodsDir))) {
    return null
  }

  // Look for a version identifier in the smods directory
  try {
    // Check for a manifest.json file which might contain version info
    const manifestPath = path.join(smodsDir, 'manifest.json')
    if (await fs.pathExists(manifestPath)) {
      const manifest = await fs.readJSON(manifestPath)
      if (manifest.version) {
        return manifest.version
      }
    }

    // If no manifest.json or no version in it, check for other JSON files
    const files = await fs.readdir(smodsDir)
    const jsonFiles = files.filter((file) => file.endsWith('.json'))

    for (const jsonFile of jsonFiles) {
      try {
        const json = await fs.readJSON(path.join(smodsDir, jsonFile))
        if (json.version) {
          return json.version
        }
      } catch (error) {
        console.error(`Error reading JSON file ${jsonFile}:`, error)
      }
    }

    // If smods is installed but we can't determine the version, return a placeholder
    return 'unknown'
  } catch (error) {
    console.error('Error determining smods version:', error)
    return null
  }
}

async function installSmods(version: string = 'latest') {
  console.log(`Installing smods (requested version: ${version})`)

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
  console.log(`Smods release to install: ${smodsRelease.version}`)

  // Check if smods is already installed with the correct version
  const installedVersion = await determineSmodsInstalledVersion()
  if (installedVersion === smodsRelease.version) {
    console.log(`Smods ${smodsRelease.version} is already installed. Skipping installation.`)
    return smodsRelease.version
  }

  console.log(
    `Installing smods ${smodsRelease.version} (current: ${installedVersion || 'not installed'})`
  )

  // If a different version is already installed, back it up
  const smodsDir = path.join(modsDir, 'smods')
  if (installedVersion && (await fs.pathExists(smodsDir))) {
    // Create a backup directory for the current version
    const backupDir = path.join(versionStorageDir, `smods-${installedVersion}`)
    console.log(`Backing up smods ${installedVersion} to ${backupDir}`)

    // Ensure the backup directory exists and is empty
    await fs.ensureDir(backupDir)
    await fs.emptyDir(backupDir)

    // Copy the current smods to the backup directory
    await fs.copy(smodsDir, backupDir)

    console.log(`Successfully backed up smods ${installedVersion}`)
  }

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

    console.log(`Successfully installed smods ${smodsRelease.version}`)
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
    console.log('Game directory not found. Cannot check if lovely is installed.')
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
  console.log(`Installing lovely (requested version: ${version})`)

  if (!modsDir) {
    throw new Error('Mods directory not found')
  }

  // Get the game directory
  const gameDir = await getGameDirectory()
  if (!gameDir) {
    // For now, we'll ask the user to manually install lovely
    console.log('Game directory not found. Please install lovely manually.')
    return
  }

  // Check if lovely is already installed
  const lovelyInstalled = await isLovelyInstalled()
  if (lovelyInstalled) {
    console.log('Lovely is already installed. Skipping installation.')
    return true
  }

  console.log('Lovely is not installed. Installing...')

  // Create a temporary directory for downloading
  const tempDir = path.join(os.tmpdir(), 'balatro-lovely-temp')
  await fs.ensureDir(tempDir)

  try {
    // Get the download URL for the current platform and architecture with the specified version
    const downloadUrl = multiplayerService.getLovelyDownloadUrl(platform, arch, version)
    console.log(`Downloading lovely from ${downloadUrl}`)

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

    console.log('Successfully installed lovely')
    return true
  } catch (error) {
    // Clean up on error
    await fs.remove(tempDir)
    throw error
  }
}

async function loadModVersion(id: number) {
  console.log('loadModVersion', id)

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

  // Create a temporary directory for downloading
  const tempDir = path.join(os.tmpdir(), 'balatro-multiplayer-temp')
  await fs.ensureDir(tempDir)

  // Check if the version is already in the version storage directory
  let zipFilePath = ''
  let foundInStorage = false

  // Check if version storage directory exists and has content
  if (await fs.pathExists(versionStorageDir)) {
    // Look for the specific version directory without timestamp
    const versionDir = path.join(versionStorageDir, `multiplayer-${versionToInstall.version}`)

    if (await fs.pathExists(versionDir)) {
      console.log(`Found version ${versionToInstall.version} in storage`)

      // Check if the storage contains a valid mod
      const storageFiles = await fs.readdir(versionDir)
      const jsonFile = storageFiles.find((e) => e.endsWith('.json'))

      if (jsonFile) {
        const json = await fs.readJSON(path.join(versionDir, jsonFile))
        if (json.id === 'Multiplayer' && json.version === versionToInstall.version) {
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
          console.log(`Restored version ${versionToInstall.version} from storage`)
          foundInStorage = true

          // Install smods and lovely alongside the multiplayer mod
          try {
            // Check if the mod specifies a specific version of smods or lovely
            const smodsVersion = json.smods_version || 'latest'
            const lovelyVersion = json.lovely_version || 'latest'

            await installSmods(smodsVersion)
            await installLovely(lovelyVersion)
          } catch (error) {
            console.error('Error installing additional mods:', error)
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
    const response = await fetch(versionToInstall.url)
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`)
    }

    // Save the response to the file
    await pipeline(response.body, zipFileStream)

    // Store any currently installed versions
    await storeInstalledVersions()

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
      throw new Error('No directories found in the extracted zip file')
    }

    // Create a properly named directory in the mods directory
    const modDirName = `multiplayer-${versionToInstall.version}`
    const targetModDir = path.join(modsDir, modDirName)

    // Ensure the target directory exists and is empty
    await fs.ensureDir(targetModDir)
    await fs.emptyDir(targetModDir)

    // Copy the extracted mod to the target directory
    await fs.copy(path.join(extractDir, extractedDirs[0]), targetModDir)

    // Install smods and lovely alongside the multiplayer mod
    try {
      // First, read the mod's JSON file to check for specific versions
      const modFiles = await fs.readdir(targetModDir)
      const jsonFile = modFiles.find((e) => e.endsWith('.json'))

      let smodsVersion = 'latest'
      let lovelyVersion = 'latest'

      if (jsonFile) {
        const json = await fs.readJSON(path.join(targetModDir, jsonFile))
        smodsVersion = json.smods_version || 'latest'
        lovelyVersion = json.lovely_version || 'latest'
      }

      await installSmods(smodsVersion)
      await installLovely(lovelyVersion)
    } catch (error) {
      console.error('Error installing additional mods:', error)
    }

    // Clean up the temporary directory
    await fs.remove(tempDir)

    console.log(`Successfully installed version ${versionToInstall.version}`)
  } catch (error) {
    // Clean up on error
    await fs.remove(tempDir)
    throw error
  }
}
export const modInstallationService = {
  determineMultiplayerInstalledVersion,
  checkDirectoryForMultiplayerInstallation,
  loadModVersion,
  installSmods,
  installLovely,
  getGameDirectory,
  determineSmodsInstalledVersion,
  isLovelyInstalled
}
