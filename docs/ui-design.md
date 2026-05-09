# 🎨 UI/UX DESIGN SPECIFICATION
## Lumiq — openclaude GUI

**Version:** 1.0
**Date:** April 27, 2026

---

## 1. DESIGN PHILOSOPHY

- **Familiar** — Looks like a modern chat app (Slack/Discord-inspired layout)
- **Focused** — Chat is the primary surface, everything else is secondary
- **Transparent** — Tool executions are visible and controllable
- **Fast** — Streaming feels instant, no layout shifts

---

## 2. COLOR PALETTE

### Light Theme
| Token | Hex | Usage |
|-------|-----|-------|
| bg-primary | `#FFFFFF` | Main background |
| bg-secondary | `#F8FAFC` | Sidebar, panels |
| bg-tertiary | `#F1F5F9` | Input fields, cards |
| border | `#E2E8F0` | Dividers, card borders |
| text-primary | `#0F172A` | Main text |
| text-secondary | `#475569` | Labels, timestamps |
| text-muted | `#94A3B8` | Placeholders |
| accent-blue | `#2563EB` | Primary buttons, links |
| accent-blue-hover | `#1D4ED8` | Button hover |
| accent-green | `#16A34A` | Success, connected |
| accent-red | `#DC2626` | Error, danger |
| accent-yellow | `#D97706` | Warning |
| user-bubble | `#EFF6FF` | User message background |
| ai-bubble | `#FFFFFF` | AI message background |
| code-bg | `#1E293B` | Code block background |

### Dark Theme
| Token | Hex | Usage |
|-------|-----|-------|
| bg-primary | `#0F172A` | Main background |
| bg-secondary | `#1E293B` | Sidebar, panels |
| bg-tertiary | `#334155` | Input fields, cards |
| border | `#334155` | Dividers |
| text-primary | `#F1F5F9` | Main text |
| text-secondary | `#94A3B8` | Labels, timestamps |
| text-muted | `#64748B` | Placeholders |
| accent-blue | `#3B82F6` | Primary buttons |
| accent-blue-hover | `#2563EB` | Button hover |
| user-bubble | `#1E3A5F` | User message background |
| ai-bubble | `#1E293B` | AI message background |
| code-bg | `#0F172A` | Code block background |

---

## 3. TYPOGRAPHY

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| App Name | Inter | 16px | 700 | text-primary |
| Section Headers | Inter | 13px | 600 | text-secondary |
| Message Text | Inter | 14px | 400 | text-primary |
| Code (inline) | JetBrains Mono | 13px | 400 | accent-blue |
| Code (block) | JetBrains Mono | 13px | 400 | `#E2E8F0` |
| Timestamps | Inter | 11px | 400 | text-muted |
| Button Text | Inter | 14px | 500 | White |
| Input Text | Inter | 14px | 400 | text-primary |
| Sidebar Items | Inter | 13px | 400 | text-secondary |
| Model Badge | Inter | 11px | 500 | text-secondary |

---

## 4. MAIN WINDOW LAYOUT

```
┌──────────────────────────────────────────────────────────────────┐
│ TitleBar (32px)                                                  │
│ [🤖 Lumiq]  ────────────────────  [Provider▼][Model▼] │
│                                                        [─] [□] [×]│
├──────────────────────────────────────────────────────────────────┤
│ Sidebar (240px, collapsible)  │  Main Content Area               │
│                               │                                  │
│ [+ New Session]  [Ctrl+N]     │  ┌────────────────────────────┐  │
│ ─────────────────────────     │  │                            │  │
│ 🔍 Search sessions...         │  │  MessageList               │  │
│                               │  │  (virtualized scroll)      │  │
│ TODAY                         │  │                            │  │
│ ○ Fix authentication bug      │  │  ┌──────────────────────┐  │  │
│ ○ Write unit tests            │  │  │ 👤 User              │  │  │
│                               │  │  │ Can you help me...   │  │  │
│ YESTERDAY                     │  │  └──────────────────────┘  │  │
│ ○ API design review           │  │                            │  │
│ ○ Refactor database           │  │  ┌──────────────────────┐  │  │
│                               │  │  │ 🤖 Claude            │  │  │
│ LAST WEEK                     │  │  │ Sure! Here's how...  │  │  │
│ ○ Setup CI/CD pipeline        │  │  │ ```python            │  │  │
│                               │  │  │ def example():       │  │  │
│ ─────────────────────────     │  │  │ ```                  │  │  │
│ 🤖 Agents                     │  │  └──────────────────────┘  │  │
│ ⚙️  Settings                  │  │                            │  │
│                               │  └────────────────────────────┘  │
│                               │                                  │
│                               │  ┌────────────────────────────┐  │
│                               │  │ MessageInput               │  │
│                               │  │ ┌──────────────────────┐   │  │
│                               │  │ │ Type a message...    │   │  │
│                               │  │ │                      │   │  │
│                               │  │ └──────────────────────┘   │  │
│                               │  │ [📎] [🎤]          [Send→] │  │
│                               │  └────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│ StatusBar (24px): ● Connected │ claude-sonnet-4 │ 1,234 tokens  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. COMPONENT SPECIFICATIONS

### 5.1 TitleBar

```
SPECIFICATION: TitleBar
─────────────────────────────────────────
Height: 32px (Windows/Linux), 28px (macOS)
Background: bg-secondary
Draggable: Yes (entire bar except controls)
-webkit-app-region: drag

