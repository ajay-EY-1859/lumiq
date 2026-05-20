// Quick script to run TypeScript typecheck and output errors
const { execSync } = require('child_process');
try {
  const out = execSync('npx tsc --noEmit -p tsconfig.node.json 2>&1', { 
    cwd: 'd:\\agentic-desktop-app', 
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, FORCE_COLOR: '0' }
  });
  console.log('NODE CHECK OK:\n' + out);
} catch(e) {
  console.log('NODE ERRORS:\n' + (e.stdout || '') + '\n' + (e.stderr || ''));
}

try {
  const out2 = execSync('npx tsc --noEmit -p tsconfig.web.json 2>&1', { 
    cwd: 'd:\\agentic-desktop-app', 
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, FORCE_COLOR: '0' }
  });
  console.log('WEB CHECK OK:\n' + out2);
} catch(e) {
  console.log('WEB ERRORS:\n' + (e.stdout || '') + '\n' + (e.stderr || ''));
}
