import { describe, expect, it } from 'vitest'
import { shouldStopTabKeyPropagation } from '../tabKeyboard'

describe('shouldStopTabKeyPropagation', () => {
  it('stops propagation for handled tab navigation keys', () => {
    expect(shouldStopTabKeyPropagation({ key: 'Enter' } as KeyboardEvent)).toBe(true)
    expect(shouldStopTabKeyPropagation({ key: ' ' } as KeyboardEvent)).toBe(true)
    expect(shouldStopTabKeyPropagation({ key: 'ArrowRight' } as KeyboardEvent)).toBe(true)
    expect(shouldStopTabKeyPropagation({ key: 'Delete' } as KeyboardEvent)).toBe(true)
  })

  it('allows shortcuts like save and close to bubble to the editor', () => {
    expect(shouldStopTabKeyPropagation({ key: 's', ctrlKey: true } as KeyboardEvent)).toBe(false)
    expect(shouldStopTabKeyPropagation({ key: 'w', ctrlKey: true } as KeyboardEvent)).toBe(false)
    expect(shouldStopTabKeyPropagation({ key: 'F5' } as KeyboardEvent)).toBe(false)
  })
})
