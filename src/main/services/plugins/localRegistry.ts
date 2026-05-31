import type { PluginManifest } from '@shared/types'

export const LOCAL_PLUGIN_REGISTRY: PluginManifest[] = [
  {
    id: 'lumiq-react-expert',
    name: 'React Expert',
    version: '1.0.0',
    category: 'skill',
    author: 'Lumiq Team',
    description: 'Focused guidance for React application work, component design, state, and testing.',
    resources: {
      skills: [
        {
          name: 'React Expert',
          description: 'Plan and implement React features with attention to state, accessibility, and tests.',
          promptTemplate:
            'You are working as a React specialist. Inspect the existing component patterns first, keep state local unless shared state is clearly needed, preserve accessibility, and include focused tests for user-facing behavior.',
          allowedTools: ['FileReadTool', 'GrepTool', 'GlobTool', 'FileEditTool', 'FileWriteTool']
        }
      ]
    }
  },
  {
    id: 'lumiq-docker-toolkit',
    name: 'Docker Toolkit',
    version: '1.0.0',
    category: 'mcp',
    author: 'Community',
    description: 'Adds a Docker MCP server preset for container and image workflows.',
    resources: {
      mcpServers: [
        {
          name: 'Docker MCP',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-docker'],
          env: {}
        }
      ]
    }
  },
  {
    id: 'lumiq-python-data-science',
    name: 'Python Data Science',
    version: '1.0.0',
    category: 'bundle',
    author: 'Lumiq Team',
    description: 'Adds Python analysis guidance and a reusable environment inspection command.',
    resources: {
      skills: [
        {
          name: 'Python Data Science',
          description: 'Analyze Python data workflows with pandas, notebooks, and reproducible checks.',
          promptTemplate:
            'You are working on Python data science code. Prefer reproducible scripts or notebooks, inspect package versions, validate data shape assumptions, and summarize plots or metrics plainly.',
          allowedTools: ['FileReadTool', 'GrepTool', 'GlobTool', 'PowerShellTool', 'BashTool']
        }
      ],
      commands: [
        {
          name: 'python-env-summary',
          description: 'Print Python executable and installed packages.',
          command: 'python --version && python -m pip list',
          type: 'shell',
          args: []
        }
      ]
    }
  },
  {
    id: 'lumiq-aws-helper',
    name: 'AWS Helper',
    version: '1.0.0',
    category: 'command',
    author: 'CloudGen',
    description: 'Adds prompt and shell commands for common AWS workspace checks.',
    resources: {
      commands: [
        {
          name: 'aws-whoami',
          description: 'Show the active AWS caller identity.',
          command: 'aws sts get-caller-identity',
          type: 'shell',
          args: []
        },
        {
          name: 'aws-review-plan',
          description: 'Prompt template for reviewing AWS infrastructure changes.',
          command:
            'Review the AWS-related changes in this workspace. Focus on IAM permissions, public exposure, region assumptions, cost risk, and rollback safety.',
          type: 'prompt',
          args: []
        }
      ]
    }
  }
]
