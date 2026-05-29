import { is } from '@electron-toolkit/utils'

/**
 * Checks if the application is currently running in Developer Mode.
 * This unlocks administrative tasks such as changing Google/GitHub OAuth configurations.
 */
export function isDeveloperMode(): boolean {
  return is.dev || process.env.LUMIQ_DEV_MODE === 'true'
}
