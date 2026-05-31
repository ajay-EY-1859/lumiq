# 🙋 Support & Troubleshooting for Lumiq

Welcome to the **Lumiq Support Guide**! Whether you are encountering an installation problem, having issues configuring an AI provider, or simply want to ask a question, we are here to help.

Lumiq is designed and maintained by **Fairline tech** (led by **Ajay Raj / ajay-EY-1859**). Below are the primary support channels and troubleshooting steps to resolve common issues.

---

## 🗺️ Where to Get Help

### 1. GitHub Issues (Bug Reporting & Feature Proposals)
If you believe you have found a software bug or want to suggest a new IDE feature:
* Search the active and closed [GitHub Issues](https://github.com/ajay-EY-1859/lumiq/issues) to see if someone has already addressed it.
* If not, create a new issue using our structured template.

### 2. GitHub Discussions (Q&A & Community Help)
For general usage questions, custom script tool integrations, or sharing your dynamic MCP configurations:
* Check out the [GitHub Discussions Page](https://github.com/ajay-EY-1859/lumiq/discussions) (if enabled) or start a thread.
* Connect with other developers who are building with Lumiq.

---

## 🛠️ Troubleshooting Common Issues

### 🔴 Issue 1: Electron installation fails (native modules build error)
Lumiq uses `better-sqlite3` and `keytar`, which are native C++ modules. During installation, Electron needs to compile these modules for your specific OS.
* **Solution:**
  1. Ensure you have standard C++ build tools installed on your OS:
     - **Windows:** Run `npm install --global windows-build-tools` or install Visual Studio Build Tools with the "Desktop development with C++" workload.
     - **macOS:** Run `xcode-select --install`.
     - **Linux (Ubuntu/Debian):** Run `sudo apt-get install build-essential g++ python3`.
  2. Clear your package cache and rebuild:
     ```bash
     npm cache clean --force
     rm -rf node_modules package-lock.json
     npm install
     npm run postinstall
     ```

### 🔴 Issue 2: AI provider key is not recognized
Your API keys are stored securely using system keychain credentials via `keytar`.
* **Solution:**
  1. Make sure your operating system's credential manager (e.g., Keychain Access on macOS, Credential Manager on Windows, or Secret Service/KWallet on Linux) is running and unlocked.
  2. Enter your API key again in the **Lumiq Settings Page** (`Ctrl+,` or `Cmd+,`).
  3. Ensure you have a valid internet connection and that your API quota has not expired.

### 🔴 Issue 3: Local Semantic Search (RAG) is slow or freezing during index
Workspace indexing takes place in a background thread to prevent UI freezing, but indexing very large projects (e.g. hundreds of thousands of files) can consume significant memory.
* **Solution:**
  1. Check your `.gitignore` or workspace search settings to ensure folders like `node_modules/`, `dist/`, `.git/`, and `build/` are ignored.
  2. Limit semantic index depth or choose an API-based embedding provider (like Gemini or OpenAI) if local CPU-based embedding via Transformers.js is too heavy for your machine.

---

## 📧 Maintainer Contact

If you have urgent inquiries, enterprise support questions, or wish to collaborate with **Fairline tech**:
* Visit the profile page at **[@ajay-EY-1859](https://github.com/ajay-EY-1859)**.
* Contact the maintainer directly through the channels provided on their profile.

*Developed with ❤️ by **Fairline tech** to make local agentic coding seamless.*
