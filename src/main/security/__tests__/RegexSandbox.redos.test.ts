import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { RegexSandbox } from '../RegexSandbox'

describe('RegexSandbox - ReDoS & Timeout Protection', () => {
  const tempDir = join(__dirname, 'temp_redos_test')

  beforeAll(() => {
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true })
    }
  })

  afterAll(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  it('should successfully complete a normal regex search quickly', async () => {
    const filePath = join(tempDir, 'normal.txt')
    writeFileSync(filePath, 'Hello world\nThis is a normal file\nLumiq IDE rules\n')

    const matches = await RegexSandbox.runGrep('normal', tempDir)
    expect(matches.length).toBe(1)
    expect(matches[0].file).toBe('normal.txt')
    expect(matches[0].content).toContain('This is a normal file')
  })

  it('should forcefully terminate and reject when encountering catastrophic backtracking (ReDoS)', async () => {
    // Generate a long repeating pattern of 'a's
    const longString = 'a'.repeat(5000)
    const filePath = join(tempDir, 'redos.txt')
    writeFileSync(filePath, longString + '\n')

    // Catastrophic backtracking pattern: (a+)+b
    const redosPattern = '(a+)+b'

    const startTime = Date.now()
    
    await expect(
      RegexSandbox.runGrep(redosPattern, tempDir, undefined, 1000) // set timeout to 1000ms for fast test execution
    ).rejects.toThrow('Regex search timed out due to CPU/ReDoS limit')

    const duration = Date.now() - startTime
    // Verify that the timeout occurred and didn't hang indefinitely (e.g. should be close to 1000ms, definitely < 2500ms)
    expect(duration).toBeGreaterThanOrEqual(900)
    expect(duration).toBeLessThan(2500)
  })
})
