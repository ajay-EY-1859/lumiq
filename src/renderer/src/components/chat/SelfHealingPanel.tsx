// ═══════════════════════════════════════════════════════════════════
// Lumiq — SelfHealingPanel
// Premium, highly-styled glassmorphic diagnostic trace panel displaying
// real-time error interception, AI repair traces, visual diff proposals,
// and one-click apply/rollback actions.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react'
import type { SelfHealingAttempt } from '@shared/types'

interface SelfHealingPanelProps {
  sessionId: string
  activeAttempt: SelfHealingAttempt | null
  onClearActive: () => void
}

export function SelfHealingPanel({ sessionId, activeAttempt: initialAttempt, onClearActive }: SelfHealingPanelProps): React.JSX.Element | null {
  const [attempt, setAttempt] = useState<SelfHealingAttempt | null>(initialAttempt)
  const [isApplying, setIsApplying] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [errorLogsVisible, setErrorLogsVisible] = useState(false)

  // Listen to live self-healing updates
  useEffect(() => {
    setAttempt(initialAttempt)
  }, [initialAttempt])

  useEffect(() => {
    const cleanupFailure = window.electronAPI.selfHealing.onFailureDetected((updated) => {
      if (updated.sessionId === sessionId) {
        setAttempt(updated)
      }
    })

    const cleanupProposal = window.electronAPI.selfHealing.onProposalGenerated((updated) => {
      if (updated.sessionId === sessionId) {
        setAttempt(updated)
        setIsApplying(false)
      }
    })

    return () => {
      cleanupFailure()
      cleanupProposal()
    }
  }, [sessionId])

  if (!attempt || attempt.status === 'rolled_back') return null

  // Parse diff details
  let proposal: { explanation: string; filePath: string; targetContent: string; replacementContent: string } | null = null
  if (attempt.proposedDiff) {
    try {
      proposal = JSON.parse(attempt.proposedDiff)
    } catch {
      // Ignored
    }
  }

  const handleApply = async (): Promise<void> => {
    setIsApplying(true)
    try {
      const outcome = await window.electronAPI.selfHealing.apply(attempt.id)
      if (!outcome.success) {
        alert(outcome.error || 'Validation failed.')
      }
    } catch (err) {
      console.error('[SelfHealingPanel] Apply patch failed:', err)
    } finally {
      setIsApplying(false)
    }
  }

  const handleDecline = async (): Promise<void> => {
    try {
      await window.electronAPI.selfHealing.decline(attempt.id)
      onClearActive()
    } catch (err) {
      console.error('[SelfHealingPanel] Decline patch failed:', err)
    }
  }

  const handleRefine = async (): Promise<void> => {
    setIsRefining(true)
    try {
      await window.electronAPI.selfHealing.refine(attempt.id)
    } catch (err) {
      console.error('[SelfHealingPanel] Refine patch failed:', err)
    } finally {
      setIsRefining(false)
    }
  }

  // Visual highlights for target Content and replacement Content
  const renderVisualDiff = (): React.JSX.Element | null => {
    if (!proposal) return null
    return (
      <div style={{
        marginTop: '12px',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{
          padding: '6px 12px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>📄 {proposal.filePath}</span>
          <span style={{ color: 'var(--accent-blue)' }}>Patch Diff</span>
        </div>
        
        {/* Target Content (Red / Deletions) */}
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          borderBottom: '1px dashed rgba(239, 68, 68, 0.2)',
          padding: '8px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          whiteSpace: 'pre-wrap',
          color: '#f87171'
        }}>
          {proposal.targetContent.split('\n').map((line, idx) => (
            <div key={`del-${idx}`} style={{ display: 'flex', gap: '8px' }}>
              <span style={{ opacity: 0.4, minWidth: '16px', userSelect: 'none' }}>-</span>
              <span>{line}</span>
            </div>
          ))}
        </div>

        {/* Replacement Content (Green / Additions) */}
        <div style={{
          background: 'rgba(34, 197, 94, 0.08)',
          padding: '8px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          whiteSpace: 'pre-wrap',
          color: '#4ade80'
        }}>
          {proposal.replacementContent.split('\n').map((line, idx) => (
            <div key={`add-${idx}`} style={{ display: 'flex', gap: '8px' }}>
              <span style={{ opacity: 0.4, minWidth: '16px', userSelect: 'none' }}>+</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      margin: '0 0 16px 0',
      background: 'linear-gradient(135deg, rgba(20, 20, 25, 0.7) 0%, rgba(28, 28, 35, 0.75) 100%)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '16px',
      padding: '16px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      animation: 'slideIn 0.3s ease-out'
    }}>
      
      {/* Header with Title & Live Pulse Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: attempt.status === 'applied' ? '#22c55e' : attempt.status === 'failed' ? '#ef4444' : '#3b82f6',
          boxShadow: `0 0 8px ${attempt.status === 'applied' ? '#22c55e' : attempt.status === 'failed' ? '#ef4444' : '#3b82f6'}`,
          animation: 'pulse 1.5s infinite'
        }} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
          🛡️ AUTONOMOUS SELF-HEALING DIAGNOSTICS
        </span>
        <button 
          onClick={handleDecline} 
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '14px',
            opacity: 0.6,
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
        >
          ✕
        </button>
      </div>

      {/* Step-by-Step Execution Trace Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingLeft: '8px' }}>
        
        {/* STEP 1: Interception */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#ef4444',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>1</div>
            <div style={{ flex: 1, width: '2px', background: 'rgba(255,255,255,0.1)', marginTop: '4px', minHeight: '16px' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Terminal Command Intercepted
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
              $ {attempt.command}
            </div>
            <div style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '11px',
              color: '#ef4444',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.4
            }}>
              {attempt.errorMessage}
            </div>
          </div>
        </div>

        {/* STEP 2: Analysis */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: attempt.status === 'analyzing' ? 'var(--accent-blue)' : '#22c55e',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {attempt.status === 'analyzing' ? '●' : '2'}
            </div>
            <div style={{ flex: 1, width: '2px', background: 'rgba(255,255,255,0.1)', marginTop: '4px', minHeight: '16px' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Root Cause Diagnosis</span>
              {attempt.status === 'analyzing' && (
                <span style={{
                  width: '10px',
                  height: '10px',
                  border: '2px solid var(--accent-blue)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                  display: 'inline-block'
                }} />
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {attempt.status === 'analyzing' 
                ? 'Lumiq background Fix Agent is querying AI provider to construct repair diff...'
                : proposal?.explanation || 'AI Subagent diagnosed root cause.'}
            </div>
          </div>
        </div>

        {/* STEP 3: Proposal */}
        {(attempt.status === 'proposed' || attempt.status === 'approved' || attempt.status === 'applied' || attempt.status === 'failed') && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: attempt.status === 'proposed' ? 'var(--accent-blue)' : '#22c55e',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>3</div>
              <div style={{ flex: 1, width: '2px', background: 'rgba(255,255,255,0.1)', marginTop: '4px', minHeight: '16px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Corrective Repair Diff Proposed
              </div>
              
              {renderVisualDiff()}

              {/* Gated Action Buttons */}
              {attempt.status === 'proposed' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    onClick={handleApply}
                    disabled={isApplying}
                    style={{
                      background: 'var(--accent-blue)',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    {isApplying ? 'Applying Fix...' : '✓ Apply Fix'}
                  </button>
                  <button
                    onClick={handleDecline}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Gated Verification Outcome */}
        {(attempt.status === 'approved' || attempt.status === 'applied' || attempt.status === 'failed') && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: attempt.status === 'applied' ? '#22c55e' : attempt.status === 'failed' ? '#ef4444' : 'var(--accent-blue)',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {attempt.status === 'approved' ? '●' : '4'}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Sandbox Verification</span>
                {attempt.status === 'approved' && (
                  <span style={{
                    width: '10px',
                    height: '10px',
                    border: '2px solid var(--accent-blue)',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                    display: 'inline-block'
                  }} />
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {attempt.status === 'approved' && 'SandboxRunner is executing validation command in gated terminal context...'}
                {attempt.status === 'applied' && '✨ Validation completed with exit code 0! Bug resolved successfully!'}
                {attempt.status === 'failed' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ color: '#ef4444' }}>❌ Validation failed. Gated Runner has automatically rolled back all changes to preserve workspace stability.</span>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <button 
                        onClick={() => setErrorLogsVisible(!errorLogsVisible)} 
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-blue)',
                          fontSize: '10px',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        {errorLogsVisible ? 'Hide failure logs' : 'Show failure logs'}
                      </button>
                      <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>|</span>
                      <button 
                        onClick={handleRefine}
                        disabled={isRefining}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f59e0b',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
                        {isRefining ? 'Refining...' : '✨ Refine Fix with AI Reflection'}
                      </button>
                    </div>
                    {errorLogsVisible && (
                      <pre style={{
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '8px',
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        whiteSpace: 'pre-wrap',
                        overflowX: 'auto',
                        maxHeight: '120px',
                        color: 'var(--text-muted)'
                      }}>{attempt.executionLogs}</pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
