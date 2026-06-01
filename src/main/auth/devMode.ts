import { is } from '@electron-toolkit/utils'
import { app } from 'electron'

/**
 * Checks if the application is currently running in Developer Mode.
 * This unlocks administrative tasks such as changing Google/GitHub OAuth configurations.
 *
 * SECURITY: The LUMIQ_DEV_MODE env-var override is only honoured when the app
 * is already running in Electron's dev environment (is.dev === true).  This
 * prevents a production binary from being escalated to developer mode simply by
 * setting an environment variable.
 */
export function isDeveloperMode(): boolean {
  if (is.dev) return true
  // In packaged builds, never allow env-var override — the app is signed and
  // distributed; there is no legitimate reason to enable dev mode at runtime.
  if (app.isPackaged) return false
  // Unpackaged but not is.dev (e.g. `electron .` without ELECTRON_IS_DEV):
  // still allow the env-var so local contributors can test OAuth flows.
  return process.env.LUMIQ_DEV_MODE === 'true'
}
