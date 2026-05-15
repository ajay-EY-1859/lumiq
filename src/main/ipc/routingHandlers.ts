import { ipcMain } from 'electron'
import { IPC, type AgentRoute } from '@shared/types'
import { deleteAgentRoute, listAgentRoutes, saveAgentRoute } from '../db/agentRoutes'

export function registerRoutingHandlers(): void {
  ipcMain.handle(IPC.ROUTING_LIST, () => listAgentRoutes())
  ipcMain.handle(
    IPC.ROUTING_SAVE,
    (_event, route: Partial<AgentRoute> & Pick<AgentRoute, 'taskName' | 'provider' | 'model'>) => {
      if (!route.taskName?.trim() || !route.provider || !route.model?.trim()) {
        throw new Error('Task, provider, and model are required')
      }
      return saveAgentRoute(route)
    }
  )
  ipcMain.handle(IPC.ROUTING_DELETE, (_event, id: string) => deleteAgentRoute(id))
}
