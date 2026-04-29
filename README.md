# Study Markdown Reader

A local Markdown reader and editor designed for study workflows, with support for `.md` / `.mdc` browsing, editing, saving, and template-based quick input.

## Features

- Open a local folder and auto-scan `.md` / `.mdc` files
- Grouped file tree in the sidebar (filters common noisy folders)
- Three modes: Edit / Preview / Split view
- Keyboard shortcuts:
  - `Ctrl + S` Save
  - `Ctrl + Z` Undo
  - `Ctrl + Y` / `Ctrl + Shift + Z` Redo
- Quick-entry panel (Wrongbook / Daily Report / Day Clear / Weekly Report)
- Supports both Electron desktop mode and browser-compatible mode

## Tech Stack

- Electron
- React
- Vite
- Marked

## Run Locally

```bash
npm install
npm run dev
```

## Build (Windows)

```bash
npm run pack:win
```

Build outputs:

- `release/Study Markdown Reader 0.0.0.exe`
- `release/win-unpacked/`

## Project Structure

```text
md-reader-app/
├─ electron/            # Electron main process and preload
├─ src/                 # React app
├─ public/              # Static assets (including app icon)
├─ dist/                # Frontend build output
└─ package.json
```

## Use Cases

- Exam prep / study material management (plans, daily logs, wrongbooks)
- Local knowledge base reading and quick editing
- Template-based records (daily review, weekly report, wrongbook entry)

## Roadmap

- Search by filename/content
- Customizable templates
- Auto-backup and file snapshots
- Dark mode and theme switching

## License

MIT
