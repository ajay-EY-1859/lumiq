import * as path from 'path'
import * as vscode from 'vscode'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'

type ChatChunk = { content?: string; done?: boolean; error?: string }
type LumiqClient = grpc.Client & {
  streamChat(request: { prompt: string }, metadata?: grpc.Metadata): NodeJS.ReadableStream
  ping(request: Record<string, never>, callback: (error: grpc.ServiceError | null, response: { ok: boolean; version: string }) => void): void
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new SidebarProvider(context.extensionUri)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('lumiq.sidebar', provider)
  )

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

function createClientUri(extensionUri: vscode.Uri, port: number): LumiqClient {
  const protoPath = path.join(extensionUri.fsPath, 'proto', 'lumiq.proto')
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

class SidebarProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case 'onInfo': {
          if (!data.value) return
          vscode.window.showInformationMessage(data.value)
          break
        }
        case 'onError': {
          if (!data.value) return
          vscode.window.showErrorMessage(data.value)
          break
        }
        case 'reconnect': {
          const port = vscode.workspace.getConfiguration('lumiq').get<number>('grpcPort', 43187)
          // We need a context here, but we can't easily pass it without storing it in the class.
          // Wait, createClient needs extensionPath!
          const client = createClientUri(this._extensionUri, port)
          client.ping({}, (err, res) => {
            if (err || !res?.ok) {
              webviewView.webview.postMessage({ type: 'status', connected: false })
            } else {
              webviewView.webview.postMessage({ type: 'status', connected: true, version: res.version })
            }
          })
          break
        }
        case 'send_chat': {
          const port = vscode.workspace.getConfiguration('lumiq').get<number>('grpcPort', 43187)
          const client = createClientUri(this._extensionUri, port)
          const metadata = new grpc.Metadata()
          const token = vscode.workspace.getConfiguration('lumiq').get<string>('grpcAuthToken') || ''
          if (token) metadata.set('authorization', `Bearer ${token}`)
          
          const stream = client.streamChat({ prompt: data.text }, metadata)
          
          stream.on('data', (chunk: ChatChunk) => {
            if (chunk.error) {
              webviewView.webview.postMessage({ type: 'chat_error', error: chunk.error })
            } else if (chunk.content) {
              webviewView.webview.postMessage({ type: 'chat_chunk', content: chunk.content })
            }
          })
          
          stream.on('error', (error: Error) => {
            webviewView.webview.postMessage({ type: 'chat_error', error: error.message })
          })
          
          stream.on('end', () => {
            webviewView.webview.postMessage({ type: 'chat_end' })
          })
          
          break
        }
      }
    })
  }

  private _getHtmlForWebview(_webview: vscode.Webview) {
    // Basic UI for now:
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lumiq Companion</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            padding: 10px;
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .status {
            padding: 8px;
            border-radius: 4px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border);
            text-align: center;
            font-size: 12px;
          }
          .status.connected {
            border-color: #4CAF50;
            color: #4CAF50;
          }
          .status.disconnected {
            border-color: #F44336;
            color: #F44336;
          }
          #chatContainer {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 10px;
            overflow: hidden;
          }
          #messages {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding-right: 4px;
          }
          .message {
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 13px;
            line-height: 1.4;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .message.user {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            align-self: flex-end;
            margin-left: 20px;
          }
          .message.lumiq {
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border);
            align-self: flex-start;
            margin-right: 20px;
          }
          .input-area {
            display: flex;
            gap: 8px;
          }
          textarea {
            flex: 1;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 8px;
            border-radius: 4px;
            resize: none;
            font-family: inherit;
            min-height: 40px;
          }
          textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
          }
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 12px;
            cursor: pointer;
            border-radius: 4px;
            font-weight: 600;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
        </style>
      </head>
      <body>
        <div class="status disconnected" id="statusBox">
          🔴 Not Connected to Lumiq
        </div>
        <button id="reconnectBtn" style="width: 100%;">Check Connection</button>

        <div id="chatContainer">
          <div id="messages"></div>
          <div class="input-area">
            <textarea id="promptInput" placeholder="Ask Lumiq... (Shift+Enter for newline)"></textarea>
            <button id="sendBtn">Send</button>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          let currentLumiqMessage = null;
          
          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'status') {
              const box = document.getElementById('statusBox');
              if (message.connected) {
                box.className = 'status connected';
                box.innerText = '🟢 Connected to Lumiq (v' + message.version + ')';
              } else {
                box.className = 'status disconnected';
                box.innerText = '🔴 Not Connected to Lumiq';
              }
            } else if (message.type === 'chat_chunk') {
              if (!currentLumiqMessage) {
                currentLumiqMessage = document.createElement('div');
                currentLumiqMessage.className = 'message lumiq';
                document.getElementById('messages').appendChild(currentLumiqMessage);
              }
              currentLumiqMessage.innerText += message.content;
              document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
            } else if (message.type === 'chat_end' || message.type === 'chat_error') {
              if (message.type === 'chat_error') {
                 const errDiv = document.createElement('div');
                 errDiv.className = 'message lumiq';
                 errDiv.style.color = 'var(--vscode-errorForeground)';
                 errDiv.innerText = 'Error: ' + message.error;
                 document.getElementById('messages').appendChild(errDiv);
              }
              currentLumiqMessage = null;
              document.getElementById('promptInput').disabled = false;
              document.getElementById('sendBtn').disabled = false;
              document.getElementById('promptInput').focus();
            }
          });

          function sendChat() {
            const input = document.getElementById('promptInput');
            const text = input.value.trim();
            if (!text) return;
            
            // Add User message
            const userMsg = document.createElement('div');
            userMsg.className = 'message user';
            userMsg.innerText = text;
            document.getElementById('messages').appendChild(userMsg);
            
            input.value = '';
            input.disabled = true;
            document.getElementById('sendBtn').disabled = true;
            currentLumiqMessage = null; // Reset for new reply
            
            vscode.postMessage({ type: 'send_chat', text });
          }

          document.getElementById('sendBtn').addEventListener('click', sendChat);
          
          document.getElementById('promptInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendChat();
            }
          });

          document.getElementById('reconnectBtn').addEventListener('click', () => {
             document.getElementById('statusBox').className = 'status';
             document.getElementById('statusBox').innerText = '🔄 Connecting...';
             vscode.postMessage({ type: 'reconnect' });
          });
          
          // Initial ping
          vscode.postMessage({ type: 'reconnect' });
        </script>
      </body>
      </html>`
  }
}
