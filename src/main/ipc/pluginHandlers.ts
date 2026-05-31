import { IPC } from '@shared/types'
import { pluginMarketplaceService } from '../services/plugins/PluginMarketplaceService'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

export function registerPluginHandlers(): void {
  handleWithTimeout(IPC.PLUGIN_MARKETPLACE_LIST, IPC_TIMEOUT.short, () => pluginMarketplaceService.listMarketplace())
  handleWithTimeout(IPC.PLUGIN_INSTALLED_LIST, IPC_TIMEOUT.short, () => pluginMarketplaceService.listInstalled())
  handleWithTimeout(IPC.PLUGIN_INSTALL, IPC_TIMEOUT.long, (_event, pluginId: string) =>
    pluginMarketplaceService.installMarketplacePlugin(pluginId)
  )
  handleWithTimeout(IPC.PLUGIN_UNINSTALL, IPC_TIMEOUT.long, (_event, pluginId: string) =>
    pluginMarketplaceService.uninstall(pluginId)
  )
  handleWithTimeout(IPC.PLUGIN_IMPORT, IPC_TIMEOUT.long, (_event, folderPath: string) =>
    pluginMarketplaceService.importLocalPlugin(folderPath)
  )
}
