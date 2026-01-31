import ky from 'ky'
import { loggerService } from './logger.service'

// const BASE_URL = 'http://localhost:3000'
const BASE_URL = 'https://balatromp.com'
const instance = ky.create({
  prefixUrl: BASE_URL
})

const SMODS_RELEASES_URL = 'https://api.github.com/repos/Steamodded/smods/releases'
const LOVELY_RELEASES_BASE_URL = 'https://github.com/ethangreen-dev/lovely-injector/releases'

class MultiplayerService {
  getAvailableModVersions() {
    return instance.get('api/releases').json()
  }

  async getLatestSmodsRelease() {
    const response = await ky.get(SMODS_RELEASES_URL).json<any[]>()
    if (Array.isArray(response) && response.length > 0) {
      const latestRelease = response[0]
      return {
        version: latestRelease.tag_name,
        url: latestRelease.zipball_url,
        name: latestRelease.name,
        publishedAt: latestRelease.published_at
      }
    }
    throw new Error('No smods releases found')
  }

  async getSpecificSmodsRelease(version: string) {
    // If version is 'latest', just return the latest release
    if (version === 'latest') {
      return this.getLatestSmodsRelease()
    }

    // Otherwise, try to find the specific version
    const response = await ky.get(SMODS_RELEASES_URL).json<any[]>()
    if (Array.isArray(response)) {
      loggerService.debug('Smods releases response:', response)
      const specificRelease = response.find((release) => release.tag_name === version)
      if (specificRelease) {
        return {
          version: specificRelease.tag_name,
          url: specificRelease.zipball_url,
          name: specificRelease.name,
          publishedAt: specificRelease.published_at
        }
      }
    }

    // If the specific version is not found, fall back to the latest release
    loggerService.warn(`Smods version ${version} not found, falling back to latest`)
    return this.getLatestSmodsRelease()
  }

  getLovelyDownloadUrl(platform: string, arch: string, version: string = 'latest') {
    // Determine the correct download URL based on platform and architecture
    let baseUrl = LOVELY_RELEASES_BASE_URL

    // If a specific version is requested, use that version
    if (version !== 'latest') {
      baseUrl = `${baseUrl}/download/${version}`
    } else {
      // custom 'latest' url
      baseUrl = `http://167.99.146.95:8080/lovely/latest`
    }

    if (platform === 'win32') {
      return `${baseUrl}/lovely-x86_64-pc-windows-msvc.zip`
    } else if (platform === 'darwin') {
      if (arch === 'arm64') {
        return `${baseUrl}/lovely-aarch64-apple-darwin.tar.gz`
      } else {
        return `${baseUrl}/lovely-x86_64-apple-darwin.tar.gz`
      }
    } else if (platform === 'linux') {
      // Linux uses the Windows version through Proton/Wine
      return `${baseUrl}/lovely-x86_64-pc-windows-msvc.zip`
    }
    throw new Error(`Unsupported platform: ${platform}`)
  }
}

export const multiplayerService = new MultiplayerService()
