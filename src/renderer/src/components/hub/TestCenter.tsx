// ═══════════════════════════════════════════════════════════════════
// Lumiq — Test Center UI Component (Milestone 27)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react'

interface TestCenterProps {
  onBack: () => void
}

type TestFileOption = { name: string; path: string }

export function TestCenter({ onBack }: TestCenterProps): React.JSX.Element {
  const [testFiles, setTestFiles] = useState<TestFileOption[]>([])
  const [selectedTestFile, setSelectedTestFile] = useState('')
  const [selectedSourceFile, setSelectedSourceFile] = useState('')
  
  const [runningTest, setRunningTest] = useState(false)
  const [testResult, setTestResult] = useState<{ passed: boolean; exitCode: number; stdout: string; stderr: string } | null>(null)
  
  const [repairing, setRepairing] = useState(false)
  const [repairSuccess, setRepairSuccess] = useState<boolean | null>(null)
  const [repairLogs, setRepairLogs] = useState<string[]>([])

  // Load sample test files in the workspace
  const scanTestFiles = async () => {
    try {
      const options: TestFileOption[] = [
        { name: 'IPC Framework Service Test', path: 'src/main/services/__tests__/IpcFrameworkService.test.ts' },
        { name: 'Self Healing / Code Smells test', path: 'src/main/services/__tests__/CodeSmellSweeperService.test.ts' },
        { name: 'Debugger DAP Client Test', path: 'src/main/services/__tests__/DapService.test.ts' }
      ]
      setTestFiles(options)
      setSelectedTestFile(options[0].path)
      setSelectedSourceFile('src/main/services/IpcFrameworkService.ts')
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    scanTestFiles()
  }, [])

  // Auto-switch source file depending on selected test file for user convenience
  const handleTestFileChange = (filePath: string) => {
    setSelectedTestFile(filePath)
    if (filePath.includes('IpcFramework')) {
      setSelectedSourceFile('src/main/services/IpcFrameworkService.ts')
    } else if (filePath.includes('CodeSmell')) {
      setSelectedSourceFile('src/main/services/CodeSmellSweeperService.ts')
    } else if (filePath.includes('Dap')) {
      setSelectedSourceFile('src/main/services/DapService.ts')
    }
  }

  // Run suite
  const handleRunTest = async () => {
    if (!selectedTestFile) return
    setRunningTest(true)
    setTestResult(null)
    try {
      const result = await window.electronAPI.test.runTestSuite(selectedTestFile)
      setTestResult(result)
    } catch (err: any) {
      setTestResult({
        passed: false,
        exitCode: -1,
        stdout: '',
        stderr: err.message || 'Failed to start Vitest process.'
      })
    } finally {
      setRunningTest(false)
    }
  }

  // Run autonomous TDD repair loop
  const handleStartRepair = async () => {
    if (!selectedTestFile || !selectedSourceFile) return
    setRepairing(true)
    setRepairSuccess(null)
    setRepairLogs([
      `[TDD Orchestrator] Initializing autonomous repair loop...`,
      `[TDD Orchestrator] Target Source: ${selectedSourceFile}`,
      `[TDD Orchestrator] Target Test: ${selectedTestFile}`,
      `[TDD Orchestrator] Running test suite to check baseline...`
    ])

    try {
      // Perform baseline run
      const baseline = await window.electronAPI.test.runTestSuite(selectedTestFile)
      if (baseline.passed) {
        setRepairLogs(prev => [...prev, `✔️ Test is already passing. No repairs needed.`])
        setRepairSuccess(true)
        setRepairing(false)
        setTestResult(baseline)
        return
      }

      setRepairLogs(prev => [
        ...prev,
        `❌ Baseline run failed (Exit code: ${baseline.exitCode}).`,
        `[TDD Orchestrator] Diagnosing error matches...`,
        `[TDD Orchestrator] Invoking self-healing loop backend (max 3 retries)...`
      ])

      const isHealed = await window.electronAPI.test.autonomousRepairLoop(selectedTestFile, selectedSourceFile, 3)
      
      if (isHealed) {
        setRepairLogs(prev => [
          ...prev,
          `✔️ Loop completed successfully!`,
          `✔️ Source code was self-healed and the test suite now PASSES!`,
          `[TDD Orchestrator] Re-indexing workspace...`
        ])
        setRepairSuccess(true)
      } else {
        setRepairLogs(prev => [
          ...prev,
          `❌ Loop completed. Repair failed.`,
          `❌ Source code could not be repaired to satisfy test assertions within retry budget.`
        ])
        setRepairSuccess(false)
      }

      // Load final test result
      const finalResult = await window.electronAPI.test.runTestSuite(selectedTestFile)
      setTestResult(finalResult)

    } catch (err: any) {
      setRepairLogs(prev => [...prev, `❌ Error in repair loop: ${err.message}`])
      setRepairSuccess(false)
    } finally {
      setRepairing(false)
    }
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[var(--bg-primary)] p-6 custom-scrollbar flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧪</span>
            <h1 className="text-2xl font-extrabold text-white">TDD Test Center</h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Execute Vitest specifications, check code coverage, and trigger background self-healing TDD repair loops.
          </p>
        </div>
        <button
          onClick={onBack}
          className="py-2 px-4 rounded-lg bg-white/5 border border-[var(--border)] text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition"
        >
          ← Hub Dashboard
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start min-h-0 overflow-y-visible">
        
        {/* Left Column: Test Settings & Actions */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Test Selector */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
            <h2 className="text-sm font-bold text-white mb-4">Run Test Specification</h2>
            
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
                Target Test Suite
              </label>
              <select
                value={selectedTestFile}
                onChange={(e) => handleTestFileChange(e.target.value)}
                className="py-2 px-3 bg-black/40 border border-[var(--border)] rounded-lg text-xs text-white outline-none focus:border-blue-500/50"
              >
                {testFiles.map((f) => (
                  <option key={f.path} value={f.path}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRunTest}
              disabled={runningTest}
              className={`w-full py-2.5 rounded-lg font-bold text-xs text-white cursor-pointer transition ${
                runningTest
                  ? 'bg-blue-800 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/10'
              }`}
            >
              {runningTest ? '⏳ Executing Suite...' : '🧪 Run Vitest Suite'}
            </button>
          </div>

          {/* Autonomous TDD repair */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
            <h2 className="text-sm font-bold text-white mb-2">Autonomous TDD Repair</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Auto-correct logic errors in your source code until all test specifications pass.
            </p>

            <div className="flex flex-col gap-1.5 mb-3">
              <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
                Target Test file
              </label>
              <input
                type="text"
                readOnly
                value={selectedTestFile}
                className="py-2 px-3 bg-black/20 border border-[var(--border)] rounded-lg text-xs text-[var(--text-muted)] font-mono outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
                Target Source File
              </label>
              <input
                type="text"
                value={selectedSourceFile}
                onChange={(e) => setSelectedSourceFile(e.target.value)}
                className="py-2 px-3 bg-black/40 border border-[var(--border)] rounded-lg text-xs text-white font-mono outline-none focus:border-blue-500/50"
              />
            </div>

            <button
              onClick={handleStartRepair}
              disabled={repairing}
              className={`w-full py-3 rounded-lg font-bold text-xs text-white transition cursor-pointer ${
                repairing
                  ? 'bg-emerald-800 cursor-wait'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md'
              }`}
            >
              {repairing ? '⚙️ Auto-Healing Code...' : '🩺 Run Self-Healing Repair'}
            </button>
          </div>

        </div>

        {/* Right Column: Console output and healing log */}
        <div className="lg:col-span-2 flex flex-col gap-6 h-full min-h-0">
          
          {/* Test metrics badge & terminal logs */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 flex flex-col flex-1 min-h-[350px]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h2 className="text-sm font-bold text-white">Console Output (Vitest)</h2>
              
              {testResult && (
                <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                  testResult.passed
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                  {testResult.passed ? 'PASSED ✓' : 'FAILED ✗'} (Exit: {testResult.exitCode})
                </span>
              )}
            </div>

            {/* Terminal logs viewer */}
            <div className="flex-1 bg-black/45 border border-[var(--border)] rounded-lg p-4 font-mono text-xs text-slate-300 overflow-y-auto custom-scrollbar select-text whitespace-pre-wrap">
              {runningTest && <div className="text-blue-400">⏳ Running Vitest suite... Spawning sandboxed environment...</div>}
              {!runningTest && !testResult && <div className="text-[var(--text-muted)] italic">No test outputs yet. Choose a suite and click Run.</div>}
              {testResult && (
                <>
                  {testResult.stdout && <div className="text-slate-300 mb-2">{testResult.stdout}</div>}
                  {testResult.stderr && <div className="text-red-400">{testResult.stderr}</div>}
                  {!testResult.stdout && !testResult.stderr && <div className="text-[var(--text-muted)]">Suite executed with empty output stream.</div>}
                </>
              )}
            </div>
          </div>

          {/* Self healing timeline logs */}
          {(repairing || repairLogs.length > 0) && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 flex flex-col shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">TDD Self-Repair Timeline</h3>
                {repairSuccess !== null && (
                  <span className={`text-xs font-bold ${repairSuccess ? 'text-emerald-400' : 'text-red-400'}`}>
                    {repairSuccess ? 'REPAIR SUCCESS ✓' : 'REPAIR FAILED ✗'}
                  </span>
                )}
              </div>
              <div className="p-3.5 bg-black/40 border border-[var(--border)] rounded-lg font-mono text-[11px] text-slate-400 max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1.5">
                {repairLogs.map((log, index) => (
                  <div
                    key={index}
                    className={
                      log.startsWith('✔️')
                        ? 'text-emerald-400 font-semibold'
                        : log.startsWith('❌')
                          ? 'text-red-400'
                          : 'text-slate-300'
                    }
                  >
                    {log}
                  </div>
                ))}
                {repairing && (
                  <div className="text-blue-400 animate-pulse">⏳ Healing process active... resolving assert gaps...</div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  )
}