Left:
  ├── App icon (16px)
  └── "Lumiq" (Inter 13px, 600)

Center:
  └── Current session title (Inter 13px, 400, text-secondary)

Right:
  ├── Provider dropdown (compact, 120px)
  ├── Model dropdown (compact, 140px)
  └── Window controls (Windows/Linux only)
      ├── Minimize [─]
      ├── Maximize [□]
      └── Close [×]
```

### 5.2 Sidebar

```
SPECIFICATION: Sidebar
─────────────────────────────────────────
Width: 240px (expanded), 0px (collapsed)
Background: bg-secondary
Border-right: 1px solid border
Transition: width 200ms ease

Header:
  └── [+ New Session] button (full width, outlined)

Search:
  └── Input with search icon (bg-tertiary, rounded)

Session List:
  ├── Date group headers (text-muted, 11px, uppercase)
  └── SessionItem (per session)
      ├── Height: 36px
      ├── Padding: 8px 12px
      ├── Title (13px, truncated with ellipsis)
      ├── Hover: bg-tertiary
      ├── Active: bg-accent-blue/10, text-accent-blue
      └── Right-click menu: Rename, Export, Delete

Footer:
  ├── [🤖 Agents] nav item
  └── [⚙️ Settings] nav item
```

### 5.3 MessageBubble

```
SPECIFICATION: MessageBubble
─────────────────────────────────────────
User Message:
  ├── Background: user-bubble
  ├── Border-radius: 12px 12px 4px 12px
  ├── Max-width: 80%
  ├── Align: right
  └── Avatar: 👤 (24px circle, bg-accent-blue)

AI Message:
  ├── Background: ai-bubble
  ├── Border: 1px solid border
  ├── Border-radius: 12px 12px 12px 4px
  ├── Max-width: 85%
  ├── Align: left
  └── Avatar: 🤖 (24px circle, bg-secondary)

Tool Message:
  ├── Background: bg-tertiary
  ├── Border-left: 3px solid accent-yellow
  ├── Font: JetBrains Mono 12px
  └── Collapsible (click to expand/collapse)

Content:
  ├── Markdown rendered (react-markdown + remark-gfm)
  ├── Code blocks: dark bg, syntax highlight, copy button
  └── Tables: styled with border

Actions (on hover):
  ├── Copy button (top-right)
  └── Regenerate button (AI messages only)
```

### 5.4 MessageInput

```
SPECIFICATION: MessageInput
─────────────────────────────────────────
Background: bg-primary
Border-top: 1px solid border
Padding: 12px 16px

Textarea:
  ├── Background: bg-tertiary
  ├── Border: 1px solid border
  ├── Border-radius: 8px
  ├── Min-height: 44px
  ├── Max-height: 200px (auto-expand)
  ├── Font: Inter 14px
  ├── Placeholder: "Message Claude... (Enter to send)"
  └── Focus: border-color accent-blue

Toolbar (below textarea):
  ├── Left: [📎 Attach] [🎤 Voice] (future)
  └── Right: [Send →] button (accent-blue, disabled when empty)

During Streaming:
  └── [■ Stop] button replaces [Send →]
```

### 5.5 Tool Approval Dialog

```
SPECIFICATION: ToolApprovalDialog
─────────────────────────────────────────
Type: Modal overlay
Background: rgba(0,0,0,0.5) backdrop
Card: bg-primary, border-radius 12px, shadow-xl
Width: 480px (desktop), 90vw (mobile)

Header:
  ├── 🔧 icon (accent-yellow)
  ├── "Tool Execution Request" (16px, 600)
  └── Tool name badge (bg-tertiary, rounded)

Body:
  ├── Tool description (text-secondary, 13px)
  ├── Arguments section:
  │   └── JSON formatted in code block (bg-code, JetBrains Mono)
  └── Working directory (if BashTool)

For FileEditTool:
  └── Diff view:
      ├── Red lines: removed content
      └── Green lines: added content

Footer:
  ├── [Deny] (outlined, red)
  ├── [Always Allow] (outlined, green)
  └── [Approve ✓] (filled, accent-blue)
```

### 5.6 Settings Page

```
SPECIFICATION: SettingsPage
─────────────────────────────────────────
Layout: Full-page overlay (not modal)
Tabs: API Providers | Models | Appearance | Tools | Agents | Shortcuts

