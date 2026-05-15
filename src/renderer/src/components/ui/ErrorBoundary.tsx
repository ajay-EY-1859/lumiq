// Lumiq — Error Boundary
// Catches uncaught render errors and shows a recovery UI instead of a white screen.
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleDismiss = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-primary, #0f0f0f)', color: 'var(--text-primary, #e0e0e0)',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif', padding: '24px'
        }}>
          <div style={{
            maxWidth: '520px', width: '100%', textAlign: 'center',
            padding: '40px 32px', background: 'var(--bg-secondary, #1a1a1a)',
            border: '1px solid var(--border, #2a2a2a)', borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💥</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted, #888)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Lumiq encountered an unexpected error. You can try reloading or dismissing this message.
            </p>

            {this.state.error && (
              <div style={{
                padding: '12px', background: 'var(--bg-tertiary, #111)', borderRadius: '8px',
                border: '1px solid rgba(239,68,68,0.3)', marginBottom: '20px',
                textAlign: 'left', maxHeight: '120px', overflow: 'auto'
              }}>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(239,68,68,0.9)', wordBreak: 'break-word' }}>
                  {this.state.error.message}
                </div>
                {this.state.errorInfo?.componentStack && (
                  <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted, #666)', marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                    {this.state.errorInfo.componentStack.split('\n').slice(0, 5).join('\n')}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={this.handleDismiss} style={{
                padding: '10px 20px', background: 'transparent',
                border: '1px solid var(--border, #2a2a2a)', borderRadius: '8px',
                color: 'var(--text-secondary, #aaa)', cursor: 'pointer',
                fontSize: '13px', fontWeight: 500, fontFamily: 'inherit'
              }}>
                Dismiss
              </button>
              <button onClick={this.handleReload} style={{
                padding: '10px 20px', background: 'var(--accent-blue, #2563eb)',
                border: 'none', borderRadius: '8px', color: 'white',
                cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit'
              }}>
                Reload App
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
