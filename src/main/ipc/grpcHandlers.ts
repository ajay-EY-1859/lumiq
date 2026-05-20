import { IPC } from '@shared/types'
import { developerGrpcServer } from '../services/grpc/DeveloperGrpcServer'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

export function registerGrpcHandlers(): void {
  handleWithTimeout(IPC.GRPC_START, IPC_TIMEOUT.long, (_event, port?: number) => developerGrpcServer.start(port))
  handleWithTimeout(IPC.GRPC_STOP, IPC_TIMEOUT.long, () => developerGrpcServer.stop())
  handleWithTimeout(IPC.GRPC_STATUS, IPC_TIMEOUT.long, () => developerGrpcServer.status())
}
