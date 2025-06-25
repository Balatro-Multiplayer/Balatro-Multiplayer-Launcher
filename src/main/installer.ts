import fs from 'fs-extra'
import * as os from 'node:os'
import path from 'node:path'
import { MODS_DIR } from './constants'
import { loggerService } from './services/logger.service'

const isMac = os.platform() === 'darwin'
const isWindows = os.platform() === 'win32'
const isLinux = os.platform() === 'linux'

const platform = os.platform()
const modsDir = MODS_DIR[platform] ?? null

export async function checkDirectoryForMultiplayerInstallation(): Promise<Array<string>> {
  const dir = MODS_DIR[platform] ?? ''
  if (!dir) {
    throw new Error('Unsupported platform')
  }
  const modsDirExists = fs.existsSync(dir)
  if (!modsDirExists) {
    await fs.ensureDir(dir)
  }

  const versions = await determineMultiplayerInsalledVersion()

  return versions
}

async function determineMultiplayerInsalledVersion() {
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
