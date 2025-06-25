import { app } from 'electron'
import https from 'https'
import { settingsService } from './settings.service'
import { loggerService } from './logger.service'

// Extend the Settings interface in settings.service.ts to include installationTracked
// This will be done in a separate edit

const PLAUSIBLE_API_HOST = 'plausible.balatromp.com'
const PLAUSIBLE_API_URL = '/api/event'
const PLAUSIBLE_DOMAIN = 'balatromp.com' // Replace with your actual domain configured in Plausible
type PlausibleEvent = {
  domain: string
  name: string
  url: string
  props?: Record<string, any>
}

class AnalyticsService {
  private isEnabled(): boolean {
    if (process.env.DISABLE_ANALYTICS) {
      return false
    }
    return settingsService.isAnalyticsEnabled()
  }

  async trackInstallation(): Promise<void> {
    const installationTracked = settingsService.getSetting('installationTracked')

    if (installationTracked || !this.isEnabled()) {
      return
    }

    try {
      await this.trackEvent('app_installed', {
        app_version: app.getVersion(),
        os: process.platform,
        arch: process.arch
      })

      settingsService.setSetting('installationTracked', true)
      loggerService.info('Installation tracking completed')
    } catch (error) {
      loggerService.error('Failed to track installation:', error)
    }
  }

  private async trackEvent(eventName: string, props?: Record<string, any>): Promise<void> {
    if (!this.isEnabled()) {
      return
    }

    try {
      const event: PlausibleEvent = {
        domain: PLAUSIBLE_DOMAIN,
        name: eventName,
        url: `https://${PLAUSIBLE_DOMAIN}`,
        props
      }

      const response = await fetch(`https://${PLAUSIBLE_API_HOST}${PLAUSIBLE_API_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `Balatro-Multiplayer-Launcher/${app.getVersion()}`
        },
        body: JSON.stringify(event)
      })

      if (!response.ok) {
        throw new Error(`Plausible API returned status code ${response.status}`)
      }
    } catch (error) {
      loggerService.error('Failed to track event:', error)
      throw error
    }
  }
}

export const analyticsService = new AnalyticsService()
