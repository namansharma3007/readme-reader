# readme-reader

> A zero-config, local Markdown viewer with live reload, dark/light mode, collapsible sidebar, PDF export, and working anchor-link navigation.

![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![npm](https://img.shields.io/badge/npm-publish%20ready-orange)

---

## Features

- **Live reload** — edits appear instantly, scroll position preserved
- **File deletion detection** — sidebar updates automatically, deleted-file banner shown
- **Anchor links** — all headings get slugified IDs; TOC links, footnote back-links, and footer references all work
- **Dark / Light mode** — toggle persisted in `localStorage`
- **Collapsible sidebar** — push-collapse on desktop, slide-over drawer on mobile
- **Fully responsive** — works on all screen sizes
- **PDF export** — one-click export of any note to a clean, print-ready PDF
- **Math rendering** — KaTeX, wrap in `$...$` or `$$...$$`
- **Task lists** — `- [ ]` / `- [x]` syntax
- **Footnotes** — standard Markdown footnote syntax
- **Syntax highlighting** — via highlight.js (auto language detection)
- **Zero config** — one command, no setup

---

## Quick Start

### Use without installing (recommended for one-off use)

```bash
npx readme-reader
```

### Install globally

```bash
npm install -g readme-reader
readme-reader
```

### Install locally in a project

```bash
npm install --save-dev readme-reader
npx readme-reader
```

---

## Usage

```
readme-reader [directory] [options]

Options:
  --port <n>    HTTP port to listen on  (default: 3000)
  --no-open     Don't auto-open the browser
  --help, -h    Show this help message

Examples:
  readme-reader                        # Serve notes/ in current directory
  readme-reader ./my-project           # Serve notes/ inside my-project/
  readme-reader --port 8080            # Use port 8080
  readme-reader ./docs --no-open       # Serve docs/notes/ without opening browser
```

---

## How It Works

`readme-reader` enforces a single rule: **all your Markdown files must live inside a `notes/` folder** in the target directory.

```
your-project/
└── notes/
    ├── getting-started.md
    ├── api.md
    └── guides/
        ├── setup.md
        └── deployment.md
```

When you run `readme-reader`, it will:

1. Create `notes/` if it doesn't exist, and seed a `welcome.md`
2. Start an HTTP server on `localhost:3000`
3. Start a WebSocket server on `localhost:3001` for live reload
4. Open Chrome (or your default browser) automatically
5. Watch the `notes/` folder for any changes

---

## Keyboard Shortcuts & UI

| Action | How |
|---|---|
| Toggle sidebar | Click the **☰** button (top-left) |
| Switch theme | Click the **🌙 / ☀️** toggle (top-right) |
| Export to PDF | Click the **PDF** button (top-right, visible when a file is open) |
| Close mobile drawer | Tap backdrop or press **Escape** |
| Navigate between files | Click any file in the sidebar |
| Jump to a section | Click any heading anchor link in the document |

---

## PDF Export

Every note has a **PDF** button in the top bar (visible only when a file is open). Clicking it opens the browser's native print dialog pre-configured for clean PDF output.

**What the PDF includes:**
- Full rendered Markdown — headings, lists, code blocks, tables, images, footnotes, math
- Clean white background regardless of the current theme
- External links have their URL printed after the link text (e.g. `Google (https://google.com)`)
- Code blocks rendered in a light grey box with monospace font
- A4 page size with comfortable margins

**How to save as PDF:**
1. Click the **PDF** button
2. In the print dialog, set **Destination** → **Save as PDF**
3. Click **Save**

The sidebar, topbar, and all other UI chrome are automatically hidden in the printed output — only the document content is exported.

---

## Markdown Support

readme-reader uses [markdown-it](https://github.com/markdown-it/markdown-it) with the following extensions:

| Feature | Syntax |
|---|---|
| Headings with anchor IDs | `## My Section` → linkable as `#my-section` |
| Task lists | `- [ ] todo` / `- [x] done` |
| Footnotes | `word[^1]` … `[^1]: definition` |
| Inline math | `$E = mc^2$` |
| Block math | `$$\int_0^\infty$$` |
| Tables | Standard GFM pipe tables |
| Strikethrough | `~~deleted~~` |
| HTML passthrough | Raw HTML inside `.md` files is rendered |
| Syntax highlighting | Fenced code blocks with language hint |

---

## Publishing to npm

### 1 — Update `package.json`

Open `package.json` and fill in your details:

```json
{
  "name": "readme-reader",
  "version": "1.0.0",
  "author": "Your Name <you@example.com>",
  "homepage": "https://github.com/yourusername/readme-reader",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/readme-reader.git"
  }
}
```

> **Name uniqueness** — run `npm search readme-reader` first. If the name is taken, pick something like `@yourusername/readme-reader` (a scoped package).

### 2 — Create an npm account

```bash
npm adduser
# or log in if you already have one
npm login
```

### 3 — Dry-run to verify what gets published

```bash
npm pack --dry-run
```

You should see only the files listed in the `files` field of `package.json`:

```
bin/readme-reader.js
README.md
LICENSE
package.json
```

### 4 — Publish

```bash
# First-time public publish
npm publish --access public

# For a scoped package (@yourusername/readme-reader)
npm publish --access public
```

### 5 — Update a published version

Edit `version` in `package.json` following [semver](https://semver.org/), then:

```bash
npm version patch   # 1.0.0 → 1.0.1  (bug fix)
npm version minor   # 1.0.1 → 1.1.0  (new feature)
npm version major   # 1.1.0 → 2.0.0  (breaking change)
npm publish
```

---

## Project Structure

```
readme-reader/
├── bin/
│   └── readme-reader.js      # CLI entry point (the entire server)
├── package.json       # Package metadata & dependencies
├── README.md          # This file
└── LICENSE            # MIT
```

---

## Dependencies

| Package | Purpose |
|---|---|
| `markdown-it` | Core Markdown renderer (GFM, HTML, linkify) |
| `markdown-it-footnote` | Footnote syntax support |
| `markdown-it-task-lists` | `- [ ]` checkbox rendering |
| `ws` | WebSocket server for live reload |

CDN-loaded at runtime (no local install needed):

| Library | Purpose |
|---|---|
| highlight.js | Syntax highlighting |
| KaTeX | Math rendering |
| Google Fonts | Inter, Lora, JetBrains Mono |

---

## Requirements

- **Node.js** 16 or higher
- **npm** 7 or higher
- An internet connection on first load (for CDN fonts/highlight.js/KaTeX)

---

## License

MIT © Your Name

---

## Quick Start

### Use without installing (recommended for one-off use)

```bash
npx readme-reader
```

### Install globally

```bash
npm install -g readme-reader
readme-reader
```

### Install locally in a project

```bash
npm install --save-dev readme-reader
npx readme-reader
```

---

## Usage

```
readme-reader [directory] [options]

Options:
  --port <n>    HTTP port to listen on  (default: 3000)
  --no-open     Don't auto-open the browser
  --help, -h    Show this help message

Examples:
  readme-reader                        # Serve notes/ in current directory
  readme-reader ./my-project           # Serve notes/ inside my-project/
  readme-reader --port 8080            # Use port 8080
  readme-reader ./docs --no-open       # Serve docs/notes/ without opening browser
```

---

## How It Works

`readme-reader` enforces a single rule: **all your Markdown files must live inside a `notes/` folder** in the target directory.

```
your-project/
└── notes/
    ├── getting-started.md
    ├── api.md
    └── guides/
        ├── setup.md
        └── deployment.md
```

When you run `readme-reader`, it will:

1. Create `notes/` if it doesn't exist, and seed a `welcome.md`
2. Start an HTTP server on `localhost:3000`
3. Start a WebSocket server on `localhost:3001` for live reload
4. Open Chrome (or your default browser) automatically
5. Watch the `notes/` folder for any changes

---

## Keyboard Shortcuts & UI

| Action | How |
|---|---|
| Toggle sidebar | Click the **☰** button (top-left) |
| Switch theme | Click the **🌙 / ☀️** toggle (top-right) |
| Close mobile drawer | Tap backdrop or press **Escape** |
| Navigate between files | Click any file in the sidebar |
| Jump to a section | Click any heading anchor link in the document |

---

## Markdown Support

readme-reader uses [markdown-it](https://github.com/markdown-it/markdown-it) with the following extensions:

| Feature | Syntax |
|---|---|
| Headings with anchor IDs | `## My Section` → linkable as `#my-section` |
| Task lists | `- [ ] todo` / `- [x] done` |
| Footnotes | `word[^1]` … `[^1]: definition` |
| Inline math | `$E = mc^2$` |
| Block math | `$$\int_0^\infty$$` |
| Tables | Standard GFM pipe tables |
| Strikethrough | `~~deleted~~` |
| HTML passthrough | Raw HTML inside `.md` files is rendered |
| Syntax highlighting | Fenced code blocks with language hint |

---

## Publishing to npm

### 1 — Update `package.json`

Open `package.json` and fill in your details:

```json
{
  "name": "readme-reader",
  "version": "1.0.0",
  "author": "Your Name <you@example.com>",
  "homepage": "https://github.com/yourusername/readme-reader",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/readme-reader.git"
  }
}
```

> **Name uniqueness** — run `npm search readme-reader` first. If the name is taken, pick something like `@yourusername/readme-reader` (a scoped package).

### 2 — Create an npm account

```bash
npm adduser
# or log in if you already have one
npm login
```

### 3 — Dry-run to verify what gets published

```bash
npm pack --dry-run
```

You should see only the files listed in the `files` field of `package.json`:

```
bin/readme-reader.js
README.md
LICENSE
package.json
```

### 4 — Publish

```bash
# First-time public publish
npm publish --access public

# For a scoped package (@yourusername/readme-reader)
npm publish --access public
```

### 5 — Update a published version

Edit `version` in `package.json` following [semver](https://semver.org/), then:

```bash
npm version patch   # 1.0.0 → 1.0.1  (bug fix)
npm version minor   # 1.0.1 → 1.1.0  (new feature)
npm version major   # 1.1.0 → 2.0.0  (breaking change)
npm publish
```

---

## Project Structure

```
readme-reader/
├── bin/
│   └── readme-reader.js      # CLI entry point (the entire server)
├── package.json       # Package metadata & dependencies
├── README.md          # This file
└── LICENSE            # MIT
```

---

## Dependencies

| Package | Purpose |
|---|---|
| `markdown-it` | Core Markdown renderer (GFM, HTML, linkify) |
| `markdown-it-footnote` | Footnote syntax support |
| `markdown-it-task-lists` | `- [ ]` checkbox rendering |
| `ws` | WebSocket server for live reload |

CDN-loaded at runtime (no local install needed):

| Library | Purpose |
|---|---|
| highlight.js | Syntax highlighting |
| KaTeX | Math rendering |
| Google Fonts | Inter, Lora, JetBrains Mono |

---

## Requirements

- **Node.js** 20 or higher
- **npm** 9 or higher
- An internet connection on first load (for CDN fonts/highlight.js/KaTeX)

---

## License

MIT © Naman Sharma