API Providers Tab:
  ├── Provider cards (one per provider)
  │   ├── Provider logo + name
  │   ├── Connection status dot
  │   ├── API Key input (masked, show/hide toggle)
  │   ├── Base URL input (for custom/Ollama)
  │   ├── Default Model dropdown
  │   └── [Test Connection] button
  └── [+ Add Custom Provider] button

Appearance Tab:
  ├── Theme: [Light] [Dark] [System] toggle
  ├── Font Size: [12] [14] [16] radio
  └── Sidebar: [Show] [Hide] toggle

Tools Tab:
  ├── Per-tool row:
  │   ├── Tool name + description
  │   ├── Enabled toggle
  │   └── Permission: [Always Ask] [Always Allow] [Always Deny]
  └── Note: BashTool disabled by default
```

### 5.7 Agent Builder

```
SPECIFICATION: AgentBuilderPage
─────────────────────────────────────────
Layout: Full-page with form

Fields:
  ├── Name (required, text input)
  ├── Description (optional, textarea, 2 rows)
  ├── System Prompt (required, textarea, 8 rows, monospace)
  ├── Provider (dropdown, optional — uses default if empty)
  ├── Model (dropdown, filtered by provider)
  └── Tools (checkboxes for each available tool)

Actions:
  ├── [Cancel] (outlined)
  ├── [Test Agent] (outlined, opens test chat)
  └── [Save Agent] (filled, accent-blue)
```

---

## 6. RESPONSIVE BEHAVIOR

| Window Width | Layout |
|-------------|--------|
| > 1200px | Full layout: sidebar expanded + chat |
| 900-1200px | Sidebar collapsed by default, toggle available |
| < 900px | Sidebar hidden, hamburger menu |

---

## 7. ANIMATIONS & TRANSITIONS

| Element | Animation | Duration |
|---------|-----------|----------|
| Sidebar open/close | width 0→240px | 200ms ease |
| Modal appear | opacity 0→1 + scale 0.95→1 | 150ms ease-out |
| Toast notification | slide in from top-right | 200ms ease |
| Message appear | fade in + slide up 8px | 150ms ease |
| Streaming text | no animation (instant) | — |
| Button hover | background color | 100ms |
| Typing indicator | bounce animation | 600ms loop |

---

## 8. KEYBOARD SHORTCUTS

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` / `Cmd+N` | New session |
| `Enter` | Send message |
| `Shift+Enter` | New line in input |
| `Ctrl+B` / `Cmd+B` | Toggle sidebar |
| `Ctrl+,` / `Cmd+,` | Open settings |
| `Ctrl+F` / `Cmd+F` | Search sessions |
| `Escape` | Cancel streaming / close modal |
| `Ctrl+Z` / `Cmd+Z` | Undo (in input) |
| `Ctrl+Q` / `Cmd+Q` | Quit app |
| `Ctrl+1-5` | Switch sidebar tabs |

---

## 9. EMPTY STATES

### No Sessions
```
┌─────────────────────────────────┐
│                                 │
│         🤖                      │
│   Start a conversation          │
│                                 │
│   [+ New Session]               │
│                                 │
└─────────────────────────────────┘
```

### No API Key Configured
```
┌─────────────────────────────────┐
│         ⚙️                      │
│   Add an API key to get started │
│                                 │
│   [Open Settings]               │
└─────────────────────────────────┘
```

---

## 10. ERROR STATES

### Toast Notifications
```
┌─────────────────────────────────┐
│ ❌ API Error                    │
│ Rate limit exceeded. Try again  │
│ in 60 seconds.                  │
│                              [×]│
└─────────────────────────────────┘
```

### Inline Error in Chat
```
┌─────────────────────────────────┐
│ ⚠️ Request failed               │
│ Network error. Check your       │
│ connection.                     │
│ [Retry]                         │
└─────────────────────────────────┘
```

---

## 🤖 AGENT INSTRUCTIONS

### On Error
Jab bhi koi error aaye task execute karte waqt, turant ek file banao:
**Filename:** `ERROR_LOG.md`

File mein yeh sab likho:
- Kaunsa task chal raha tha jab error aaya
- Error ka poora message (exact text)
- Kaunsi file ya line mein error tha
- Sambhavit karan (possible cause)
- Kya try kiya tha solve karne ke liye
- Agle steps kya hone chahiye

### On Interruption or Risk
Jab bhi task execution achanak band ho ya khatre mein ho, turant ek file banao:
**Filename:** `REMAINING_PLAN.md`

File mein yeh sab likho:
- Kya kaam poora ho chuka hai (completed tasks)
- Kaunsa kaam chal raha tha jab ruka (in-progress task)
- Kya kaam abhi bacha hai (pending tasks)
- Koi important context jo agli baar kaam aaye

---

**Document Version:** 1.0
**Last Updated:** April 27, 2026
**Status:** Ready for Development
