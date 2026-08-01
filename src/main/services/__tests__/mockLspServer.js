let buffer = Buffer.alloc(0);

process.stdin.on('data', (data) => {
  buffer = Buffer.concat([buffer, data]);

  while (true) {
    const str = buffer.toString('utf8');
    const headerIndex = str.indexOf('Content-Length:');
    if (headerIndex === -1) break;

    const doubleCrlfIndex = str.indexOf('\r\n\r\n', headerIndex);
    if (doubleCrlfIndex === -1) break;

    const headerLine = str.substring(headerIndex, doubleCrlfIndex);
    const match = headerLine.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.subarray(doubleCrlfIndex + 4);
      continue;
    }

    const contentLength = parseInt(match[1], 10);
    const headerLength = doubleCrlfIndex + 4 - headerIndex;
    const messageLength = headerLength + contentLength;

    if (buffer.length < headerIndex + messageLength) break;

    const payloadBuffer = buffer.subarray(headerIndex + headerLength, headerIndex + messageLength);
    buffer = buffer.subarray(headerIndex + messageLength);

    try {
      const payload = JSON.parse(payloadBuffer.toString('utf8'));
      handleRequest(payload);
    } catch {
      // ignore
    }
  }
});

function handleRequest(payload) {
  if (payload.method === 'initialize') {
    sendResponse(payload.id, { capabilities: {} });
    
    // Simulate publishing diagnostics shortly after initialization
    setTimeout(() => {
      sendNotification('textDocument/publishDiagnostics', {
        uri: 'file:///mock_collab_workspace/math.ts',
        diagnostics: [
          {
            message: 'Mock semantic error',
            severity: 1,
            range: {
              start: { line: 0, character: 17 },
              end: { line: 0, character: 29 }
            }
          }
        ]
      });
    }, 10);
  } else if (payload.method === 'textDocument/hover') {
    sendResponse(payload.id, {
      contents: {
        kind: 'markdown',
        value: '**Function**: `multiplyNums(x: number, y: number): number`'
      }
    });
  } else if (payload.method === 'textDocument/completion') {
    sendResponse(payload.id, [
      { label: 'multiplyNums', kind: 3, detail: 'multiplyNums function' }
    ]);
  }
}

function sendResponse(id, result) {
  const payload = {
    jsonrpc: '2.0',
    id,
    result
  };
  writePayload(payload);
}

function sendNotification(method, params) {
  const payload = {
    jsonrpc: '2.0',
    method,
    params
  };
  writePayload(payload);
}

function writePayload(payload) {
  const json = JSON.stringify(payload);
  const content = Buffer.from(json, 'utf8');
  const header = `Content-Length: ${content.length}\r\n\r\n`;
  process.stdout.write(header);
  process.stdout.write(content);
}
