import { describe, expect, it } from 'vitest'
import { getToolActivityLabel } from '../toolActivity'

describe('getToolActivityLabel', () => {
  it('maps file and search tools to human-readable progress text', () => {
    expect(getToolActivityLabel('FileReadTool')).toContain('Reading')
    expect(getToolActivityLabel('GrepTool')).toContain('Searching')
    expect(getToolActivityLabel('FileEditTool')).toContain('Editing')
  })

  it('falls back to a generic label for unknown tools', () => {
    expect(getToolActivityLabel('UnknownTool')).toBe('AI is working on the task…')
  })
})
