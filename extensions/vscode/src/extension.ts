import * as path from 'path'
import * as vscode from 'vscode'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'

type ChatChunk = { content?: string; done?: boolean; error?: string }
type LumiqClient = grpc.Client & {
  streamChat(request: { prompt: string }, metadata?: grpc.Metadata): NodeJS.ReadableStream
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lumiq.sendSelection', async () => {
      const editor = vscode.window.activeTextEditor
      const selected = editor?.document.getText(editor.selection) || editor?.document.getText()
      if (!selected?.trim()) {
        vscode.window.showWarningMessage('No text selected for Lumiq.')
        return
      }

      const port = vscode.workspace.getConfiguration('lumiq').get<number>('grpcPort', 43187)
      const output = vscode.window.createOutputChannel('Lumiq')
      output.clear()
      output.show(true)

      const client = createClient(context, port)
      const metadata = new grpc.Metadata()
      const token = vscode.workspace.getConfiguration('lumiq').get<string>('grpcAuthToken') || ''
      if (token) {
        metadata.set('authorization', `Bearer ${token}`)
      }
      const stream = client.streamChat({ prompt: selected }, metadata)
      stream.on('data', (chunk: ChatChunk) => {
        if (chunk.error) output.appendLine(`Error: ${chunk.error}`)
        if (chunk.content) output.append(chunk.content)
      })
      stream.on('error', (error: Error) => output.appendLine(`\nError: ${error.message}`))
      stream.on('end', () => output.appendLine('\n\n[Lumiq stream ended]'))
    })
  )
}

export function deactivate(): void {
  // No persistent resources.
}

function createClient(context: vscode.ExtensionContext, port: number): LumiqClient {
  const protoPath = path.join(context.extensionPath, 'proto', 'lumiq.proto')
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  })
  const loaded = grpc.loadPackageDefinition(packageDefinition) as unknown as {
    lumiq: { LumiqDeveloper: new (target: string, credentials: grpc.ChannelCredentials, options?: object) => LumiqClient }
  }

  return new loaded.lumiq.LumiqDeveloper(`127.0.0.1:${port}`, grpc.credentials.createInsecure())
}
