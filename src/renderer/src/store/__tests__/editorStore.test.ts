import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEditorStore } from '../editorStore'

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.setState({ tabs: [], activeTabId: null })
    vi.resetAllMocks()
  })

  it('does not overwrite a dirty tab on reload', async () => {
    const readFileMock = vi.fn().mockResolvedValue('fresh content')
    const writeFileMock = vi.fn().mockResolvedValue(undefined)

    Object.assign(globalThis, {
      window: {
        electronAPI: {
          fs: {
            readFile: readFileMock,
            writeFile: writeFileMock
          }
        }
      }
    })

    await useEditorStore.getState().openFile('/tmp/test.ts', 'test.ts')
    useEditorStore.getState().updateTabContent('/tmp/test.ts', 'local unsaved change')

    await useEditorStore.getState().reloadTab('/tmp/test.ts')

    const tab = useEditorStore.getState().tabs[0]
    expect(tab?.content).toBe('local unsaved change')
    expect(tab?.isDirty).toBe(true)
    expect(readFileMock).not.toHaveBeenCalledTimes(2)
  })

  it('keeps a tab dirty when its content changes during save', async () => {
    const readFileMock = vi.fn().mockResolvedValue('initial content')
    let resolveWrite: (() => void) | undefined
    const writeFileMock = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveWrite = resolve
    }))

    Object.assign(globalThis, {
      window: {
        electronAPI: {
          fs: {
            readFile: readFileMock,
            writeFile: writeFileMock
          }
        }
      }
    })

    await useEditorStore.getState().openFile('/tmp/test.ts', 'test.ts')
    useEditorStore.getState().updateTabContent('/tmp/test.ts', 'first draft')

    const savePromise = useEditorStore.getState().saveTab('/tmp/test.ts')
    useEditorStore.getState().updateTabContent('/tmp/test.ts', 'second draft')

    resolveWrite?.()
    await savePromise

    const tab = useEditorStore.getState().tabs[0]
    expect(tab?.content).toBe('second draft')
    expect(tab?.isDirty).toBe(true)
    expect(writeFileMock).toHaveBeenCalledTimes(1)
  })
})
