import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import { developerGrpcServer } from '../services/grpc/DeveloperGrpcServer'

export function registerGrpcHandlers(): void {
  ipcMain.handle(IPC.GRPC_START, (_event, port?: number) => developerGrpcServer.start(port))
  ipcMain.handle(IPC.GRPC_STOP, () => developerGrpcServer.stop())
  ipcMain.handle(IPC.GRPC_STATUS, () => developerGrpcServer.status())
}
