import { IPC } from '@shared/types'
import type { EditDecision } from '@shared/types'
import { recordEditDecision, listEditDecisions } from '../db/editDecisions'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

export function registerEditDecisionHandlers(): void {
  handleWithTimeout(
    IPC.EDIT_DECISION_RECORD,
    IPC_TIMEOUT.short,
    (_event, decision: Omit<EditDecision, 'id' | 'createdAt'>) => recordEditDecision(decision)
  )

  handleWithTimeout(IPC.EDIT_DECISION_LIST, IPC_TIMEOUT.short, (_event, sessionId: string) =>
    listEditDecisions(sessionId)
  )
}
