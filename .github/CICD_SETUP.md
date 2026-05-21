# CI/CD Pipeline Setup Guide

## Overview
Your GitHub Actions CI/CD pipeline is now configured with:
- ✅ Code verification (linting, type-checking)
- ✅ Security scanning (dependency audit)
- ✅ Multi-platform builds (Windows, macOS, Linux)
- ✅ Automated release creation
- ✅ Artifact management

## Workflow Triggers

### 1. **Automatic Verification** (Every PR & Push)
- Runs on: Ubuntu-latest (faster, cheaper)
- Jobs:
  - Verify: TypeScript, ESLint, Build
  - Security: npm audit

### 2. **Release Builds** (Push tags matching `v*`)
```bash
git tag v1.0.0
git push origin v1.0.0
```
- Automatically creates installers for Windows, macOS, Linux
- Creates GitHub Release with downloadable artifacts
- Supports alpha/beta releases (tag ending in `-alpha` or `-beta`)

### 3. **Manual Trigger**
- Use: GitHub Actions → CI/CD → Run workflow
- Builds packages on all platforms manually

## Setup Requirements

### GitHub Secrets (Optional)

For code signing (advanced):

1. **macOS Code Signing**
   - Set `CSC_LINK` and `CSC_KEY_PASSWORD` in GitHub Secrets
   - Get from Apple Developer account

2. **Windows Code Signing**
   - Set `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`
   - Get certificate in .pfx format

**Without secrets:** Builds work fine, installer will just show security warnings.

## Adding Tests

1. **Install a test framework:**
```bash
npm install --save-dev vitest @testing-library/react
```

2. **Create test file** (e.g., `src/renderer/src/App.test.tsx`):
```typescript
import { describe, it, expect } from 'vitest'

describe('App', () => {
  it('should render', () => {
    expect(true).toBe(true)
  })
})
```

3. **Update package.json:**
```json
"test": "vitest run",
"test:watch": "vitest"
```

4. **Tests automatically run in CI** on next push

## Environment Variables

Available in workflows:

| Variable | Value | Used For |
|----------|-------|----------|
| `NODE_VERSION` | 22 | Node.js version |
| `NODE_ENV` | production | Build optimization |
| `CSC_IDENTITY_AUTO_DISCOVERY` | false | Signing setup |

## Troubleshooting

### Build Fails on Linux
- Common issue: Missing system packages
- Fix: Already handled (libsecret-1-dev, rpm)

### macOS Notarization Fails
- Requires Apple Developer account
- Set `CSC_LINK` secret with developer certificate

### Windows Signing Fails
- Requires code signing certificate (.pfx)
- Set `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` secrets

### Artifacts Not Found
- Check: Are there files in `dist/` folder?
- If not: electron-builder may have encountered an error
- View: Full logs in GitHub Actions

## Performance Tips

1. **Caching**: npm cache is automatic (using `npm ci`)
2. **Parallel**: Jobs run in parallel where possible
3. **Short TTL**: Build artifacts kept for 1-30 days (saves storage)

## Next Steps

1. ✅ Test the pipeline: Push a tag `git tag v0.1.0 && git push --tags`
2. ✅ Add tests: Follow "Adding Tests" section above
3. ✅ Set up code signing: Optional but recommended for production
4. ✅ Add Dependabot: Settings → Code security → Enable Dependabot

## Security Best Practices

- ✅ npm audit runs on every build
- ✅ Dependencies locked with package-lock.json
- ✅ All artifacts signed (optional with secrets)
- ⚠️ High/Critical vulnerabilities fail the build (with audit-level=moderate)

## Release Versioning

Use semantic versioning with git tags:

- `v1.0.0` - Stable release
- `v1.1.0-alpha` - Pre-release (alpha)
- `v1.1.0-beta.1` - Pre-release (beta)

Example:
```bash
git tag v1.0.0 && git push origin v1.0.0
```

This automatically:
1. Builds on Windows, macOS, Linux
2. Creates GitHub Release
3. Uploads installers

## Monitoring

View builds at: https://github.com/ajay-EY-1859/lumiq/actions

Status indicators:
- 🟢 Green: All tests passed
- 🟠 Orange: In progress
- 🔴 Red: Build failed

## Support

For issues:
1. Check GitHub Actions logs
2. Look for red ❌ steps
3. Click step to see full output
