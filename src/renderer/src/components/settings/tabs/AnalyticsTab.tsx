import React, { useState, useEffect } from 'react'

export function AnalyticsTab(): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>({ dailyBudgetCap: 5.00, monthlyBudgetCap: 50.00 })
  const [costs, setCosts] = useState<any>({
    dailyCost: 0,
    monthlyCost: 0,
    providerBreakdown: [],
    recentTransactions: []
  })
  const [traces, setTraces] = useState<any[]>([])

  const loadData = async (): Promise<void> => {
    try {
      setLoading(true)
      const appSettings = await window.electronAPI.settings.get()
      const summary = await window.electronAPI.settings.getCostsSummary()
      const logs = await window.electronAPI.settings.listTraces()

      setSettings({
        dailyBudgetCap: parseFloat(appSettings.dailyBudgetCap || '5.00'),
        monthlyBudgetCap: parseFloat(appSettings.monthlyBudgetCap || '50.00')
      })
      setCosts(summary)
      setTraces(logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10))
    } catch (err) {
      console.error('Failed to load analytics metrics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSaveCap = async (key: 'dailyBudgetCap' | 'monthlyBudgetCap', value: number): Promise<void> => {
    try {
      await window.electronAPI.settings.set(key, value.toFixed(2))
      setSettings((prev: any) => ({ ...prev, [key]: value }))
    } catch (err) {
      console.error('Failed to save budget cap:', err)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>
        ⏳ Loading Analytics & Costs...
      </div>
    )
  }

  const dailyPercentage = Math.min(100, (costs.dailyCost / settings.dailyBudgetCap) * 100)
  const monthlyPercentage = Math.min(100, (costs.monthlyCost / settings.monthlyBudgetCap) * 100)

  // Get color based on threshold
  const getProgressBarColor = (percentage: number): string => {
    if (percentage >= 100) return 'var(--accent-red)'
    if (percentage >= 80) return 'var(--accent-orange)'
    return 'var(--accent-blue)'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '10px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
          📊 Cost Analytics & Trace Audit
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
          Monitor your token consumption, configure daily/monthly budget caps, and view request trace logs.
        </p>
      </div>

      {/* Grid for Budget Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* Daily Budget Card */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>⚡ Daily Spending</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: getProgressBarColor(dailyPercentage) }}>
              ${costs.dailyCost.toFixed(3)} / ${settings.dailyBudgetCap.toFixed(2)}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: '6px', height: '12px', overflow: 'hidden' }}>
            <div style={{
              width: `${dailyPercentage}%`,
              background: getProgressBarColor(dailyPercentage),
              height: '100%',
              borderRadius: '6px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          {/* Slider input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span>Daily Budget Cap</span>
              <span>${settings.dailyBudgetCap.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="50"
              step="0.5"
              value={settings.dailyBudgetCap}
              onChange={(e) => handleSaveCap('dailyBudgetCap', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Monthly Budget Card */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>📅 Monthly Spending</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: getProgressBarColor(monthlyPercentage) }}>
              ${costs.monthlyCost.toFixed(3)} / ${settings.monthlyBudgetCap.toFixed(2)}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: '6px', height: '12px', overflow: 'hidden' }}>
            <div style={{
              width: `${monthlyPercentage}%`,
              background: getProgressBarColor(monthlyPercentage),
              height: '100%',
              borderRadius: '6px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          {/* Slider input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span>Monthly Budget Cap</span>
              <span>${settings.monthlyBudgetCap.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="5"
              max="500"
              step="5"
              value={settings.monthlyBudgetCap}
              onChange={(e) => handleSaveCap('monthlyBudgetCap', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>

      {/* Provider Breakdown & Log Trace List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Cost Breakdown */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            🔥 Cost Breakdown by Provider
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '250px' }}>
            {costs.providerBreakdown.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                No active token logs yet.
              </div>
            ) : (
              costs.providerBreakdown.map((pb: any) => {
                const percentage = costs.monthlyCost > 0 ? (pb.totalCost / costs.monthlyCost) * 100 : 0
                return (
                  <div key={pb.provider} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)' }}>{pb.provider}</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>${pb.totalCost.toFixed(4)}</span>
                    </div>
                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: '4px', height: '6px' }}>
                      <div style={{
                        width: `${percentage}%`,
                        background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-teal))',
                        height: '100%',
                        borderRadius: '4px'
                      }} />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Tokens: {pb.inputTokens.toLocaleString()} in / {pb.outputTokens.toLocaleString()} out
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Audit Logs / Active Traces */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            🔍 Recent Request/Response Traces
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '250px' }}>
            {traces.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                No payload traces captured yet.
              </div>
            ) : (
              traces.map((trace) => {
                const dateString = new Date(trace.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                return (
                  <div key={trace.name} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    border: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{trace.name.replace('.json', '')}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{dateString} • {(trace.sizeBytes / 1024).toFixed(2)} KB</span>
                    </div>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>JSON Log</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
