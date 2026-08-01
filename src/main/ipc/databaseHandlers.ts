// ═══════════════════════════════════════════════════════════════════
// Lumiq — Database Explorer IPC Handlers (Milestone 28)
// ═══════════════════════════════════════════════════════════════════

import { IPC } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { getService } from '@shared/instantiation/instantiationService'
import { IDatabaseExplorerService } from '@shared/services'

export function registerDatabaseHandlers(): void {
  handleWithTimeout(IPC.DATABASE_GET_TABLES, IPC_TIMEOUT.short, async (): Promise<any> => {
    return await getService(IDatabaseExplorerService).getTables()
  })

  handleWithTimeout(IPC.DATABASE_GET_SCHEMA, IPC_TIMEOUT.short, async (_event, tableName: string): Promise<any> => {
    return await getService(IDatabaseExplorerService).getTableSchema(tableName)
  })

  handleWithTimeout(IPC.DATABASE_EXECUTE_QUERY, IPC_TIMEOUT.long, async (_event, sql: string): Promise<any> => {
    return await getService(IDatabaseExplorerService).executeQuery(sql)
  })

  handleWithTimeout(IPC.DATABASE_GENERATE_DECLARATION, IPC_TIMEOUT.short, async (_event, format: 'prisma' | 'drizzle'): Promise<any> => {
    return await getService(IDatabaseExplorerService).generateSchemaDeclaration(format)
  })

  handleWithTimeout(IPC.DATABASE_GENERATE_MOCK_DATA, IPC_TIMEOUT.long, async (_event, req: { tableName: string; count: number }): Promise<any> => {
    return await getService(IDatabaseExplorerService).generateMockData(req.tableName, req.count)
  })
}
