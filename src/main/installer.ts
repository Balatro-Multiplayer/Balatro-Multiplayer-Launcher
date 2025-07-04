import fs from 'fs-extra'
import * as os from 'node:os'
import path from 'node:path'
import { getModsDir } from './constants'

const platform = os.platform()
const modsDir = getModsDir(platform)

export async function checkDirectoryForMultiplayerInstallation(): Promise<Array<string>> {
  const dir = getModsDir(platform)
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
      if (json.id === 'Multiplayer' || json.id === 'NanoMultiplayer') {
        configs.push(json)
      }
    }
  }
  return configs.map((e) => e.version)
}
