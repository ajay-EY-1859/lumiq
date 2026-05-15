import { create } from 'zustand'
import { TaskState, TaskProblem } from '@shared/types'

interface TaskStore {
  tasks: TaskState[]
  activeTaskId: string | null

  // Actions
  runTask: (name: string, command: string, args: string[], cwd: string) => Promise<void>
  stopTask: (taskId: string) => Promise<void>
  setActiveTask: (taskId: string | null) => void
  clearTasks: () => void
  removeTask: (taskId: string) => void

  // Callbacks for IPC
  _appendLog: (taskId: string, data: string, type: 'stdout' | 'stderr' | 'system') => void
  _setTaskExit: (taskId: string, code: number | null) => void
}

function parseProblems(data: string, _filePrefix?: string): TaskProblem[] {
  const problems: TaskProblem[] = []
  
  // Simple regex for TS errors: "src/main/index.ts:15:10 - error TS2304: Cannot find name 'foo'."
  const tsRegex = /([^:\n]+):(\d+):(\d+)\s+-\s+(error|warning)\s+[^:]+:\s+(.*)/g
  let match
  while ((match = tsRegex.exec(data)) !== null) {
    problems.push({
      file: match[1].trim(),
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      severity: match[4] as 'error' | 'warning',
      message: match[5].trim()
    })
  }

  return problems
}

export const useTaskStore = create<TaskStore>((set, get) => {
  // Listen to IPC events exactly once
  window.electronAPI.task.onOutput((taskId, data, type) => {
    get()._appendLog(taskId, data, type)
  })
  window.electronAPI.task.onExit((taskId, code) => {
    get()._setTaskExit(taskId, code)
  })

  return {
    tasks: [],
    activeTaskId: null,

    runTask: async (name, command, args, cwd) => {
      const taskId = await window.electronAPI.task.run(name, command, args, cwd)
      
      const newTask: TaskState = {
        id: taskId,
        name,
        command,
        args,
        cwd,
        status: 'running',
        logs: [],
        problems: []
      }

      set((state) => ({
        tasks: [...state.tasks, newTask],
        activeTaskId: taskId
      }))
    },

    stopTask: async (taskId) => {
      await window.electronAPI.task.stop(taskId)
    },

    setActiveTask: (taskId) => set({ activeTaskId: taskId }),

    clearTasks: () => set({ tasks: [], activeTaskId: null }),

    removeTask: (taskId) => set((state) => {
      const newTasks = state.tasks.filter((t) => t.id !== taskId)
      return {
        tasks: newTasks,
        activeTaskId: state.activeTaskId === taskId ? (newTasks[0]?.id || null) : state.activeTaskId
      }
    }),

    _appendLog: (taskId, data, type) => {
      set((state) => {
        const tasks = [...state.tasks]
        const taskIdx = tasks.findIndex((t) => t.id === taskId)
        if (taskIdx === -1) return state

        const task = { ...tasks[taskIdx] }
        task.logs = [...task.logs, { id: Date.now() + Math.random().toString(), timestamp: Date.now(), data, type }]
        
        // Parse problems
        const newProblems = parseProblems(data, task.cwd)
        if (newProblems.length > 0) {
          task.problems = [...task.problems, ...newProblems]
        }

        tasks[taskIdx] = task
        return { tasks }
      })
    },

    _setTaskExit: (taskId, code) => {
      set((state) => {
        const tasks = [...state.tasks]
        const taskIdx = tasks.findIndex((t) => t.id === taskId)
        if (taskIdx === -1) return state

        const task = { ...tasks[taskIdx] }
        task.status = code === 0 ? 'success' : 'error'
        tasks[taskIdx] = task
        return { tasks }
      })
    }
  }
})
