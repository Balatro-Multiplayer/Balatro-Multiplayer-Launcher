import path from 'node:path'
import os from 'node:os'
import { settingsService } from './services/settings.service'

function getModsDir(): Record<string, string> {
  return {
    win32: path.join(os.homedir(), 'AppData', 'Roaming', 'Balatro', 'Mods'),
    darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Balatro', 'Mods'),
    linux: settingsService.getLinuxModsDirectory()
  }
}

export const MODS_DIR = getModsDir()
