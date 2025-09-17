import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'
import { loggerService } from './logger.service'

const execAsync = promisify(exec)

async function pathExists(p: string): Promise<boolean> {
  try {
    return await fs.pathExists(p)
  } catch {
    return false
  }
}

function dedupCaseInsensitive(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of items) {
    const key = s.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push(s)
    }
  }
  return out
}

async function readText(p: string): Promise<string | null> {
  try {
    if (!(await pathExists(p))) return null
    return await fs.readFile(p, 'utf8')
  } catch {
    return null
  }
}

function parseLibraryFoldersVdfToPaths(vdfContents: string): string[] {
  const paths: string[] = []
  const re = /"path"\s*"([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(vdfContents))) {
    paths.push(m[1])
  }
  return paths
}

async function getSteamInstallPathWindows(): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v InstallPath'
    )
    // Output typically contains a line like: InstallPath    REG_SZ    C:\\Program Files (x86)\\Steam
    const line = stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.toLowerCase().startsWith('installpath'))
    if (line) {
      const parts = line.split(/\s{2,}/)
      const value = parts[parts.length - 1]
      if (value) return value
    }
  } catch (e) {
    // ignore, will fallback
    loggerService.debug?.('Windows registry query for Steam failed, falling back to default', e)
  }
  return 'C:\\Program Files (x86)\\Steam'
}

export async function getSteamLibraries(): Promise<string[]> {
  const platform = os.platform()

  if (platform === 'win32') {
    const installPath = await getSteamInstallPathWindows()
    if (!installPath) return []

    const libraryVdf = path.join(installPath, 'steamapps', 'libraryfolders.vdf')
    const contents = await readText(libraryVdf)
    if (!contents) return dedupCaseInsensitive([installPath])

    const libs = parseLibraryFoldersVdfToPaths(contents)
    return dedupCaseInsensitive([installPath, ...libs])
  }

  if (platform === 'darwin') {
    return [path.join(os.homedir(), 'Library', 'Application Support', 'Steam')]
  }

  // linux
  return [path.join(os.homedir(), '.local', 'share', 'Steam')]
}

export async function getBalatroCandidates(): Promise<string[]> {
  const libs = await getSteamLibraries()
  const candidates = libs.map((lib) => path.join(lib, 'steamapps', 'common', 'Balatro'))
  const existing: string[] = []
  for (const c of candidates) {
    if (await pathExists(c)) existing.push(c)
  }
  return existing
}

export async function isBalatroInstallDirValid(dir: string): Promise<boolean> {
  const platform = os.platform()

  if (platform === 'win32') {
    const dlls = ['love.dll', 'lua51.dll', 'SDL2.dll']
    for (const dll of dlls) {
      if (await pathExists(path.join(dir, dll))) return true
    }
    if (await pathExists(path.join(dir, 'Balatro.exe'))) return true
    return false
  }

  if (platform === 'darwin') {
    return await pathExists(
      path.join(dir, 'Balatro.app', 'Contents', 'Resources', 'Balatro.love')
    )
  }

  // linux (Proton layout)
  return await pathExists(path.join(dir, 'Balatro.exe'))
}

export async function resolveBalatroPath(savedPath?: string | null): Promise<string | null> {
  // 1) Use saved path first if valid
  if (savedPath && (await isBalatroInstallDirValid(savedPath))) return savedPath

  // 2) Discover candidates
  const candidates = await getBalatroCandidates()
  for (const c of candidates) {
    if (await isBalatroInstallDirValid(c)) {
      return c
    }
  }

  return null
}

export function normalizeCustomPath(userSelectedPath: string): string {
  // If a file like an exe is provided, normalize to its directory
  const lower = userSelectedPath.toLowerCase()
  if (lower.endsWith('.exe')) {
    return path.dirname(userSelectedPath)
  }
  return userSelectedPath
}
