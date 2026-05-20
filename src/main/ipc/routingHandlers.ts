import { IPC, type AgentRoute } from '@shared/types'
import { deleteAgentRoute, listAgentRoutes, saveAgentRoute } from '../db/agentRoutes'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

export function registerRoutingHandlers(): void {
  handleWithTimeout(IPC.ROUTING_LIST, IPC_TIMEOUT.short, () => listAgentRoutes())
  handleWithTimeout(
    IPC.ROUTING_SAVE,
    IPC_TIMEOUT.short,
    (_event, route: Partial<AgentRoute> & Pick<AgentRoute, 'taskName' | 'provider' | 'model'>) => {
      if (!route.taskName?.trim() || !route.provider || !route.model?.trim()) {
        throw new Error('Task, provider, and model are required')
      }
      return saveAgentRoute(route)
    }
  )
  handleWithTimeout(IPC.ROUTING_DELETE, IPC_TIMEOUT.short, (_event, id: string) => deleteAgentRoute(id))
}
