const TOOL_ACTIVITY_LABELS: Record<string, string> = {
  FileReadTool: 'Reading files and context…',
  GrepTool: 'Searching the codebase…',
  GlobTool: 'Scanning workspace files…',
  FileEditTool: 'Editing files…',
  FileWriteTool: 'Writing files…',
  BashTool: 'Running shell commands…',
  PowerShellTool: 'Running PowerShell commands…',
  GitTool: 'Checking repository changes…',
  ListDirTool: 'Listing workspace folders…',
  DiffTool: 'Reviewing changes…',
  TerminalTool: 'Opening a terminal session…',
  NotebookTool: 'Working with notebooks…',
  WebSearchTool: 'Searching online resources…',
  WebFetchTool: 'Fetching page content…'
}

export function getToolActivityLabel(toolName: string): string {
  return TOOL_ACTIVITY_LABELS[toolName] ?? 'AI is working on the task…'
}
