# 🤝 Contributing to Lumiq

First of all, thank you for your interest in contributing to **Lumiq**! It is because of developers like you that open-source projects succeed. 

Lumiq is developed and maintained by **Fairline tech** (founded and led by **Ajay Raj / ajay-EY-1859**). By contributing to this project, you agree that your contributions will be licensed under the project's open-source licenses and will align with the copyright ownership of **Fairline tech**.

Please take a moment to review this document to understand the contribution guidelines, development setup, and coding standards.

---

## 📜 Table of Contents

1. [Code of Conduct](#-code-of-conduct)
2. [How Can I Contribute?](#-how-can-i-contribute)
   - [Reporting Bugs](#reporting-bugs)
   - [Suggesting Features](#suggesting-features)
   - [Pull Requests](#pull-requests)
3. [Developer Workspace Setup](#-developer-workspace-setup)
   - [Prerequisites](#prerequisites)
   - [Local Installation](#local-installation)
   - [Running the App](#running-the-app)
4. [Coding Standards & Tooling](#-coding-standards--tooling)
   - [TypeScript & Formatting](#typescript--formatting)
   - [Linting](#linting)
   - [Testing](#testing)
5. [Copyright and Contributor License Agreement (CLA)](#-copyright-and-contributor-license-agreement-cla)

---

## 🤝 Code of Conduct

All contributors are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable or abusive behavior to the maintainer via GitHub at [@ajay-EY-1859](https://github.com/ajay-EY-1859).

---

## 🛠️ How Can I Contribute?

### Reporting Bugs
If you find a bug or unexpected behavior in Lumiq:
1. First, search existing issues on our [GitHub Issues Page](https://github.com/ajay-EY-1859/lumiq/issues) to ensure the bug hasn't already been reported.
2. If it is a new bug, open a new issue using our **Bug Report Template**.
3. Provide as much context as possible, including:
   - Your Operating System and version.
   - Node.js and npm versions.
   - Step-by-step instructions to reproduce the bug.
   - Relevant error logs, console logs, or screenshots.

*Note: For security-sensitive issues, please refer to our [Security Policy](SECURITY.md) instead of opening a public issue.*

### Suggesting Features
Have an idea to make Lumiq better? We'd love to hear it!
1. Check the [Roadmap in the README](README.md#-roadmap) to see if the feature is already planned.
2. Open a new issue on GitHub using our **Feature Request Template**.
3. Clearly explain what the feature is, why it is valuable, and how it should work.

### Pull Requests
Ready to submit code? Follow these steps to submit a Pull Request (PR):
1. **Fork** the repository: `https://github.com/ajay-EY-1859/lumiq`
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/lumiq.git
   cd lumiq
   ```
3. Create a descriptive **feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # OR
   git checkout -b bugfix/your-bugfix-name
   ```
4. Make your code changes. Ensure all changes are well-structured, readable, and properly commented.
5. Write tests if adding new modules or core logic.
6. Commit your changes using descriptive commit messages:
   ```bash
   git commit -m "feat(agent): add support for model cost optimization visualizer"
   ```
7. Push your branch to your GitHub fork:
   ```bash
   git push origin feature/your-feature-name
   ```
8. Navigate to `https://github.com/ajay-EY-1859/lumiq` and click **New Pull Request** to submit your changes for review. Please fill out the PR template completely.

---

## 💻 Developer Workspace Setup

### Prerequisites
Make sure you have the following installed on your machine:
- **Node.js:** `v20.0.0` or higher
- **npm:** `v10.0.0` or higher
- **Git**

### Local Installation
Navigate to your project directory and run:
```bash
# Install core packages and native electron-builder dependencies
npm install
```

### Running the App
Start the Electron + React desktop environment in hot-reload development mode:
```bash
npm run dev
```

---

## 🎨 Coding Standards & Tooling

To maintain a clean and uniform codebase, we enforce strict linting and compilation gates before merging:

### TypeScript & Formatting
- All application components must use strict **TypeScript**.
- Keep files modular and components reusable under `src/renderer/src/components`.

### Linting
Run the linting checks before committing:
```bash
# Run ESLint rules
npm run lint

# Automatically correct code style issues
npm run lint:fix
```

### Testing
If you modify core agent loops, tools, or SQLite database migrations, verify that the existing tests pass and write new tests as needed:
```bash
# Run unit tests via Vitest
npm run test
```

---

## 📜 Copyright and Contributor License Agreement (CLA)

By contributing code, documentation, or assets to **Lumiq**, you explicitly agree to the following terms:

1. **Ownership and Copyright Transfer:** You agree that all copyright, intellectual property, and ownership rights of your contributed changes are transferred to **Fairline tech**. All copyright notices in the codebase will remain under the ownership of **Fairline tech**.
2. **Licensing Compatibility:** Your contributions will be distributed alongside Lumiq under the **MIT License** and **GNU General Public License v3 (GPL-3)**, as specified by the repository.
3. **Representations:** You represent that you are the original creator of the contributions and have the legal right to submit them.

Thank you for supporting **Fairline tech** and making **Lumiq** the ultimate AI-native companion!
