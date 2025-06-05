import path from 'node:path'
import os from 'node:os'

export const MODS_DIR = {
  win32: path.join(os.homedir(), 'AppData', 'Roaming', 'Balatro', 'Mods'),
  darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Balatro', 'Mods'),
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
    'Mods'
  )
}
