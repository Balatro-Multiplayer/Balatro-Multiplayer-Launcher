import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { loggerService } from './logger.service'
import { modInstallationService } from './mod-installation.service'

const execFileAsync = promisify(execFile)

export interface MacosJitStatus {
  supported: boolean
  canToggle: boolean
  crashFixEnabled: boolean | null
  jitEnabled: boolean | null
  message: string
  source: 'archive' | 'directory' | 'missing'
}

function getLineEnding(contents: string): string {
  return contents.includes('\r\n') ? '\r\n' : '\n'
}

function setJitEnabledInConf(contents: string, jitEnabled: boolean): string {
  const lineEnding = getLineEnding(contents)
  const hasTrailingNewline = /\r?\n$/.test(contents)
  const lines = contents.split(/\r?\n/)

  if (lines.at(-1) === '') {
    lines.pop()
  }

  const nextLines = lines.filter((line) => line.trim() !== 'jit.off()')

  if (!jitEnabled) {
    const insertAt = nextLines.findIndex((line) => line.trim().startsWith('function '))
    nextLines.splice(insertAt === -1 ? nextLines.length : insertAt, 0, 'jit.off()')
  }

  const nextContents = nextLines.join(lineEnding)
  return hasTrailingNewline ? `${nextContents}${lineEnding}` : nextContents
}

function getLovePaths(gameDir: string): {
  confPath: string
  lovePath: string
  resourcesDir: string
} {
  const resourcesDir = path.join(gameDir, 'Balatro.app', 'Contents', 'Resources')
  return {
    confPath: path.join(resourcesDir, 'Balatro.love', 'conf.lua'),
    lovePath: path.join(resourcesDir, 'Balatro.love'),
    resourcesDir
  }
}

async function readConfFromArchive(lovePath: string): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'balatro-love-'))

  try {
    await execFileAsync('unzip', ['-q', lovePath, '-d', tempDir])
    return await fs.readFile(path.join(tempDir, 'conf.lua'), 'utf8')
  } finally {
    await fs.remove(tempDir)
  }
}

async function readJitStatus(): Promise<MacosJitStatus> {
  if (process.platform !== 'darwin') {
    return {
      supported: false,
      canToggle: false,
      crashFixEnabled: null,
      jitEnabled: null,
      message: 'Only available on macOS.',
      source: 'missing'
    }
  }

  const gameDir = await modInstallationService.getGameDirectory()
  if (!gameDir) {
    return {
      supported: true,
      canToggle: false,
      crashFixEnabled: null,
      jitEnabled: null,
      message: 'Game directory not found.',
      source: 'missing'
    }
  }

  const { lovePath, confPath } = getLovePaths(gameDir)
  if (!(await fs.pathExists(lovePath))) {
    return {
      supported: true,
      canToggle: false,
      crashFixEnabled: null,
      jitEnabled: null,
      message: 'Balatro.love not found.',
      source: 'missing'
    }
  }

  const stats = await fs.stat(lovePath)

  try {
    const confContents = stats.isDirectory()
      ? await fs.readFile(confPath, 'utf8')
      : await readConfFromArchive(lovePath)
    const jitEnabled = !/\bjit\.off\s*\(\s*\)/.test(confContents)

    return {
      supported: true,
      canToggle: true,
      crashFixEnabled: !jitEnabled,
      jitEnabled,
      message: stats.isDirectory()
        ? 'Using unpacked Balatro.love folder.'
        : 'Using archived Balatro.love file.',
      source: stats.isDirectory() ? 'directory' : 'archive'
    }
  } catch (error) {
    loggerService.error('Failed to read macOS JIT status:', error)
    return {
      supported: true,
      canToggle: false,
      crashFixEnabled: null,
      jitEnabled: null,
      message: 'Could not read Balatro conf.lua.',
      source: stats.isDirectory() ? 'directory' : 'archive'
    }
  }
}

async function setJitEnabled(jitEnabled: boolean): Promise<MacosJitStatus> {
  if (process.platform !== 'darwin') {
    throw new Error('macOS JIT toggle is only available on macOS.')
  }

  const gameDir = await modInstallationService.getGameDirectory()
  if (!gameDir) {
    throw new Error('Game directory not found. Set Balatro path first.')
  }

  const { lovePath, confPath, resourcesDir } = getLovePaths(gameDir)
  if (!(await fs.pathExists(lovePath))) {
    throw new Error('Balatro.love not found.')
  }

  const loveStats = await fs.stat(lovePath)

  if (loveStats.isDirectory()) {
    const currentConf = await fs.readFile(confPath, 'utf8')
    const nextConf = setJitEnabledInConf(currentConf, jitEnabled)

    if (nextConf !== currentConf) {
      await fs.writeFile(confPath, nextConf, 'utf8')
    }

    return await readJitStatus()
  }

  const tempLoveDir = path.join(
    resourcesDir,
    `Balatro.love.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  )
  const backupLovePath = path.join(
    resourcesDir,
    `Balatro.love.backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  )
  let backupCreated = false

  try {
    await fs.ensureDir(tempLoveDir)
    await execFileAsync('unzip', ['-q', lovePath, '-d', tempLoveDir])

    const extractedConfPath = path.join(tempLoveDir, 'conf.lua')
    const currentConf = await fs.readFile(extractedConfPath, 'utf8')
    const nextConf = setJitEnabledInConf(currentConf, jitEnabled)
    await fs.writeFile(extractedConfPath, nextConf, 'utf8')

    await fs.move(lovePath, backupLovePath)
    backupCreated = true
    await fs.move(tempLoveDir, lovePath)
    await fs.remove(backupLovePath)
  } catch (error) {
    await fs.remove(tempLoveDir)
    if (
      backupCreated &&
      !(await fs.pathExists(lovePath)) &&
      (await fs.pathExists(backupLovePath))
    ) {
      await fs.move(backupLovePath, lovePath)
    }
    loggerService.error('Failed to update macOS JIT setting:', error)
    throw error
  }

  return await readJitStatus()
}

export const macosJitService = {
  getStatus: readJitStatus,
  setJitEnabled
}
