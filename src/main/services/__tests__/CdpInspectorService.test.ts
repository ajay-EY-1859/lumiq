import { describe, it, expect, beforeEach } from 'vitest'
import { CdpInspectorService } from '../CdpInspectorService'

describe('CdpInspectorService', () => {
  let cdpService: CdpInspectorService

  beforeEach(() => {
    cdpService = new CdpInspectorService()
  })

  it('should generate a valid DOM node tree structure', () => {
    const tree = cdpService.getDomTree('/fake/workspace', '<div id="main" class="hero"><h1>Title</h1></div>')
    expect(tree).toBeDefined()
    expect(tree.nodeName).toBe('HTML')
    expect(tree.children).toBeDefined()
    expect(tree.children!.length).toBeGreaterThan(0)
  })

  it('should inspect element styles by selector', () => {
    const info = cdpService.inspectElementBySelector('.welcome-card')
    expect(info).toBeDefined()
    expect(info!.computedStyles).toBeDefined()
    expect(info!.computedStyles!.padding).toBe('24px')
  })

  it('should update element style dynamically', () => {
    const updated = cdpService.updateElementStyle('.welcome-card', 'color', '#ff0000')
    expect(updated).toBe(true)

    const info = cdpService.inspectElementBySelector('.welcome-card')
    expect(info!.computedStyles!.color).toBe('#ff0000')
  })

  it('should record console logs and retrieve log entries', () => {
    cdpService.logMessage('info', 'Test log message', 'unit-test')
    const logs = cdpService.getConsoleLogs()
    expect(logs.length).toBe(1)
    expect(logs[0].message).toBe('Test log message')
    expect(logs[0].source).toBe('unit-test')
  })

  it('should take memory heap snapshot', () => {
    const heap = cdpService.takeHeapSnapshot()
    expect(heap).toBeDefined()
    expect(heap.totalJSHeapSize).toBeGreaterThan(0)
    expect(heap.usedJSHeapSize).toBeGreaterThan(0)
    expect(heap.timestamp).toBeGreaterThan(0)
  })

  it('should generate injected CDP script snippet', () => {
    const script = cdpService.getInjectedCdpScript(3000)
    expect(script).toContain('lumiq-cdp-inspector-client')
    expect(script).toContain('3000')
  })
})
